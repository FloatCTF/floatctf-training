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
  commands.txt 每行一条命令，以 ## 开头的行是注释。容器名用环境变量 KALI_CONTAINER 指定，默认 kali-lab。

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


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    child = pexpect.spawn(
        'docker',
        ['exec', '-it', '-e', 'LANG=en_US.UTF-8', '-e', 'TERM=xterm', CONTAINER, 'su', '-', 'kali'],
        encoding='utf-8', dimensions=(30, 80), timeout=120,
    )
    # 等 Kali 的两行提示符出现，再换成容易识别的标记
    child.expect('└─')
    child.expect(r'\[\?2004h')
    child.sendline(
        f"PROMPT='{MARK}'; RPROMPT=''; NEWLINE_BEFORE_PROMPT=no; unset zle_bracketed_paste; "
        "unsetopt PROMPT_SP PROMPT_CR; precmd() {}; "
    )
    child.expect(MARK)
    child.expect(MARK)

    records = []
    for raw in open(sys.argv[1], encoding='utf-8'):
        command = raw.rstrip('\n')
        if not command.strip() or command.startswith('##'):
            continue
        child.sendline(command)
        collected = ''
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
    json.dump(records, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
