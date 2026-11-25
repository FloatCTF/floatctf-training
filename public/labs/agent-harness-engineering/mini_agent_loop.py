"""第 4 课实验：无 API 密钥的最小 Agent Loop（外部校验 + 反馈驱动修复 + 预算上限 + 人工审批）。"""

FACTS = {
    "PR#42": "修复支付超时重试",
    "PR#45": "新增缓存命中指标",
    "BUG-19": "灰度环境数据库连接池偶发占满",
}


def draft_brief(included_ids: list[str], missing_feedback: list[str]) -> tuple[str, list[str]]:
    """模拟模型起草：收到外部校验器指出的缺项后，按反馈把漏掉的事实补进草稿。"""
    updated = list(included_ids)
    for item_id in missing_feedback:
        if item_id in FACTS and item_id not in updated:
            updated.append(item_id)
    details = "；".join(f"{k}（{FACTS[k]}）" for k in updated)
    return f"本周发布简报：{details}。", updated


def verify_brief(text: str) -> list[str]:
    """外部确定性校验器：检查所有事实编号是否全部出现在草稿中。"""
    return [item_id for item_id in FACTS if item_id not in text]


def publish_brief(text: str, approved: bool) -> str:
    """高风险动作受权限网关保护：未获人工审批直接拒绝。"""
    if not approved:
        return "BLOCKED: 发布动作需要人工审批（approval=False）"
    return f"PUBLISHED ({len(text)} 字)"


def run_agent(max_steps: int = 3, approved: bool = False) -> None:
    included = ["PR#42", "PR#45"]  # 首轮草稿故意漏写阻塞项 BUG-19
    missing: list[str] = []
    draft = ""

    for step in range(1, max_steps + 1):
        draft, included = draft_brief(included, missing)
        missing = verify_brief(draft)
        print(f"[step {step}/{max_steps}] 草稿: {draft}")
        if not missing:
            print(f"[step {step}/{max_steps}] 外部校验: PASS")
            break
        print(f"[step {step}/{max_steps}] 外部校验: FAIL (缺少引用 {', '.join(missing)}) -> 反馈回灌")
    else:
        print("STOP: 达到步数预算上限，转人工处理。")
        return

    print(f"[gate] 调用 publish_brief -> {publish_brief(draft, approved=approved)}")


if __name__ == "__main__":
    run_agent(max_steps=3, approved=False)
