// 教学演示：同一输入进入危险汇点、安全汇点与 URL 参数时的处理差异。
// 脚本只打印数据流，不创建 DOM，也不执行 payload。
const payload = `"><img src=x onerror=alert(1)>`;
const target = new URL('https://training.local/search');
target.searchParams.set('q', payload);

console.log('源字符串：', JSON.stringify(payload));
console.log('若写入 innerHTML：浏览器会把它解析成标签。这里会得到一个 img，并在加载失败时执行 onerror。');
console.log('若写入 textContent：浏览器把整段当作文本显示，不创建 img，也不注册 onerror。');
console.log('本脚本不创建 DOM，所以上面两句是解析规则，不是这次运行里已经发生的页面效果。');
console.log('URL 参数：', target.href);
console.log('说明：URLSearchParams 只做 URL 参数编码，不决定 HTML 如何解析。');
