const input = 2;
const target = 4;
let weight = 1;
const learningRate = 0.1;

const loss = (value) => (value * input - target) ** 2;
const before = loss(weight);
const gradient = 2 * (weight * input - target) * input;
weight -= learningRate * gradient;
const after = loss(weight);

if (!(after < before)) throw new Error('本次更新没有降低损失');
console.log(`更新前损失：${before.toFixed(4)}`);
console.log(`梯度：${gradient.toFixed(4)}`);
console.log(`更新后权重：${weight.toFixed(4)}`);
console.log(`更新后损失：${after.toFixed(4)}`);
