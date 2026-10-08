#!/usr/bin/env python3
"""在 Kali 容器里用 gdb 逐行执行一个 C 程序，记录每一步之后栈帧、变量、堆块的真实状态，
生成 CodeStepper 组件内存视图（view="memory"）用的数据。

可视化里的地址、取值、栈帧的出现和消失都来自真实执行，不靠手工推演：
  python3 scripts/lab/c-trace.py public/labs/<课 id>/swap.c                    打印步骤清单，用来写解说
  python3 scripts/lab/c-trace.py public/labs/<课 id>/swap.c notes.json > src/data/steppers/<名字>.json

  --flags "-fno-stack-protector"   追加编译选项。默认用 gcc -g -O0，和课上教的编译方式一致。

notes.json 是一个字符串数组，每一步一句解说，数量必须和步骤数相等。
每一步的含义：高亮的那一行刚执行完，状态是执行完之后的样子。调用函数时，调用行会出现两次：
第一次是进入函数（新栈帧里参数已有值），第二次是函数返回后这一行执行完。
被追踪的程序不能读键盘输入。程序因信号（如段错误）终止时，最后一步带 signal 字段。

容器名用环境变量 KALI_CONTAINER 指定，默认 kali-lab。容器要能让 gdb 关闭地址随机化
（docker run 时加 --cap-add=SYS_PTRACE --security-opt seccomp=unconfined），这样每次生成的地址相同。
"""
import json
import os
import subprocess
import sys
import textwrap

CONTAINER = os.environ.get('KALI_CONTAINER', 'kali-lab')
WORK = '/tmp/ctrace'

