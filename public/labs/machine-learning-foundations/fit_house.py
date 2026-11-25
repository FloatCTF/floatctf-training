"""第 1 课实验：用纯 Python 跑一遍标准化、MSE 与梯度下降。"""

HOUSES = [
    (50, 205),
    (68, 262),
    (85, 334),
    (102, 401),
]


def standardize(xs: list[float]) -> tuple[list[float], float, float]:
    mean = sum(xs) / len(xs)
    std = (sum((x - mean) ** 2 for x in xs) / len(xs)) ** 0.5
    return [(x - mean) / std for x in xs], mean, std


def mse(xs: list[float], ys: list[float], w: float, b: float) -> float:
    return sum((w * x + b - y) ** 2 for x, y in zip(xs, ys)) / len(xs)


def train(xs: list[float], ys: list[float], lr: float, steps: int) -> tuple[float, float]:
    w, b = 0.0, 0.0
    n = len(xs)
    for step in range(steps + 1):
        loss = mse(xs, ys, w, b)
        if step in (0, 5, 20, steps):
            print(f"  step={step:2d}  w_std={w:7.2f}  b_std={b:7.2f}  MSE={loss:10.2f}")
        if loss > 1e8:
            print(f"  -> step={step} 时 MSE={loss:.2e} 超过 1e8，提前停止（学习率过大）")
            break
        if step == steps:
            break
        dw = (2 / n) * sum((w * x + b - y) * x for x, y in zip(xs, ys))
        db = (2 / n) * sum((w * x + b - y) for x, y in zip(xs, ys))
        w -= lr * dw
        b -= lr * db
    return w, b


def main() -> None:
    raw_x = [area for area, _ in HOUSES]
    ys = [price for _, price in HOUSES]
    xs, mean_x, std_x = standardize(raw_x)

    print("实验 A：合适学习率 (lr = 0.10)")
    w_std, b_std = train(xs, ys, lr=0.10, steps=40)
    w_raw = w_std / std_x
    b_raw = b_std - w_std * mean_x / std_x
    print(f"换算回原始面积：价格 ≈ {w_raw:.2f} × 面积 + ({b_raw:.1f})\n")

    print("实验 B：学习率过大 (lr = 1.15)")
    train(xs, ys, lr=1.15, steps=40)


if __name__ == "__main__":
    main()
