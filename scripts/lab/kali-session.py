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
      command-not-found tree vim-tiny bind9-dnsutils netcat-traditional sqlite3 firefox-esr python3-websockets &&
    apt-get update -qq &&
    sed -i "s/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/" /etc/locale.gen && locale-gen &&
    useradd -m -s /usr/bin/zsh -G sudo kali && echo kali:kali | chpasswd'
  其余工具按课程需要追加，尽量与 kali-linux-default 预装的一致。

用法：
  python3 scripts/lab/kali-session.py commands.txt > record.json
  python3 scripts/lab/kali-session.py --python sessions.txt > record.json
  python3 scripts/lab/kali-session.py --sqlite sessions.txt > record.json
  python3 scripts/lab/kali-session.py --gdb sessions.txt > record.json

  commands.txt 每行一条 shell 命令，以 ## 开头的行是注释。程序运行中需要键盘输入时，
  把这一行写成 JSON：{"cmd": "python3 age.py", "stdin": ["18"]}，stdin 里的每一项会在程序等待时依次输入。
  stdin 里写 "^C" 表示按下 Ctrl+C。
  以「##! 」开头的行是准备动作：照常执行但不记录。
  JSON 行里带 "terminal": "A" 的命令在另一个终端（第二个 shell）里执行，用来放一直占着终端的
  服务器程序：命令两秒内没有回到提示符就视为仍在运行，脚本接着执行后面的命令；全部命令执行完后
  对它按 Ctrl+C，这期间终端 A 打印的全部内容记为这条命令的输出。

  --python 模式记录 Python 交互模式（>>>）里的输入输出。sessions.txt 每行一条语句，
  以「## session」开头的行表示另开一个全新的解释器；输出是按会话分组的二维数组。
  只支持单行语句，多行代码请写成脚本文件用 shell 模式运行。

  --sqlite 模式记录 sqlite3 命令行（sqlite>）里的输入输出，格式同上；「## session shop.db」
  里的文件名是这个会话打开的数据库。每条语句写在一行里。

  --gdb 模式记录 gdb（(gdb) 提示符）里的输入输出，格式同上；「## session ./crash」里的参数是要调试的程序。
  gdb 询问是否启用 debuginfod 时回答 n，这一问一答记在那条命令的输出里。

  交互模式的会话在环境变量 KALI_WORKDIR 指定的目录里启动，默认 ~/lab/python。

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
WORKDIR = os.environ.get('KALI_WORKDIR', '~/lab/python')
MARK = '@@READY@@'
# 最后两项之前的一项是 OSC 序列（如 curl 给 Location 头加的终端超链接），以 BEL 或 ESC \ 结束
ANSI = re.compile(r'\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[=>]|\x1b\(B')


CSI = re.compile(r'\x1b\[([0-9;?]*)([ -/]*)([@-~])')


def render(text):
    """把一段终端输出还原成屏幕上最终留下的样子。

    \\r 把光标拉回行首，后写的内容覆盖先写的；docker build、docker compose 的进度显示
    用「光标上移若干行、清掉这一行」原地刷新，只有最后一帧留在屏幕上。
    这里只模拟这几种光标动作，其余控制序列（颜色、光标显隐等）直接去掉。
    """
    text = re.sub(r'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[=>]|\x1b\(B', '', text)
    lines, row, col = [''], 0, 0

    def put(ch):
        nonlocal col
        line = lines[row].ljust(col)
        lines[row] = line[:col] + ch + line[col + 1:]
        col += 1

    i = 0
    while i < len(text):
        ch = text[i]
        if ch == '\x1b':
            m = CSI.match(text, i)
            if not m:
                i += 1
                continue
            params, _, final = m.groups()
            n = int(params) if params.isdigit() else None
            if final == 'A':
                row = max(0, row - (n or 1))
            elif final == 'B':
                row += n or 1
            elif final == 'C':
                col += n or 1
            elif final == 'D':
                col = max(0, col - (n or 1))
            elif final == 'G':
                col = max(0, (n or 1) - 1)
            elif final == 'K' and not params.startswith('?'):
                if params == '2':
                    lines[row] = ''
                elif params == '1':
                    lines[row] = ' ' * col + lines[row][col:]
                else:
                    lines[row] = lines[row][:col]
            elif final == 'J' and not params.startswith('?') and params in ('', '0'):
                lines[row] = lines[row][:col]
                del lines[row + 1:]
            while len(lines) <= row:
                lines.append('')
            i = m.end()
            continue
        if ch == '\r':
            col = 0
        elif ch == '\n':
            row += 1
            col = 0
            while len(lines) <= row:
                lines.append('')
        elif ch == '\b':
            col = max(0, col - 1)
        elif ch >= ' ' or ch == '\t':
            put(ch)
        i += 1
    return '\n'.join(line.rstrip() for line in lines)


def clean(text):
    return render(text.replace('\r\n', '\n'))


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