# 这段脚本在容器里由 gdb 执行
GDB_SCRIPT = r'''
import gdb, json, os

SRC = os.environ['CTRACE_SOURCE']
MAX = int(os.environ.get('CTRACE_MAX', '300'))
for command in ('set pagination off', 'set confirm off', 'set debuginfod enabled off', 'set style enabled off', 'set print address on'):
    gdb.execute(command)

heap = {}   # 起始地址 -> {size, freed, id}
signal = [None]
alive = [set()]   # 上一步已经显示过的块内变量（如 for 循环的 i），块没结束就继续显示


def in_user(frame):
    sal = frame.find_sal()
    return sal.symtab is not None and os.path.basename(sal.symtab.filename) == SRC


class AllocFinish(gdb.FinishBreakpoint):
    def __init__(self, frame, size):
        super().__init__(frame, internal=True)
        self.silent = True
        self.size = size

    def stop(self):
        address = int(gdb.parse_and_eval('$rax'))
        if address:
            heap[address] = {'size': self.size, 'freed': False, 'id': len(heap) + 1}
        return False


class AllocBreak(gdb.Breakpoint):
    def __init__(self, name, sized):
        super().__init__(name, internal=True)
        self.silent = True
        self.sized = sized

    def stop(self):
        frame = gdb.newest_frame()
        caller = frame.older()
        if caller is not None and in_user(caller):
            AllocFinish(frame, self.sized())
        return False


class FreeBreak(gdb.Breakpoint):
    def __init__(self):
        super().__init__('free', internal=True)
        self.silent = True

    def stop(self):
        caller = gdb.newest_frame().older()
        if caller is not None and in_user(caller):
            address = int(gdb.parse_and_eval('$rdi'))
            if address in heap:
                heap[address]['freed'] = True
        return False


def on_stop(event):
    if isinstance(event, gdb.SignalEvent):
        signal[0] = event.stop_signal


def char_text(code):
    code &= 0xff
    names = {0: "'\\0'", 10: "'\\n'", 9: "'\\t'", 13: "'\\r'", 39: "'\\''", 92: "'\\\\'"}
    if code in names:
        return names[code]
    if 32 <= code < 127:
        return "'" + chr(code) + "'"
    return "'\\x%02x'" % code


def describe(value):
    kind = value.type.strip_typedefs()
    code = kind.code
    out = {'type': str(value.type), 'addr': int(value.address) if value.address is not None else 0, 'size': kind.sizeof}
    if code == gdb.TYPE_CODE_PTR:
        address = int(value)
        out['pointer'] = address
        target = kind.target().strip_typedefs()
        out['targetSize'] = target.sizeof if target.code != gdb.TYPE_CODE_VOID else 1
        out['targetType'] = str(kind.target())
        if target.code == gdb.TYPE_CODE_INT and target.sizeof == 1 and address:
            try:
                out['string'] = value.string(errors='replace', length=-1)[:40]
            except gdb.error:
                pass
    elif code == gdb.TYPE_CODE_ARRAY:
        low, high = kind.range()
        out['cells'] = [describe(value[index]) for index in range(low, high + 1)]
    elif code == gdb.TYPE_CODE_STRUCT:
        out['fields'] = [dict(describe(value[field.name]), name=field.name) for field in kind.fields()]
    elif code == gdb.TYPE_CODE_FLT:
        out['value'] = repr(float(value))
    elif code in (gdb.TYPE_CODE_INT, gdb.TYPE_CODE_CHAR, gdb.TYPE_CODE_BOOL, gdb.TYPE_CODE_ENUM):
        number = int(value)
        out['value'] = char_text(number) if kind.sizeof == 1 else str(number)
        if kind.sizeof == 1:
            out['code'] = number & 0xff
    else:
        out['value'] = str(value)
    return out


def snapshot():
    chain = []
    frame = gdb.newest_frame()
    while frame is not None:
        if in_user(frame):
            chain.append(frame)
        frame = frame.older()
    chain.reverse()
    frames = []
    shown = set()
    for depth, frame in enumerate(chain):
        line = frame.find_sal().line
        items = []
        seen = set()
        try:
            block = frame.block()
        except RuntimeError:
            block = None
        while block is not None and not block.is_global and not block.is_static:
            for symbol in block:
                if not (symbol.is_variable or symbol.is_argument) or symbol.name in seen:
                    continue
                seen.add(symbol.name)
                # 还没执行到声明那一行的局部变量先不显示；循环回到 for 那一行时，已经显示过的循环变量保留
                key = (depth, frame.name(), symbol.name)
                if not symbol.is_argument and symbol.line >= line and key not in alive[0]:
                    continue
                shown.add(key)
                try:
                    item = dict(describe(symbol.value(frame)), name=symbol.name, declared=symbol.line, argument=bool(symbol.is_argument))
                except (gdb.error, RuntimeError):
                    continue
                items.append(item)
            if block.function is not None:
                break
            block = block.superblock
        items.sort(key=lambda item: (not item['argument'], item['declared']))
        frames.append({'name': frame.name(), 'line': line, 'vars': items})

    blocks = []
    known = {}

    def collect(item):
        if 'pointer' in item:
            known.setdefault(item['pointer'], item)
        for child in item.get('cells', []) + item.get('fields', []):
            collect(child)

    for frame in frames:
        for item in frame['vars']:
            collect(item)
    for address, info in sorted(heap.items()):
        block = {'id': info['id'], 'addr': address, 'size': info['size'], 'freed': info['freed']}
        owner = known.get(address)
        if owner is not None and not info['freed'] and owner['targetSize'] > 0:
            count = max(1, info['size'] // owner['targetSize'])
            try:
                kind = gdb.lookup_type('char').pointer() if owner['targetType'] == 'void' else None
                pointer = gdb.Value(address).cast(gdb.parse_and_eval('(%s *) 0' % owner['targetType']).type if kind is None else kind)
                block['cells'] = [describe((pointer + index).dereference()) for index in range(count)]
                for child in block['cells']:
                    collect(child)
            except (gdb.error, RuntimeError):
                pass
        blocks.append(block)
    alive[0] = shown
    stack_pointer = int(gdb.parse_and_eval('$sp'))
    return {'frames': frames, 'heap': blocks, 'sp': stack_pointer}


def flush_output():
    try:
        gdb.execute('call (int) fflush((void *) 0)', to_string=True)
    except gdb.error:
        pass
    try:
        return open('stdout.txt', encoding='utf-8', errors='replace').read()
    except OSError:
        return ''


def user_line():
    frame = gdb.newest_frame()
    return frame.find_sal().line if in_user(frame) else None


gdb.events.stop.connect(on_stop)
gdb.execute('break main')
gdb.execute('run > stdout.txt', to_string=True)
AllocBreak('malloc', lambda: int(gdb.parse_and_eval('$rdi')))
AllocBreak('calloc', lambda: int(gdb.parse_and_eval('$rdi')) * int(gdb.parse_and_eval('$rsi')))
FreeBreak()

steps = []
exit_code = None
while len(steps) < MAX:
    line = user_line()
    if line is None:
        break
    try:
        gdb.execute('step', to_string=True)
    except gdb.error:
        break
    if gdb.selected_inferior().pid == 0:
        break
    if signal[0] is not None:
        state = snapshot()
        state.update(line=line, stdout=flush_output() if signal[0] != 'SIGSEGV' else open('stdout.txt').read(), signal=signal[0])
        steps.append(state)
        break
    if user_line() is None:
        # 离开了用户代码：main 已经返回
        state = {'frames': [], 'heap': [dict(id=info['id'], addr=address, size=info['size'], freed=info['freed']) for address, info in sorted(heap.items())], 'sp': 0}
        state.update(line=line, stdout=flush_output())
        steps.append(state)
        break
    state = snapshot()
    state.update(line=line, stdout=flush_output())
    steps.append(state)

if gdb.selected_inferior().pid != 0 and signal[0] is None:
    try:
        gdb.execute('continue', to_string=True)
    except gdb.error:
        pass
final = ''
try:
    final = open('stdout.txt', encoding='utf-8', errors='replace').read()
except OSError:
    pass
json.dump({'steps': steps, 'finalStdout': final}, open('trace.json', 'w'))
'''


