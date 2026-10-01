#!/usr/bin/env python3
"""在 Kali 容器里用无界面的 Firefox ESR 打开页面，逐条执行控制台语句并记录结果。

基础学期里讲浏览器的课，页面上的控制台输入输出要来自 Kali 自带的 Firefox 的实际运行。
本脚本在容器里运行（由 scripts/lab/replay-lesson.sh 复制进去并调用），通过 Firefox 自带的
WebDriver BiDi 接口执行语句，不需要 geckodriver。

用法（容器内）：
  python3 firefox-console.py sessions.txt > record.json

  sessions.txt 里「## session <页面地址>」开一个会话：重新加载这个页面，随后每行一条语句，
  在同一个页面里依次执行。输出是按会话分组的二维数组，每项是 {"cmd", "out"}。

记录下来的 out 按 Firefox 控制台的显示方式排版：
  console.log 等打印的内容在前，一行一条；
  随后是语句的结果：字符串带双引号，数字、true、false、null、undefined 原样；
  抛出的错误写成「Uncaught 错误类型: 消息」。
  以 await 开头的语句（含 const x = await …）等到 Promise 完成后再取结果。
  结果是对象、数组、DOM 节点时，控制台的展开式显示无法从接口取得，记为 <<不支持的结果类型>>：
  页面上请改用 .length、.textContent、JSON.stringify(…) 这类得到基本类型的写法。

依赖：容器里的 firefox-esr 与 python3-websockets。
"""
import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile

import websockets

PORT = 9333
DECLARE_AWAIT = re.compile(r'^(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(.+?);?\s*$')


def show(value):
    """把 BiDi 返回的远程值排成 Firefox 控制台里看到的样子。"""
    kind = value.get('type')
    if kind == 'string':
        return json.dumps(value['value'], ensure_ascii=False)
    if kind == 'number':
        number = value['value']
        if isinstance(number, float) and number.is_integer():
            return str(int(number))
        return str(number)
    if kind == 'boolean':
        return 'true' if value['value'] else 'false'
    if kind in ('undefined', 'null'):
        return kind
    return f'<<不支持的结果类型：{kind}>>'


class Browser:
    def __init__(self):
        self.profile = tempfile.mkdtemp(prefix='ff-console-')
        self.process = None
        self.socket = None
        self.serial = 0
        self.logs = []

    async def start(self):
        self.process = subprocess.Popen(
            ['firefox-esr', '--headless', '--no-remote', '--remote-debugging-port', str(PORT), '--profile', self.profile, 'about:blank'],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        for _ in range(200):
            if 'WebDriver BiDi listening' in self.process.stdout.readline():
                break
        else:
            raise RuntimeError('Firefox 没有启动 WebDriver BiDi')
        self.socket = await websockets.connect(f'ws://127.0.0.1:{PORT}/session', max_size=None)
        await self.call('session.new', {'capabilities': {}})
        await self.call('session.subscribe', {'events': ['log.entryAdded']})
        tree = await self.call('browsingContext.getTree', {})
        self.context = tree['contexts'][0]['context']

    def keep(self, message):
        if message.get('method') == 'log.entryAdded':
            self.logs.append(message['params'])

    async def call(self, method, params):
        self.serial += 1
        serial = self.serial
        await self.socket.send(json.dumps({'id': serial, 'method': method, 'params': params}))
        while True:
            message = json.loads(await self.socket.recv())
            if message.get('id') == serial:
                if message.get('type') == 'error':
                    raise RuntimeError(f"{method}: {message.get('message')}")
                return message['result']
            self.keep(message)

    async def drain(self, quiet=0.25):
        """再等一小会儿，把异步到达的控制台消息收齐。"""
        while True:
            try:
                self.keep(json.loads(await asyncio.wait_for(self.socket.recv(), quiet)))
            except asyncio.TimeoutError:
                return

    async def evaluate(self, expression, wait=False):
        return await self.call('script.evaluate', {
            'expression': expression, 'target': {'context': self.context}, 'awaitPromise': wait, 'userActivation': True,
        })

    async def run(self, statement):
        self.logs = []
        declared = DECLARE_AWAIT.match(statement)
        if declared:
            keyword, name, expression = declared.groups()
            result = await self.evaluate(f'(async () => {{ globalThis.__awaited = await ({expression}); }})()', wait=True)
            if result['type'] == 'success':
                result = await self.evaluate(f'{keyword} {name} = globalThis.__awaited;')
        elif statement.startswith('await '):
            result = await self.evaluate(statement[len('await '):].rstrip(';'), wait=True)
        else:
            result = await self.evaluate(statement)
        await self.drain()
        lines = [entry.get('text', '') for entry in self.logs if entry.get('type') == 'console']
        if result['type'] == 'success':
            lines.append(show(result['result']))
        else:
            lines.append('Uncaught ' + result['exceptionDetails']['text'])
        return '\n'.join(lines)

    async def stop(self):
        if self.socket:
            await self.socket.close()
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=10)
        shutil.rmtree(self.profile, ignore_errors=True)


async def main(path):
    sessions = []
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if line.startswith('## session'):
            sessions.append((line[len('## session'):].strip(), []))
        elif line.strip() and not line.startswith('##'):
            sessions[-1][1].append(line)

    browser = Browser()
    await browser.start()
    records = []
    try:
        for url, statements in sessions:
            await browser.call('browsingContext.navigate', {'context': browser.context, 'url': url, 'wait': 'complete'})
            await browser.drain()
            records.append([{'cmd': statement, 'out': await browser.run(statement)} for statement in statements])
    finally:
        await browser.stop()
    json.dump(records, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(sys.argv[1]))
