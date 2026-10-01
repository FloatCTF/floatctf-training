import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

// 防御回归：只执行参数化查询；数据库在当前进程内存中，使用虚构数据。
const db = new DatabaseSync(':memory:');
try {
  db.exec('CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
  const insert = db.prepare('INSERT INTO contacts (name) VALUES (?)');
  for (const name of ['Alice', "O'Reilly", '课程;记录']) insert.run(name);
  const find = db.prepare('SELECT id, name FROM contacts WHERE name = ?');
  assert.equal(find.get('Alice').name, 'Alice');
  console.log('PASS 普通值精确匹配');
  assert.equal(find.get("O'Reilly").name, "O'Reilly");
  console.log('PASS 单引号作为普通数据保存与查询');
  assert.equal(find.get('课程;记录').name, '课程;记录');
  console.log('PASS 分号作为普通数据保存与查询');
  assert.equal(find.get('未登记用户'), undefined);
  console.log('PASS 未登记值返回空结果');

  const SORTS = Object.freeze({ id: 'id', name: 'name' });
  function list(sortKey, limit) {
    if (!Object.hasOwn(SORTS, sortKey)) throw new Error('unsupported sort');
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('invalid limit');
    return db.prepare(`SELECT id, name FROM contacts ORDER BY ${SORTS[sortKey]} LIMIT ?`).all(limit);
  }
  assert.equal(list('id', 2).length, 2);
  assert.throws(() => list('unknown', 2), /unsupported sort/);
  assert.throws(() => list('id', 0), /invalid limit/);
  console.log('PASS 标识符映射与数量边界');
  console.log('完成：5 组防御检查通过');
} finally {
  db.close();
}