def marked_shell():
    child = spawn_shell()
    # 把提示符换成容易识别的标记
    child.sendline(
        f"PROMPT='{MARK}'; RPROMPT=''; NEWLINE_BEFORE_PROMPT=no; unset zle_bracketed_paste; "
        "unsetopt PROMPT_SP PROMPT_CR; precmd() {}; "
    )
    child.expect(MARK)
    child.expect(MARK)
    return child


def transcript(collected):
    lines = clean(collected).split('\n')
    # 第一行是 zsh 对输入的回显
    return '\n'.join(lines[1:]).rstrip('\n')


def record_shell(path):
    child = marked_shell()
    side = None      # 终端 A：放服务器这类一直占着终端的程序
    running = None   # 终端 A 里还没结束的那条命令对应的记录

    def finish_running():
        nonlocal running
        if running is not None:
            side.sendcontrol('c')
            side.expect(MARK)
            running['out'] = transcript(side.before)
            running = None

    records = []
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if line.startswith('##! '):
            # 准备动作：照常执行，但不进记录（清理上次的现场、固定提交时间等）
            child.sendline(line[4:])
            child.expect(MARK)
            settle(child, 0.3)
            continue
        if not line.strip() or line.startswith('##'):
            continue
        entry = json.loads(line) if line.startswith('{') else {'cmd': line}
        command = entry['cmd']
        if entry.get('terminal') == 'A':
            if side is None:
                side = marked_shell()
            finish_running()
            side.sendline(command)
            record = {'cmd': command, 'out': '', 'terminal': 'A'}
            try:
                side.expect(MARK, timeout=2)
                record['out'] = transcript(side.before)
            except pexpect.TIMEOUT:
                running = record
            records.append(record)
            continue
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
        records.append({'cmd': command, 'out': transcript(collected)})

    finish_running()
    for shell in (side, child):
        if shell is not None:
            shell.sendline('exit')
            shell.close()
    return records


def read_sessions(path):
    """会话文件：「## session [参数]」开一个新会话，其余非注释行是会话里的语句。返回 [(参数, [语句])]。"""
    sessions = []
    for raw in open(path, encoding='utf-8'):
        line = raw.rstrip('\n')
        if line.startswith('## session'):
            sessions.append((line[len('## session'):].strip(), []))
        elif line.strip() and not line.startswith('##'):
            if not sessions:
                sessions.append(('', []))
            sessions[-1][1].append(line)
    return [session for session in sessions if session[1]]


def record_sqlite(path):
    """sqlite3 命令行：每个会话重新打开一次数据库文件，记录每条语句之后打印的内容。"""
    records = []
    for database, statements in read_sessions(path):
        child = spawn_shell()
        child.sendline(f'cd {WORKDIR} 2>/dev/null; sqlite3 {database}')
        child.expect('sqlite> ')
        session = []
        for statement in statements:
            child.sendline(statement)
            if statement.strip() in ('.quit', '.exit'):
                session.append({'cmd': statement, 'out': ''})
                break
            child.expect('sqlite> ')
            lines = clean(child.before).split('\n')
            # 第一行是对输入的回显
            session.append({'cmd': statement, 'out': '\n'.join(lines[1:]).rstrip('\n')})
        else:
            child.sendline('.quit')
        settle(child, 0.4)
        child.close()
        records.append(session)
    return records


def record_gdb(path):
    """gdb：每个会话重新启动一次 gdb，记录每条命令之后打印的内容。"""
    records = []
    for program, statements in read_sessions(path):
        child = spawn_shell()
        child.sendline(f'cd {WORKDIR} 2>/dev/null; gdb -q {program}')
        child.expect(r'\(gdb\) ')
        session = []
        for statement in statements:
            child.sendline(statement)
            if statement.strip() in ('quit', 'q'):
                # 程序还在运行时 gdb 会再确认一次
                index = child.expect([r'\(y or n\) ', pexpect.TIMEOUT, pexpect.EOF], timeout=2)
                if index == 0:
                    session.append({'cmd': statement, 'out': transcript(child.before + child.after) + ' y'})
                    child.sendline('y')
                else:
                    session.append({'cmd': statement, 'out': ''})
                break
            collected = ''
            while True:
                index = child.expect([r'\(gdb\) ', r'\(y or \[n\]\) '])
                collected += child.before
                if index == 0:
                    break
                collected += child.after + 'n\n'
                child.sendline('n')
                child.readline()  # 回显的 n
            session.append({'cmd': statement, 'out': transcript(collected)})
        else:
            child.sendline('quit')
        settle(child, 0.4)
        child.close()
        records.append(session)
    return records


def record_python(path):
    """Python 交互模式：每个会话开一个新的解释器，记录每条语句之后打印的内容。"""
    records = []
    for _, statements in read_sessions(path):
        child = spawn_shell()
        child.sendline(f'cd {WORKDIR} 2>/dev/null; python3')
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
    paths = [arg for arg in args if not arg.startswith('--')]
    if len(paths) != 1:
        sys.exit(__doc__)
    recorder = record_python if '--python' in args else record_sqlite if '--sqlite' in args else record_gdb if '--gdb' in args else record_shell
    records = recorder(paths[0])
    json.dump(records, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
