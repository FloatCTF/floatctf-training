// 教学演示：给定前文，按“候选下一词”的相对权重选词（非真实大模型）
// 用来理解：预测下一个 token + 上下文如何改变概率

const scenarios = [
  {
    context: '小明在操场___，因为今天天气很好',
    candidates: [
      { token: '踢球', weight: 0.42 },
      { token: '跑步', weight: 0.18 },
      { token: '睡觉', weight: 0.05 },
      { token: '开会', weight: 0.03 },
    ],
  },
  {
    context: '我今天买了两个苹果，洗干净后就___了',
    candidates: [
      { token: '吃', weight: 0.55 },
      { token: '卖', weight: 0.12 },
      { token: '发布', weight: 0.04 },
      { token: '上市', weight: 0.03 },
    ],
  },
];

function normalize(candidates) {
  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  return candidates
    .map((item) => ({ token: item.token, probability: item.weight / total }))
    .sort((a, b) => b.probability - a.probability);
}

for (const scenario of scenarios) {
  console.log(`上下文：${scenario.context}`);
  for (const row of normalize(scenario.candidates)) {
    const bar = '█'.repeat(Math.round(row.probability * 40));
    console.log(`  ${row.token.padEnd(4, '　')} ${(row.probability * 100).toFixed(1).padStart(5)}%  ${bar}`);
  }
  console.log('');
}

console.log('说明：真实大模型在全词表上做同类预测；此处用固定权重演示“上下文改变下一词分布”。');
