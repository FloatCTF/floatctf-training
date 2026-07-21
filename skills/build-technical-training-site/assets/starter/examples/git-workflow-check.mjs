import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repository = mkdtempSync(join(tmpdir(), 'training-git-'));
const git = (...args) => execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();

try {
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Training Bot');
  git('config', 'user.email', 'training@example.invalid');
  writeFileSync(join(repository, 'notes.txt'), 'main\n');
  git('add', 'notes.txt');
  git('commit', '-m', 'base');
  git('switch', '-c', 'feature');
  writeFileSync(join(repository, 'feature.txt'), 'feature\n');
  git('add', 'feature.txt');
  git('commit', '-m', 'feature work');
  git('switch', 'main');
  writeFileSync(join(repository, 'main.txt'), 'main work\n');
  git('add', 'main.txt');
  git('commit', '-m', 'main work');
  git('merge', '--no-ff', 'feature', '-m', 'merge feature');
  const graph = git('log', '--graph', '--oneline', '--decorate', '--all');
  if (!graph.includes('merge feature') || !graph.includes('feature work')) throw new Error('提交图缺少预期节点');
  console.log(graph);
  console.log('Git 工作流验证通过。');
} finally {
  rmSync(repository, { recursive: true, force: true });
}
