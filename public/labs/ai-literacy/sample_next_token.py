"""第 3 课实验：手算温度缩放、top-p 截断、交叉熵与困惑度。"""

import math
import random

# 与页面采样实验台一致：T = 1 时概率为 58% / 21% / 13% / 8%
CANDIDATES = [
    ("测试", 0.58),
    ("构建", 0.21),
    ("扫描", 0.13),
    ("删除", 0.08),
]
LOGITS = [math.log(p) for _, p in CANDIDATES]


def softmax(logits: list[float], temperature: float) -> list[float]:
    scaled = [z / temperature for z in logits]
    peak = max(scaled)
    exps = [math.exp(v - peak) for v in scaled]
    total = sum(exps)
    return [v / total for v in exps]


def top_p_filter(tokens: list[str], probs: list[float], top_p: float) -> list[tuple[str, float]]:
    ranked = sorted(zip(tokens, probs), key=lambda item: item[1], reverse=True)
    kept, acc = [], 0.0
    for token, p in ranked:
        kept.append((token, p))
        acc += p
        if acc >= top_p:
            break
    return kept


def sample_many(tokens: list[str], probs: list[float], count: int, seed: int) -> list[str]:
    rng = random.Random(seed)
    return rng.choices(tokens, weights=probs, k=count)


def main() -> None:
    tokens = [tok for tok, _ in CANDIDATES]
    print("1. 不同温度下的概率分布与 top-p = 0.80 保留池：")
    for temp in (0.3, 1.0, 2.0):
        probs = softmax(LOGITS, temp)
        row = "  ".join(f"{tok}:{p * 100:4.1f}%" for tok, p in zip(tokens, probs))
        kept = [tok for tok, _ in top_p_filter(tokens, probs, top_p=0.80)]
        print(f"  T={temp:.1f} -> {row}  | top-p 保留: {'/'.join(kept)}")

    p_target = CANDIDATES[0][1]
    loss = -math.log(p_target)
    ppl = math.exp(loss)
    print(f"\n2. 真实下一个词是「测试」(p = {p_target:.2f})：")
    print(f"  交叉熵损失 -ln(p) = {loss:.3f}，单步困惑度 exp(loss) = {ppl:.2f}")

    print("\n3. 关闭 top-p 截断（top_p = 1.0），固定随机种子连续抽 8 次：")
    for temp in (0.3, 2.0):
        draws = sample_many(tokens, softmax(LOGITS, temp), count=8, seed=42)
        print(f"  T={temp:.1f}: {' '.join(draws)}")


if __name__ == "__main__":
    main()
