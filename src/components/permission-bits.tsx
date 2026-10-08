import { useId, useRef, useState } from 'react';
import { useMotionPresentation, type MotionLevel } from './motion-utils';

const CLASSES = [
  { id: 'u', label: '所有者', hint: 'user' },
  { id: 'g', label: '同组用户', hint: 'group' },
  { id: 'o', label: '其他人', hint: 'other' },
] as const;
const BITS = [
  { letter: 'r', value: 4, label: '读' },
  { letter: 'w', value: 2, label: '写' },
  { letter: 'x', value: 1, label: '执行' },
] as const;
const PRESETS = [
  { mode: '644', use: '普通文件：自己能改，别人只能看' },
  { mode: '755', use: '脚本和程序：所有人能运行，只有自己能改' },
  { mode: '600', use: '私密文件：只有自己能读写，如 SSH 私钥' },
  { mode: '640', use: '自己读写，同组只读，其他人无权限' },
  { mode: '700', use: '只有自己能读、写、运行' },
];

/** 三位八进制数 → 三个 0..7 的数字。 */
function digitsOf(mode: string): number[] {
  return mode.split('').map((digit) => Number.parseInt(digit, 8));
}

function symbolic(digits: number[]): string {
  return digits.map((digit) => BITS.map((bit) => (digit & bit.value ? bit.letter : '-')).join('')).join('');
}

function describe(digit: number): string {
  const granted = BITS.filter((bit) => digit & bit.value).map((bit) => bit.label);
  return granted.length > 0 ? `可以${granted.join('、')}` : '没有任何权限';
}

interface Props {
  /** 示例文件名，出现在生成的 chmod 命令和 ls -l 行里。 */
  fileName?: string;
  motionLevel?: MotionLevel;
}

export default function PermissionBits({ fileName = 'hello.sh', motionLevel = 'subtle' }: Props) {
  const root = useRef<HTMLElement>(null);
  const titleId = useId();
  const [digits, setDigits] = useState<number[]>(() => digitsOf('644'));
  const presentation = useMotionPresentation(root, motionLevel, (next) => {
    if (next === 'static') setDigits(digitsOf('644'));
  });
  const interactive = presentation === 'interactive';
  const mode = digits.join('');
  const letters = symbolic(digits);

  const toggle = (classIndex: number, value: number) => {
    setDigits((current) => current.map((digit, index) => (index === classIndex ? digit ^ value : digit)));
  };

  return (
    <section className="permission-bits not-content" ref={root} aria-labelledby={titleId} data-presentation={presentation}>
      <header className="xor-explorer__header">
        <p className="lesson-diagram__eyebrow">MODE BITS / 权限位</p>
        <h3 id={titleId} className="lesson-diagram__title">rwx 和数字是同一件事的两种写法</h3>
        <p className="xor-explorer__intro">
          每类用户三个开关：读 r 记 4，写 w 记 2，执行 x 记 1，加起来就是那一位数字。
          {interactive ? '点开关，看字母、数字和 chmod 命令一起变。' : '下表列出几组常用权限。'}
        </p>
      </header>

      {interactive ? (
        <>
          <div className="permission-bits__grid">
            {CLASSES.map((item, classIndex) => (
              <div className="permission-bits__class" key={item.id} role="group" aria-label={`${item.label}的权限`}>
                <p className="permission-bits__class-name">{item.label}<small>{item.hint}</small></p>
                <div className="permission-bits__switches">
                  {BITS.map((bit) => {
                    const on = Boolean(digits[classIndex] & bit.value);
                    return (
                      <button
                        type="button"
                        key={bit.letter}
                        aria-pressed={on}
                        aria-label={`${item.label}：${bit.label}（${bit.letter}，记 ${bit.value}）`}
                        onClick={() => toggle(classIndex, bit.value)}
                      >
                        <b>{on ? bit.letter : '-'}</b>
                        <small>{bit.label} {bit.value}</small>
                      </button>
                    );
                  })}
                </div>
                <p className="permission-bits__sum">
                  {BITS.map((bit) => (digits[classIndex] & bit.value ? bit.value : 0)).join(' + ')} = <strong>{digits[classIndex]}</strong>
                </p>
              </div>
            ))}
          </div>
          <div className="permission-bits__presets" role="group" aria-label="常用权限">
            <span>常用</span>
            {PRESETS.map((preset) => (
              <button type="button" key={preset.mode} aria-pressed={preset.mode === mode} onClick={() => setDigits(digitsOf(preset.mode))}>{preset.mode}</button>
            ))}
          </div>
          <div className="permission-bits__readout" aria-live="polite">
            <p className="permission-bits__line"><span aria-hidden="true">$ </span>chmod {mode} {fileName}</p>
            <p className="permission-bits__line">-{letters} 1 kali kali 26 Oct  1 12:35 {fileName}</p>
            <p className="permission-bits__meaning">
              所有者{describe(digits[0])}；同组用户{describe(digits[1])}；其他人{describe(digits[2])}。
            </p>
          </div>
        </>
      ) : (
        <div className="permission-bits__ledger" role="table" aria-label="常用权限对照">
          <div className="permission-bits__ledger-row permission-bits__ledger-head" role="row">
            <span role="columnheader">数字</span>
            <span role="columnheader">ls -l 显示</span>
            <span role="columnheader">用在哪</span>
          </div>
          {PRESETS.map((preset) => (
            <div className="permission-bits__ledger-row" role="row" key={preset.mode}>
              <span role="cell">{preset.mode}</span>
              <span role="cell">-{symbolic(digitsOf(preset.mode))}</span>
              <span role="cell">{preset.use}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
