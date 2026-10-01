#!/usr/bin/env python3
"""对练习服务器发一个真实的 HTTP 请求，把请求和响应按「起始行、头部、空行、正文」拆开，
生成 HttpExchange 组件的数据（src/data/http/<名字>.json）。

用法：
  python3 scripts/lab/http-trace.py scripts/lab/http-scenarios/<名字>.json

场景文件：
  server   练习服务器脚本的路径（相对站点根目录）；脚本启动它，发完请求后停掉
  address  [主机, 端口]
  request  method、target、headers（[[名字, 值], …]，照 curl 发出的顺序写）、body（可省略）
  notes    每一部分的一句解说。键：method、target、version、blank、body、status、reason、
           以及「>名字」「<名字」分别对应请求头、响应头；响应的版本用 <version，空行用 <blank，正文用 <body

请求照场景文件原样发出（有 body 时 Content-Length 必须与实际长度一致），响应是服务器的真实应答。
Date、会话编号这类每次都变的值，生成一次就固定在数据里。
"""
import json
import os
import socket
import subprocess
import sys
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))


def exchange(address, raw):
    with socket.create_connection(tuple(address), timeout=5) as connection:
        connection.sendall(raw)
        chunks = []
        while True:
            chunk = connection.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
    return b''.join(chunks)


def main(path):
    scenario = json.load(open(path, encoding='utf-8'))
    request = scenario['request']
    notes = scenario['notes']
    body = request.get('body', '')
    headers = [list(pair) for pair in request['headers']]
    declared = dict((name.lower(), value) for name, value in headers).get('content-length')
    if body and declared != str(len(body.encode('utf-8'))):
        sys.exit(f'Content-Length 与 body 的实际长度 {len(body.encode("utf-8"))} 不一致')
    # 让服务器答完就关连接，才能读到完整的响应。场景自己没写 Connection 头时由脚本补上，
    # 这一行不进数据，页面上的请求与 curl 发的一致
    closes = any(name.lower() == 'connection' for name, _ in headers)
    wire = [f"{request['method']} {request['target']} HTTP/1.1"] + [f'{name}: {value}' for name, value in headers] + ([] if closes else ['Connection: close']) + ['', body]
    raw = '\r\n'.join(wire).encode('utf-8')

    server = subprocess.Popen([sys.executable, os.path.join(ROOT, scenario['server'])], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try:
                socket.create_connection(tuple(scenario['address']), timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        answer = exchange(scenario['address'], raw).decode('utf-8')
    finally:
        server.terminate()
        server.wait()

    head, _, answer_body = answer.partition('\r\n\r\n')
    status_line, *answer_headers = head.split('\r\n')
    version, status, reason = status_line.split(' ', 2)

    def note(key):
        if key not in notes:
            sys.exit(f'场景文件的 notes 缺少：{key}')
        return notes[key]

    def header_parts(lines, prefix):
        parts = []
        for name, value in lines:
            if name.lower() == 'connection' and prefix == '<' and not closes:
                continue  # 对应上面补的 Connection: close
            parts.append({'kind': 'header', 'name': name, 'value': value, 'note': note(prefix + name)})
        return parts

    trace = {
        'scenario': os.path.relpath(os.path.abspath(path), ROOT),
        'request': [
            {'kind': 'start', 'tokens': [
                {'text': request['method'], 'label': '方法', 'note': note('method')},
                {'text': request['target'], 'label': '目标', 'note': note('target')},
                {'text': 'HTTP/1.1', 'label': '版本', 'note': note('version')},
            ]},
            *header_parts(headers, '>'),
            {'kind': 'blank', 'note': note('blank')},
            *([{'kind': 'body', 'text': body, 'note': note('body')}] if body else []),
        ],
        'response': [
            {'kind': 'start', 'tokens': [
                {'text': version, 'label': '版本', 'note': note('<version')},
                {'text': status, 'label': '状态码', 'note': note('status')},
                {'text': reason, 'label': '原因短语', 'note': note('reason')},
            ]},
            *header_parts([line.split(': ', 1) for line in answer_headers], '<'),
            {'kind': 'blank', 'note': note('<blank')},
            *([{'kind': 'body', 'text': answer_body.rstrip('\n'), 'note': note('<body')}] if answer_body else []),
        ],
    }
    out = os.path.join(ROOT, 'src', 'data', 'http', os.path.basename(path))
    with open(out, 'w', encoding='utf-8') as handle:
        json.dump(trace, handle, ensure_ascii=False, indent=1)
        handle.write('\n')
    print(f'{os.path.relpath(out, ROOT)}：{status} {reason}，请求 {len(trace["request"])} 部分，响应 {len(trace["response"])} 部分')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
