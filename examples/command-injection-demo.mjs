// 教学演示：shell 拼接 vs 参数数组（不调用真实危险命令）
function vulnerableBuild(host) {
  return `ping -c 1 ${host}`;
}

function safeArgv(host) {
  // 参数数组语义：host 只是一个参数，不能引入新 token
  return { argv: ['ping', '-c', '1', host], note: '由进程 API 直接传参，不经 shell 解析' };
}

const payload = '127.0.0.1; id';
console.log('脆弱命令串：', vulnerableBuild(payload));
console.log('安全参数：', JSON.stringify(safeArgv(payload)));
console.log('说明：真实环境应使用 spawn 的 argv 形式，并限制 host 白名单。');
