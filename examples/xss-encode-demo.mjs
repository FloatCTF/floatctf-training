// 教学演示：不同上下文的最小输出编码差异
function htmlEncode(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsStringEscape(value) {
  return String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('</', '<\\/');
}

const payload = `"><img src=x onerror=alert(1)>`;
console.log('HTML 上下文：', htmlEncode(payload));
console.log('JS 字符串上下文：', jsStringEscape(payload));
console.log('说明：编码必须匹配输出上下文；错误上下文编码仍可能被解释为代码。');
