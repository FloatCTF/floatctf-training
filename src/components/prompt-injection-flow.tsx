import FlowSimulator from './flow-simulator';
import type { MotionLevel } from './motion-utils';

interface Props { motionLevel?: MotionLevel }

const steps = [
  { label: '攻击者内容', detail: '注入指令藏在网页、文档、邮件正文或工单里，对人是普通文本。', state: 'danger' as const },
  { label: '检索与抓取', detail: 'RAG 管线或浏览工具把该内容当作普通数据抓取，不检查其中是否含指令。', state: 'danger' as const },
  { label: '组装上下文', detail: '应用把检索片段拼进模型上下文，指令与数据混在同一条序列里。', state: 'danger' as const },
  { label: '模型执行', detail: '模型把注入文本当指令：泄露系统提示、调用工具或把数据写进外发内容。', state: 'danger' as const },
  { label: '分层防御', detail: '输入护栏、权限最小化、输出校验与人工确认共同收窄注入的影响。', state: 'success' as const },
];

export default function PromptInjectionFlow({ motionLevel = 'simulation' }: Props) {
  return <FlowSimulator title="间接提示注入的攻防数据流" steps={steps} motionLevel={motionLevel} />;
}
