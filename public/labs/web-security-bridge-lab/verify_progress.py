#!/usr/bin/env python3
"""自动遍历 3 页 /api/audit 固定审计样本，汇总所有 flagged=true 的记录（关卡 4 参考脚本，显式绕过外部代理）。"""
import json
import urllib.request

# 显式使用空 ProxyHandler，避免继承宿主机 HTTP_PROXY/HTTPS_PROXY 环境变量
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

flagged = []
for page in range(1, 4):
    url = f"http://127.0.0.1:8099/api/audit?page={page}"
    with opener.open(url, timeout=3) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    for item in data["items"]:
        if item.get("flagged"):
            flagged.append({"page": page, **item})

print(json.dumps({"flagged_count": len(flagged), "flagged": flagged}, ensure_ascii=False, indent=2))
