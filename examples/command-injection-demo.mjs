import { isIP } from 'node:net';

// 教学演示：shell 拼接与受约束 argv 设计。脚本不启动任何进程。
function vulnerableBuild(host) {
  return `ping -c 1 ${host}`;
}

function safeInvocation(host) {
  if (isIP(host) === 0) return { accepted: false, reason: '只允许 IP 字面量' };
  return {
    accepted: true,
    file: '/usr/bin/ping',
    args: ['-c', '1', '--', host],
    options: { shell: false, timeout: 2000, maxBuffer: 65_536 },
  };
}

const payload = '127.0.0.1; id';
console.log('脆弱命令串：', vulnerableBuild(payload));
console.log('恶意输入：', JSON.stringify(safeInvocation(payload)));
console.log('选项输入：', JSON.stringify(safeInvocation('-f')));
console.log('合法输入：', JSON.stringify(safeInvocation('127.0.0.1')));
console.log('说明：固定程序、禁用 shell、校验参数语义，并限制超时与输出。');
