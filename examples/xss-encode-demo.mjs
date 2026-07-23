// 教学演示：同一输入进入危险汇点、安全汇点与 URL 参数时的处理差异。
// 脚本只打印数据流，不创建 DOM，也不执行 payload。
const payload = `"><img src=x onerror=alert(1)>`;
const target = new URL('https://training.local/search');
target.searchParams.set('q', payload);

console.log('危险汇点：', `result.innerHTML = ${JSON.stringify(payload)}`);
console.log('安全汇点：', `result.textContent = ${JSON.stringify(payload)}`);
console.log('URL 参数：', target.href);
console.log('说明：textContent 把输入作为文本；URLSearchParams 只处理 URL 参数编码。');
