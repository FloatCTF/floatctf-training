import { isIP } from 'node:net';
import { createServer } from 'node:http';

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

async function guardedFetch(rawUrl) {
  const target = new URL(rawUrl);
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('协议不在允许范围');
  if (isIP(target.hostname) === 4 && isPrivateIpv4(target.hostname)) throw new Error('已阻止私有地址');
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
    throw new Error('安全流程未阻止私有地址');
  } catch (error) {
    if (error.message === '安全流程未阻止私有地址') throw error;
    console.log(`安全流程：${error.message}`);
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
