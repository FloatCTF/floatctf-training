import { DatabaseSync } from 'node:sqlite';

// 教学演示：真实内存 SQLite 中的字符串拼接与参数化查询。
// 数据库只存在于当前进程，不连接网络，也不写入磁盘。
const database = new DatabaseSync(':memory:');
database.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );
  INSERT INTO users (username, password, role) VALUES
    ('alice', 'correct-password-for-demo', 'user'),
    ('admin', 'admin-password-for-demo', 'admin');
`);

function vulnerableLogin(username, password) {
  const sql = `SELECT username, role FROM users WHERE username = '${username}' AND password = '${password}'`;
  return { sql, row: database.prepare(sql).get() ?? null };
}

function safeLogin(username, password) {
  const statement = database.prepare(
    'SELECT username, role FROM users WHERE username = ? AND password = ?',
  );
  return statement.get(username, password) ?? null;
}

const attackUser = "admin' --";
const attackPassword = 'wrong-password';
const vulnerable = vulnerableLogin(attackUser, attackPassword);

console.log('脆弱查询：', vulnerable.sql);
console.log('脆弱结果：', JSON.stringify(vulnerable.row));
console.log('参数化结果：', JSON.stringify(safeLogin(attackUser, attackPassword)));
console.log('合法结果：', JSON.stringify(safeLogin('alice', 'correct-password-for-demo')));

database.close();
