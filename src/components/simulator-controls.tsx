import type { CSSProperties, ReactNode } from 'react';
import { keyboardRangeValue, type SimulatorStage } from './motion-utils';

interface StageControlsProps {
  sim: Pick<SimulatorStage, 'stage' | 'running' | 'advance' | 'reset' | 'toggleRunning'>;
  maxStage: number;
  /** 放在动作按钮前的自定义控件（如滑杆）。 */
  leading?: ReactNode;
  stepLabel?: string;
  ariaLabel: string;
  showDots?: boolean;
  className?: string;
}

/** 单步/连续播放/复位控制台；showDots 时渲染与 useSimulator 的 stage 同步的进度点。 */
export function StageControls({
  sim,
  maxStage,
  leading,
  stepLabel = '单步',
  ariaLabel,
  showDots = false,
  className = 'simulator-control bp-controls',
}: StageControlsProps) {
  return (
    <div className={className}>
      {leading}
      <div className="learning-sim-actions" aria-label={ariaLabel}>
        <button type="button" onClick={sim.advance} disabled={sim.running || sim.stage >= maxStage}>{stepLabel}</button>
        <button type="button" onClick={sim.toggleRunning} disabled={sim.stage >= maxStage} aria-pressed={sim.running}>
          {sim.running ? '暂停' : '连续播放'}
        </button>
        <button type="button" onClick={sim.reset}>复位</button>
      </div>
      {showDots && (
        <p className="bp-progress" aria-hidden="true">
          {Array.from({ length: maxStage + 1 }, (_, index) => (
            <span key={index} className={index <= sim.stage ? 'bp-progress__dot bp-progress__dot--on' : 'bp-progress__dot'}>
              {index}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

interface RangeControlProps {
  label: ReactNode;
  min: number;
  max: number;
  step?: number;
  /** 键盘方向键的步长；不填与拖动步长一致。 */
  keyboardStep?: number;
  value: number;
  onChange: (next: number) => void;
  /** 附加在 label 上的类名（如 simulator-control）。 */
  className?: string;
  ariaLabel?: string;
}

/** 带键盘取值包装的滑杆：label + span 说明 + input[type=range]。 */
export function RangeControl({ label, min, max, step = 1, keyboardStep, value, onChange, className, ariaLabel }: RangeControlProps) {
  return (
    <label className={className}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onKeyDown={(event) => {
          const next = keyboardRangeValue(event.key, value, min, max, keyboardStep ?? step);
          if (next == null) return;
          event.preventDefault();
          onChange(next);
        }}
        aria-label={ariaLabel}
      />
    </label>
  );
}

interface SimLedgerProps {
  columns: string[];
  rows: ReactNode[][];
  ariaLabel: string;
  className?: string;
  note?: ReactNode;
}

/** 静态推导账本：role=table 的行列表，可选随附的 static-content-note 说明。 */
export function SimLedger({ columns, rows, ariaLabel, className, note }: SimLedgerProps) {
  return (
    <>
      <div className={className ? `learning-sim-ledger ${className}` : 'learning-sim-ledger'} style={{ '--ledger-extra-columns': columns.length - 1 } as CSSProperties} role="table" aria-label={ariaLabel}>
        <div className="learning-sim-ledger-row learning-sim-ledger-head" role="row">
          {columns.map((column) => <span role="columnheader" key={column}>{column}</span>)}
        </div>
        {rows.map((row, index) => (
          <div className="learning-sim-ledger-row" role="row" key={index}>
            {row.map((cell, cellIndex) => <span role="cell" key={cellIndex}>{cell}</span>)}
          </div>
        ))}
      </div>
      {note && <details className="demo-notes"><summary>演示说明</summary><p className="static-content-note">{note}</p></details>}
    </>
  );
}