def docker(*args, **kwargs):
    return subprocess.run(['docker', *args], check=True, text=True, capture_output=True, **kwargs)


def short(address):
    return '…' + ('%x' % address)[-4:]


def render(item, labels, heap_ids, stack_low):
    """把 gdb 取到的原始值整理成组件要的形状，并把指针的目标换成一句人话。"""
    out = {'type': item['type'], 'addr': short(item['addr']), 'size': item['size']}
    if 'name' in item:
        out['name'] = item['name']
    if 'pointer' in item:
        address = item['pointer']
        if address == 0:
            out['value'] = 'NULL'
            out['target'] = '不指向任何东西'
        else:
            out['value'] = short(address)
            if address in labels:
                out['target'] = labels[address]
            elif 'string' in item and address < stack_low and not any(start <= address < start + size for start, size, _ in heap_ids):
                out['target'] = '字符串常量 ' + json.dumps(item['string'], ensure_ascii=False)
            elif address >= stack_low:
                out['target'] = '栈上一块已经没有主人的内存'
            else:
                out['target'] = '一个无法识别的地址'
    elif 'cells' in item:
        out['cells'] = [render(cell, labels, heap_ids, stack_low) for cell in item['cells']]
    elif 'fields' in item:
        out['fields'] = [render(field, labels, heap_ids, stack_low) for field in item['fields']]
    else:
        out['value'] = item['value']
    return out


def label_all(step):
    """给这一步里每一个有地址的东西起名字：main 的 x、main 的 buf[2]、堆块 ① 等。"""
    labels = {}

    def walk(item, name):
        labels.setdefault(item['addr'], name)
        for index, cell in enumerate(item.get('cells', [])):
            walk(cell, f'{name}[{index}]')
        for field in item.get('fields', []):
            walk(field, f"{name}.{field['name']}")

    for frame in step['frames']:
        for item in frame['vars']:
            walk(item, f"{frame['name']} 的 {item['name']}")
    heap_ids = []
    for block in step['heap']:
        mark = chr(0x2460 + block['id'] - 1)
        name = f"已释放的堆块 {mark}" if block['freed'] else f"堆块 {mark}"
        heap_ids.append((block['addr'], block['size'], name))
        labels[block['addr']] = name
        for index, cell in enumerate(block.get('cells', [])):
            if index:
                labels.setdefault(cell['addr'], f'{name} 的第 {index} 格')
            for field in cell.get('fields', []):
                labels.setdefault(field['addr'], f"{name} 的 {field['name']}") if index == 0 and field['addr'] != block['addr'] else None
    return labels, heap_ids


