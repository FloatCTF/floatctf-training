// 教学演示：字符串拼接查询 vs 参数化查询（内存“数据库”，无网络）
const users = [
  { id: 1, username: 'alice', role: 'user' },
  { id: 2, username: 'admin', role: 'admin' },
];

function vulnerableLogin(username, password) {
  // 模拟错误写法：把输入拼进查询语义
  const expression = `username === '${username}' && password === '${password}'`;
  // 演示用：不执行任意代码，只展示拼接后的表达式会被如何改写
  return { expression, note: '若后端把该表达式当 SQL/代码执行，即可改写语义' };
}

function safeLogin(username, password) {
  // 参数化语义：用户名与密码始终是数据，不能改写比较结构
  const user = users.find((u) => u.username === username);
  const ok = Boolean(user) && password === 'correct-password-for-demo' && user.username === username;
  return { bound: { username, passwordLength: password.length }, authenticated: ok && user?.username === 'alice' };
}

const attackUser = "admin' OR '1'='1";
const attackPass = 'x';
console.log('脆弱表达：', vulnerableLogin(attackUser, attackPass).expression);
console.log('安全绑定：', JSON.stringify(safeLogin(attackUser, attackPass)));
console.log('合法登录：', JSON.stringify(safeLogin('alice', 'correct-password-for-demo')));
