"""第 5 课实验：纯 Python 实现余弦检索（与页面沙盒同源）+ 提示缓存账本。"""

import math

DOCS = [
    ("D1", "超时重试与退避", 0.86, 0.28, True),
    ("D2", "熔断器与请求期限", 0.72, 0.56, True),
    ("D3", "提示缓存", -0.06, 0.88, False),
    ("D4", "小模型路由", -0.38, 0.82, False),
    ("D5", "输入护栏", -0.86, -0.24, False),
    ("D6", "最小权限工具", -0.64, -0.60, False),
    ("D7", "界面动效规范", 0.24, -0.82, False),
]
QUERY = ("接口超时怎么处理？", 0.90, 0.34)


def cosine(ax: float, ay: float, bx: float, by: float) -> float:
    return (ax * bx + ay * by) / (math.hypot(ax, ay) * math.hypot(bx, by))


def main() -> None:
    q_text, qx, qy = QUERY
    ranked = sorted(
        [(cosine(qx, qy, x, y), doc_id, title, rel) for doc_id, title, x, y, rel in DOCS],
        reverse=True,
    )
    print(f"查询：{q_text}")
    for k in (2, 5):
        hits = ranked[:k]
        relevant = sum(1 for _, _, _, rel in hits if rel)
        names = ", ".join(f"{doc_id}({score:+.2f})" for score, doc_id, _, _ in hits)
        print(f"  top-{k}: 有效占比 {relevant}/{k} ({relevant / k * 100:.0f}%) -> {names}")

    # 提示缓存成本对照（以支持 4,096 token 起步门槛且 5 分钟缓存写 1.25x / 读 0.1x 的模型为例）
    prefix_tokens = 4096
    calls = 100  # 假设 1 次写入 + 有效期内连续 99 次命中
    base_cost = prefix_tokens * calls
    cached_cost = prefix_tokens * 1.25 + prefix_tokens * 0.10 * (calls - 1)
    saving = (1 - cached_cost / base_cost) * 100
    print(f"\n{prefix_tokens} token 固定前缀（满足最低缓存门槛，有效期内连续调用 {calls} 次）：")
    print(f"  未缓存等值输入: {base_cost:,.0f} token 单位")
    print(f"  开启缓存等值输入: {cached_cost:,.0f} token 单位（节省 {saving:.1f}%）")


if __name__ == "__main__":
    main()