def main():
    args = sys.argv[1:]
    flags = ''
    if '--flags' in args:
        position = args.index('--flags')
        flags = args[position + 1]
        del args[position:position + 2]
    if not args:
        sys.exit(__doc__)
    path = args[0]
    name = os.path.basename(path)
    source = open(path, encoding='utf-8').read()

    docker('exec', '-u', 'kali', CONTAINER, 'sh', '-c', f'rm -rf {WORK} && mkdir -p {WORK}')
    docker('cp', path, f'{CONTAINER}:{WORK}/{name}')
    script = os.path.join(os.path.dirname(os.path.abspath(path)), '.ctrace-gdb.py')
    with open('/tmp/.ctrace-gdb.py', 'w', encoding='utf-8') as handle:
        handle.write(GDB_SCRIPT)
    docker('cp', '/tmp/.ctrace-gdb.py', f'{CONTAINER}:{WORK}/trace_gdb.py')
    docker('exec', '-u', 'root', CONTAINER, 'chown', '-R', 'kali:kali', WORK)
    compiled = subprocess.run(['docker', 'exec', '-u', 'kali', '-w', WORK, CONTAINER, 'sh', '-c', f'gcc -g -O0 {flags} -o prog {name} 2>&1'], text=True, capture_output=True)
    if compiled.returncode != 0:
        sys.exit('编译失败：\n' + compiled.stdout)
    run = subprocess.run(['docker', 'exec', '-u', 'kali', '-w', WORK, '-e', f'CTRACE_SOURCE={name}', CONTAINER, 'gdb', '-q', '-batch', '-x', 'trace_gdb.py', './prog'], text=True, capture_output=True)
    raw = subprocess.run(['docker', 'exec', '-u', 'kali', CONTAINER, 'cat', f'{WORK}/trace.json'], text=True, capture_output=True)
    if raw.returncode != 0:
        sys.exit('gdb 没有产出记录：\n' + run.stdout[-2000:] + run.stderr[-2000:])
    recorded = json.loads(raw.stdout)

    steps = []
    for step in recorded['steps']:
        labels, heap_ids = label_all(step)
        stack_low = step['sp'] - 4096 if step['sp'] else 1 << 62
        entry = {
            'line': step['line'],
            'frames': [{'name': frame['name'], 'vars': [render(item, labels, heap_ids, stack_low) for item in frame['vars']]} for frame in step['frames']],
            'heap': [],
            'stdout': step['stdout'],
        }
        for block in step['heap']:
            cells = [render(cell, labels, heap_ids, stack_low) for cell in block.get('cells', [])]
            entry['heap'].append({'id': block['id'], 'addr': short(block['addr']), 'size': block['size'], 'freed': block['freed'], 'cells': cells})
        if step.get('signal'):
            entry['signal'] = step['signal']
        steps.append(entry)

    def brief(item):
        if 'cells' in item:
            return '[' + ' '.join(brief(cell) for cell in item['cells']) + ']'
        if 'fields' in item:
            return '{' + ', '.join(f"{field['name']}={brief(field)}" for field in item['fields']) + '}'
        return item.get('value', '?') + (' → ' + item['target'] if 'target' in item else '')

    lines = source.rstrip('\n').split('\n')
    if len(args) < 2:
        for index, step in enumerate(steps, 1):
            state = '; '.join(f"{frame['name']}(" + ', '.join(f"{item['name']}={brief(item)}" for item in frame['vars']) + ')' for frame in step['frames'])
            heap = ' | 堆：' + ', '.join(f"{chr(0x2460 + block['id'] - 1)}{'(已释放)' if block['freed'] else ''}{block['size']}字节[" + ' '.join(brief(cell) for cell in block['cells']) + ']' for block in step['heap']) if step['heap'] else ''
            flag = f" !! {step['signal']}" if step.get('signal') else ''
            print(f"{index:2d}. 第 {step['line']:2d} 行  {lines[step['line'] - 1].strip():<44} {state}{heap}  输出={step['stdout']!r}{flag}")
        print(f'共 {len(steps)} 步；程序的完整输出：{recorded["finalStdout"]!r}')
        return

    notes = json.load(open(args[1], encoding='utf-8'))
    if len(notes) != len(steps):
        sys.exit(f'解说有 {len(notes)} 条，步骤有 {len(steps)} 步，数量必须相等。')
    for step, note in zip(steps, notes):
        step['note'] = note
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    trace = {'kind': 'c-memory', 'file': os.path.relpath(os.path.abspath(path), root), 'flags': flags, 'source': lines, 'steps': steps, 'error': None}
    json.dump(trace, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
