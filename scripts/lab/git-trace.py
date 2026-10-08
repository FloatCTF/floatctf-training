#!/usr/bin/env python3
"""在临时目录里真实执行一串 git 命令，记录每一步之后工作区、暂存区和提交图的状态，生成 GitGraph 组件用的数据。

  python3 scripts/lab/git-trace.py scripts/lab/git-scenarios/<名字>.json > src/data/git-traces/<名字>.json

场景文件：
  {"setup": ["先悄悄执行的命令", ...],
   "steps": [{"run": ["这一步执行的命令", ...], "note": "一句解说"}, ...]}

作者、邮箱和提交时间是固定的，与课程页面重放时用的一致，所以同样的操作得到同样的提交哈希。
"""
import json
import os
import subprocess
import sys
import tempfile

IDENTITY = {
    'GIT_AUTHOR_NAME': 'Kali Student',
    'GIT_AUTHOR_EMAIL': 'student@example.com',
    'GIT_COMMITTER_NAME': 'Kali Student',
    'GIT_COMMITTER_EMAIL': 'student@example.com',
    'GIT_AUTHOR_DATE': '2026-10-01T10:00:00+08:00',
    'GIT_COMMITTER_DATE': '2026-10-01T10:00:00+08:00',
}


def git(args, cwd, env):
    return subprocess.run(['git', *args], cwd=cwd, env=env, capture_output=True, text=True)


def snapshot(repo, env):
    status = git(['status', '--porcelain=v1', '--ignored'], repo, env).stdout.splitlines()
    codes = {line[3:]: line[:2] for line in status}
    files = []
    for folder, dirs, names in os.walk(repo):
        dirs[:] = sorted(d for d in dirs if d != '.git')
        for name in sorted(names):
            path = os.path.relpath(os.path.join(folder, name), repo)
            code = codes.get(path, '  ')
            if code == '!!':
                state = 'ignored'
            elif code == '??':
                state = 'untracked'
            elif 'U' in code or code in ('AA', 'DD'):
                state = 'conflict'
            elif code[1] == 'M':
                state = 'modified'
            else:
                state = 'unchanged'
            files.append({'path': path, 'state': state})
    staged = []
    for path, code in codes.items():
        if code[0] in 'AMDR' and 'U' not in code and code not in ('AA', 'DD'):
            staged.append({'path': path, 'kind': {'A': 'new', 'M': 'modified', 'D': 'deleted', 'R': 'renamed'}[code[0]]})
    staged.sort(key=lambda item: item['path'])

    head_branch = git(['symbolic-ref', '--short', '-q', 'HEAD'], repo, env).stdout.strip()
    head_commit = git(['rev-parse', '-q', '--verify', '--short=7', 'HEAD'], repo, env).stdout.strip()
    refs = {}
    for line in git(['for-each-ref', '--format=%(refname:short)%09%(objectname:short=7)', 'refs/heads'], repo, env).stdout.splitlines():
        name, commit = line.split('\t')
        refs.setdefault(commit, []).append(name)
    # 主线：沿 main（没有就用当前分支）的第一父提交一路往回，画在第 0 道；其余提交画在第 1 道
    trunk_tip = 'main' if any('main' in names for names in refs.values()) else 'HEAD'
    trunk = set(git(['rev-list', '--first-parent', '--abbrev-commit', '--abbrev=7', trunk_tip], repo, env).stdout.split())
    commits = []
    log = git(['log', '--all', '--topo-order', '--format=%h%x09%p%x09%s', '--abbrev=7'], repo, env)
    for line in log.stdout.splitlines() if log.returncode == 0 else []:
        commit, parents, subject = line.split('\t')
        commits.append({
            'id': commit,
            'parents': parents.split(),
            'subject': subject,
            'refs': sorted(refs.get(commit, [])),
            'lane': 0 if commit in trunk else 1,
        })
    return {
        'files': files,
        'staged': staged,
        'commits': commits,
        'head': {'branch': head_branch or None, 'commit': head_commit or None},
        'merging': os.path.exists(os.path.join(repo, '.git', 'MERGE_HEAD')),
    }


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    scenario = json.load(open(sys.argv[1], encoding='utf-8'))
    with tempfile.TemporaryDirectory() as home:
        repo = os.path.join(home, 'toolbox')
        os.makedirs(repo)
        env = {**os.environ, **IDENTITY, 'HOME': home, 'GIT_CONFIG_NOSYSTEM': '1', 'LC_ALL': 'C.UTF-8'}
        env.pop('GIT_DIR', None)
        git(['config', '--global', 'init.defaultBranch', 'main'], home, env)
        git(['config', '--global', 'user.name', IDENTITY['GIT_AUTHOR_NAME']], home, env)
        git(['config', '--global', 'user.email', IDENTITY['GIT_AUTHOR_EMAIL']], home, env)

        def run(command):
            result = subprocess.run(command, shell=True, executable='/bin/bash', cwd=repo, env=env, capture_output=True, text=True)
            return result

        for command in scenario.get('setup', []):
            result = run(command)
            if result.returncode != 0:
                sys.exit(f'准备命令失败：{command}\n{result.stderr}')
        initial = snapshot(repo, env)
        steps = []
        for step in scenario['steps']:
            for command in step['run']:
                result = run(command)
                if result.returncode != 0 and not step.get('allowFailure'):
                    sys.exit(f'命令失败：{command}\n{result.stdout}{result.stderr}')
            steps.append({'commands': step['run'], 'note': step['note'], **snapshot(repo, env)})
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    json.dump({'scenario': os.path.relpath(os.path.abspath(sys.argv[1]), root), 'initial': initial, 'steps': steps}, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
