#!/usr/bin/env python3
"""把容器里的 DNS 查询原样转发给公共的 DNS over HTTPS 服务，让 dig、ping、curl 拿到真实的解析结果。

为什么需要它：采集环境所在的宿主机用了透明代理，所有 DNS 查询都被代理截住并返回占位地址
（198.18.0.0/15），连不存在的域名也会「解析成功」。这样的输出不能写进课程页面。
本脚本在容器里监听 127.0.0.1:53（只用 UDP，免得在 ss -tln 的输出里多出一行），把收到的 DNS 报文不加修改地用 HTTPS 发给
上游（RFC 8484 的 application/dns-message），再把应答原样交还。dig 等工具照常运行，
看到的记录、应答状态与学员在普通网络里看到的一致。

它只是采集环境的补丁，不是课程内容，学员不需要它。

用法（容器内，root）：
  python3 doh-forwarder.py &
  printf 'nameserver 127.0.0.1\n' > /etc/resolv.conf

上游默认是 https://1.1.1.1/dns-query，可用环境变量 DOH_UPSTREAM 改。上游必须写 IP：
容器的解析器已经指向本脚本，上游若写域名，本脚本解析它时会问回自己。
"""
import os
import socketserver
import urllib.request

UPSTREAM = os.environ.get('DOH_UPSTREAM', 'https://1.1.1.1/dns-query')


def resolve(message):
    request = urllib.request.Request(
        UPSTREAM, data=message,
        headers={'Content-Type': 'application/dns-message', 'Accept': 'application/dns-message'},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.read()


class UdpHandler(socketserver.BaseRequestHandler):
    def handle(self):
        message, sock = self.request
        try:
            sock.sendto(resolve(message), self.client_address)
        except OSError:
            pass  # 上游不可达时不应答，客户端会按超时处理


class Udp(socketserver.ThreadingUDPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    Udp(('127.0.0.1', 53), UdpHandler).serve_forever()
