"""第 2 课实验：零依赖手写 2-2-1 神经网络，用反向传播学会 XOR。"""

import math
import random

DATA = [
    (0.0, 0.0, 0.0),
    (0.0, 1.0, 1.0),
    (1.0, 0.0, 1.0),
    (1.0, 1.0, 0.0),
]


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def eval_mse(w: list[list[float]], bh: list[float], v: list[float], bo: float) -> float:
    total = 0.0
    for x1, x2, y in DATA:
        h1 = sigmoid(w[0][0] * x1 + w[0][1] * x2 + bh[0])
        h2 = sigmoid(w[1][0] * x1 + w[1][1] * x2 + bh[1])
        yhat = sigmoid(v[0] * h1 + v[1] * h2 + bo)
        total += (yhat - y) ** 2
    return total / len(DATA)


def main() -> None:
    rng = random.Random(7)
    # 2 个输入 -> 2 个隐藏单元 -> 1 个输出（共 9 个可训练参数）
    w = [[rng.uniform(-1.0, 1.0) for _ in range(2)] for _ in range(2)]
    bh = [0.0, 0.0]
    v = [rng.uniform(-1.0, 1.0) for _ in range(2)]
    bo = 0.0
    lr = 1.5

    print(f"epoch=   0  MSE={eval_mse(w, bh, v, bo):.5f}")
    for epoch in range(1, 3001):
        for x1, x2, y in DATA:
            # 1. 前向传播
            h1 = sigmoid(w[0][0] * x1 + w[0][1] * x2 + bh[0])
            h2 = sigmoid(w[1][0] * x1 + w[1][1] * x2 + bh[1])
            yhat = sigmoid(v[0] * h1 + v[1] * h2 + bo)

            # 2. 反向传播（链式法则逐层追责）
            d_out = 2.0 * (yhat - y) * yhat * (1.0 - yhat)
            d_h1 = d_out * v[0] * h1 * (1.0 - h1)
            d_h2 = d_out * v[1] * h2 * (1.0 - h2)

            # 3. 梯度下降更新全部 9 个参数
            v[0] -= lr * d_out * h1
            v[1] -= lr * d_out * h2
            bo -= lr * d_out
            for j, x in enumerate((x1, x2)):
                w[0][j] -= lr * d_h1 * x
                w[1][j] -= lr * d_h2 * x
            bh[0] -= lr * d_h1
            bh[1] -= lr * d_h2

        if epoch in (500, 1500, 3000):
            print(f"epoch={epoch:4d}  MSE={eval_mse(w, bh, v, bo):.5f}")

    print("\n训练后的隐藏层坐标与预测结果：")
    for x1, x2, y in DATA:
        h1 = sigmoid(w[0][0] * x1 + w[0][1] * x2 + bh[0])
        h2 = sigmoid(w[1][0] * x1 + w[1][1] * x2 + bh[1])
        yhat = sigmoid(v[0] * h1 + v[1] * h2 + bo)
        print(f"  输入 ({int(x1)}, {int(x2)}) -> 隐藏 ({h1:.2f}, {h2:.2f}) -> 预测 {yhat:.3f} (真实 {int(y)})")


if __name__ == "__main__":
    main()
