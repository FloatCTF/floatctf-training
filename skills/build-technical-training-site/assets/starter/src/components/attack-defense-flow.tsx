import FlowSimulator from './flow-simulator';
import type { MotionLevel } from './motion-utils';

interface Props { motionLevel?: MotionLevel }

const steps = [
  { label: '浏览器', detail: '提交一个由用户控制的资源 URL。', state: 'normal' as const },
  { label: '应用服务器', detail: '服务器解析输入并代替用户发起请求。', state: 'danger' as const },
  { label: '目标解析', detail: '域名、IP、端口与重定向决定实际连接位置。', state: 'danger' as const },
  { label: '内网或元数据服务', detail: '服务器的网络位置可能跨过原有访问边界。', state: 'danger' as const },
  { label: '分层防御', detail: '允许列表、连接复核、出口限制和最小权限共同收束路径。', state: 'success' as const },
];

export default function AttackDefenseFlow({ motionLevel = 'simulation' }: Props) {
  return <FlowSimulator title="SSRF 攻防请求链" steps={steps} motionLevel={motionLevel} />;
}
