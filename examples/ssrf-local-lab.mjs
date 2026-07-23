import { isIP } from 'node:net';
import { createServer } from 'node:http';

class TargetRejectedError extends Error {}

function isLoopbackIpv4Literal(address) {
  if (isIP(address) !== 4) return false;
  const [firstOctet] = address.split('.').map(Number);
  return firstOctet === 127;
}

async function guardedFetch(rawUrl) {
  const target = new URL(rawUrl);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('协议不在允许范围');
  if (target.username || target.password) throw new Error('URL 不允许包含用户信息');
  if (isIP(target.hostname) !== 4) throw new Error('教学校验器只接受 IPv4 字面量');
  if (isLoopbackIpv4Literal(target.hostname)) throw new TargetRejectedError('已阻止环回 IPv4 地址');
  return fetch(target, { redirect: 'manual' });
}

const server = createServer((request, response) => {
  if (request.url === '/private') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('training-secret');
    return;
  }
  response.writeHead(404).end('missing');
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('无法确定本地实验端口');
const labUrl = `http://127.0.0.1:${address.port}/private`;

try {
  const vulnerableResponse = await fetch(labUrl);
  console.log(`脆弱流程：${await vulnerableResponse.text()}`);
  try {
    await guardedFetch(labUrl);
    throw new Error('安全流程未阻止环回地址');
  } catch (error) {
    if (!(error instanceof TargetRejectedError)) throw error;
    console.log(`安全流程：${error.message}`);
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
