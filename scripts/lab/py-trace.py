#!/usr/bin/env python3
"""逐行执行一个 Python 脚本，记录每一步之后的名字、对象和输出，生成 CodeStepper 组件用的数据。

可视化里的每一步都来自真实执行，不靠手工推演：
  python3 scripts/lab/py-trace.py public/labs/<课 id>/names.py                 打印步骤清单，用来写解说
  python3 scripts/lab/py-trace.py public/labs/<课 id>/names.py notes.json > src/data/steppers/<名字>.json

notes.json 是一个字符串数组，每一步一句解说，数量必须和步骤数相等。
每一步的含义：高亮的那一行刚执行完，状态是执行完之后的样子。调用函数时，调用行会出现两次：
第一次是进入函数（新栈帧里参数已绑定），第二次是函数返回后这一行执行完。
被追踪的脚本不能调用 input()。
"""
import inspect
import io
import json
import os
import sys
import types


def describe(value):
    if isinstance(value, types.FunctionType):
        return '函数', f'{value.__name__}{inspect.signature(value)}'
    if isinstance(value, types.ModuleType):
        return '模块', value.__name__
    return type(value).__name__, repr(value)


def run(path):
    filename = os.path.abspath(path)
    source = open(filename, encoding='utf-8').read()
    code = compile(source, filename, 'exec')
    events = []
    output = io.StringIO()
    refs = {}
    alive = []  # 留住对象，避免 id 被回收后复用

    def ref_of(value):
        key = id(value)
        if key not in refs:
            refs[key] = len(refs) + 1
            alive.append(value)
        return refs[key]

    def snapshot(frame, event, arg):
        chain = []
        current = frame
        while current is not None and current.f_code.co_filename == filename:
            chain.append(current)
            current = current.f_back
        chain.reverse()
        objects = {}
        frames = []
        for item in chain:
            names = []
            for name, value in item.f_locals.items():
                if name.startswith('__'):
                    continue
                ref = ref_of(value)
                kind, text = describe(value)
                objects[str(ref)] = {'type': kind, 'repr': text}
                names.append({'name': name, 'ref': ref})
            frames.append({
                'name': '全局' if item.f_code.co_name == '<module>' else item.f_code.co_name,
                'line': item.f_lineno,
                'names': names,
            })
        record = {'event': event, 'line': frame.f_lineno, 'frames': frames, 'objects': objects, 'stdout': output.getvalue()}
        if event == 'return' and frame.f_code.co_name != '<module>':
            kind, text = describe(arg)
            record['returned'] = {'type': kind, 'repr': text}
        if event == 'exception':
            record['raised'] = f'{arg[0].__name__}: {arg[1]}'
        events.append(record)

    def tracer(frame, event, arg):
        if frame.f_code.co_filename != filename:
            return None
        if event in ('line', 'return', 'exception'):
            snapshot(frame, event, arg)
        return tracer

    error = None
    stdout = sys.stdout
    sys.stdout = output
    sys.settrace(tracer)
    try:
        exec(code, {'__name__': '__main__', '__file__': filename})
    except Exception as exc:  # 脚本本身抛出的未捕获异常也是要展示的内容
        error = f'{type(exc).__name__}: {exc}'
    finally:
        sys.settrace(None)
        sys.stdout = stdout

    steps = []
    for index in range(1, len(events)):
        previous, current = events[index - 1], events[index]
        if previous['event'] == 'return':
            if len(previous['frames']) < 2:
                continue
            line = previous['frames'][-2]['line']  # 函数返回后，调用它的那一行才算执行完
        else:
            line = previous['line']
        step = {
            'line': line,
            'frames': [{'name': frame['name'], 'names': frame['names']} for frame in current['frames']],
            'objects': current['objects'],
            'stdout': current['stdout'],
        }
        if 'returned' in current:
            step['returned'] = current['returned']
        if current['event'] == 'exception':
            step['raised'] = current['raised']
        steps.append(step)
    # 抛出异常时解释器会连发两个事件（抛出、离开这一行），合并成一步
    merged = []
    for step in steps:
        last = merged[-1] if merged else None
        if last and last.get('raised') and not step.get('returned') and (last['line'], last['frames'], last['stdout']) == (step['line'], step['frames'], step['stdout']):
            continue
        merged.append(step)
    return {'source': source.rstrip('\n').split('\n'), 'steps': merged, 'error': error}


def summarize(trace):
    lines = trace['source']
    for index, step in enumerate(trace['steps'], 1):
        frames = ' | '.join(
            f"{frame['name']}: " + ', '.join(f"{name['name']}→{trace_repr(step, name['ref'])}" for name in frame['names'])
            for frame in step['frames']
        )
        extra = ''
        if 'returned' in step:
            extra += f"  返回 {step['returned']['repr']}"
        if 'raised' in step:
            extra += f"  抛出 {step['raised']}"
        print(f"{index:>2}. 第 {step['line']} 行 `{lines[step['line'] - 1].strip()}`{extra}\n      {frames}\n      输出: {step['stdout']!r}")
    if trace['error']:
        print('未捕获的异常:', trace['error'])


def trace_repr(step, ref):
    item = step['objects'][str(ref)]
    return f"#{ref} {item['repr']}"


def main():
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    trace = run(sys.argv[1])
    if len(sys.argv) == 2:
        summarize(trace)
        return
    notes = json.load(open(sys.argv[2], encoding='utf-8'))
    if len(notes) != len(trace['steps']):
        sys.exit(f"解说有 {len(notes)} 条，步骤有 {len(trace['steps'])} 步，数量必须相等。")
    for step, note in zip(trace['steps'], notes):
        step['note'] = note
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    trace['file'] = os.path.relpath(os.path.abspath(sys.argv[1]), root)
    json.dump(trace, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
