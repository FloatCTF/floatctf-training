#!/usr/bin/env python3
"""在 Kali 容器里以 kali 用户开一个真实的交互式 zsh（带 pty），逐条执行命令并记录输出。

基础学期的课要求页面上的命令输出来自 Kali 环境的实际运行。本脚本负责采集，
scripts/lab/terminal-replay.mjs 负责从课程页面取命令、把采集结果和页面比对。

准备容器（一次）：
  docker run -d --name kali-lab --hostname kali kalilinux/kali-rolling sleep infinity
  docker exec -e DEBIAN_FRONTEND=noninteractive kali-lab bash -lc '
    apt-get update -qq &&
    apt-get install -y -qq --no-install-recommends zsh sudo man-db manpages less nano file xxd \\
      python3 curl procps iproute2 iputils-ping kali-defaults locales ca-certificates \\
      command-not-found tree vim-tiny &&
    apt-get update -qq &&
    sed -i "s/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/" /etc/locale.gen && locale-gen &&
    useradd -m -s /usr/bin/zsh -G sudo kali && echo kali:kali | chpasswd'
  其余工具按课程需要追加，尽量与 kali-linux-default 预装的一致。

用法：
  python3 scripts/lab/kali-session.py commands.txt > record.json
  python3 scripts/lab/kali-session.py --python sessions.txt > record.json

  commands.txt 每行一条 shell 命令，以 ## 开头的行是注释。程序运行中需要键盘输入时，
  把这一行写成 JSON：{"cmd": "python3 age.py", "stdin": ["18"]}，stdin 里的每一项会在程序等待时依次输入。
  stdin 里写 "^C" 表示按下 Ctrl+C。

  --python 模式记录 Python 交互模式（>>>）里的输入输出。sessions.txt 每行一条语句，
  以「## session」开头的行表示另开一个全新的解释器；输出是按会话分组的二维数组。
  只支持单行语句，多行代码请写成脚本文件用 shell 模式运行。

  命令运行前需要的脚本和数据文件，先用 docker cp 放进容器里对应的目录。
  容器名用环境变量 KALI_CONTAINER 指定，默认 kali-lab。

依赖：宿主机上的 docker 与 Python 包 pexpect。
"""
import json
import os
import re
import sys

import pexpect

CONTAINER = os.environ.get('KALI_CONTAINER', 'kali-lab')
MARK = '@@READY@@'
ANSI = re.compile(r'\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[=>]|\x1b\(B')


def overlay(line):
    """终端里 \\r 把光标拉回行首，后写的内容覆盖先写的；还原成屏幕上最终看到的一行。"""
    screen = ''
    for segment in line.split('\r'):
        screen = segment + screen[len(segment):]
    return screen.rstrip()


def clean(text):
    text = ANSI.sub('', text).replace('\r\n', '\n')
    return '\n'.join(overlay(line) for line in text.split('\n'))


def spawn_shell():
    child = pexpect.spawn(
        'docker',
        ['exec', '-it', '-e', 'LANG=en_US.UTF-8', '-e', 'TERM=xterm', CONTAINER, 'su', '-', 'kali'],
        encoding='utf-8', dimensions=(30, 80), timeout=120,
    )
    # 等 Kali 的两行提示符出现
    child.expect('└─')
    child.expect(r'\[\?2004h')
    return child


def settle(child, quiet=0.8):
    """一直读到终端安静下来为止，返回这段时间里的全部输出。"""
    buffer = ''
    while True:
        try:
            buffer += child.read_nonblocking(4096, timeout=quiet)
        except pexpect.TIMEOUT:
            return buffer


def record_shell(path):
    child = spawn_shell()
    # 把提示符换成容易识别的标记
    child.sendline(
        f"PROMPT='{MARK}'; RPROMPT=''; NEWLINE_BEFORE_PROMPT=no; unset zle_bracketed_paste; "
        "unsetopt PROMPT_SP PROMPT_CR; precmd() {}; "
    )
    child.expect(MARK)
    child.expect(MARK)

    records = []
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if not line.strip() or line.startswith('##'):
            continue
        entry = json.loads(line) if line.startswith('{') else {'cmd': line}
        command = entry['cmd']
        child.sendline(command)
        collected = ''
        for typed in entry.get('stdin', []):
            # 等程序打印完提示、停下来等输入，再像学员一样敲进去
            collected += settle(child, 0.7)
            if typed == '^C':
                child.sendcontrol('c')
            else:
                child.sendline(typed)
        while True:
            # sudo 询问密码、command-not-found 追问是否安装，都在这里应答
            index = child.expect([MARK, r'password for kali: ?', r'\(N/y\)'])
            collected += child.before
            if index == 0:
                break
            if index == 1:
                collected += 'password for kali: \n'
                child.sendline('kali')
            else:
                collected += '(N/y)n'
                child.sendline('n')
        # 后台作业结束等异步通知会让 zsh 重画提示符，多出来的提示符连同通知一并收进这条命令
        while True:
            try:
                child.expect(MARK, timeout=0.6)
                collected += child.before
            except pexpect.TIMEOUT:
                break
        lines = clean(collected).split('\n')
        # 第一行是 zsh 对输入的回显
        records.append({'cmd': command, 'out': '\n'.join(lines[1:]).rstrip('\n')})

    child.sendline('exit')
    child.close()
    return records


def record_python(path):
    """Python 交互模式：每个会话开一个新的解释器，记录每条语句之后打印的内容。"""
    sessions = [[]]
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if line.startswith('## session'):
            if sessions[-1]:
                sessions.append([])
        elif line.strip() and not line.startswith('##'):
            sessions[-1].append(line)

    records = []
    for statements in sessions:
        if not statements:
            continue
        child = spawn_shell()
        child.sendline('cd ~/lab/python 2>/dev/null; python3')
        settle(child, 1.5)
        session = []
        for statement in statements:
            child.send(statement + '\r')
            text = ANSI.sub('', settle(child)).replace('\r\n', '\n')
            # 新版交互模式每敲一个字符都会重画整行；回车之后才是真正的输出
            output = text.split('\n\r', 1)[1] if '\n\r' in text else ''
            output = re.sub(r'>>> $', '', output).rstrip('\n')
            session.append({'cmd': statement, 'out': output})
        child.send('exit()\r')
        settle(child, 0.5)
        child.close()
        records.append(session)
    return records


def main():
    args = sys.argv[1:]
    python_mode = '--python' in args
    paths = [arg for arg in args if not arg.startswith('--')]
    if len(paths) != 1:
        sys.exit(__doc__)
    records = record_python(paths[0]) if python_mode else record_shell(paths[0])
    json.dump(records, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
