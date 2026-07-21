import { useId } from 'react';

interface Question {
  id: string;
  question: string;
  level: number;
  answer: string;
  keyPoints: string[];
  bonus: string;
  trap?: { text: string };
}
interface Props { questions: Question[] }

function AnswerContent({ item }: { item: Question }) {
  return (
    <>
      <p><strong>参考回答：</strong>{item.answer}</p>
      <p><strong>合格要点：</strong>{item.keyPoints.join('；')}</p>
      <p><strong>加分项：</strong>{item.bonus}</p>
      {item.trap && <p><strong>真实追问依据：</strong>{item.trap.text}</p>}
    </>
  );
}

const labels: Record<number, string> = {
  1: '基础概念',
  2: '利用与技术细节',
  3: '防御与工程设计',
  4: '实战与综合判断',
};

export default function InterviewAccordion({ questions }: Props) {
  const titleId = useId();
  return (
    <section className="interview-module" aria-labelledby={titleId}>
      <h2 id={titleId}>面试题训练</h2>
      <p>先给结论，再说明成立条件和边界；涉及防御时覆盖应用、网络和权限三层，并用来源支持案例。</p>
      {[1, 2, 3, 4].map((level) => (
        <section className="interview-level" key={level} aria-labelledby={`${titleId}-${level}`}>
          <h3 id={`${titleId}-${level}`}>第 {level} 档：{labels[level]}</h3>
          {questions.filter((item) => item.level === level).map((item, index) => (
            <div className="interview-question" key={item.id}>
              <details>
                <summary><span className="question-number">{String(index + 1).padStart(2, '0')}</span><span>{item.question}</span></summary>
                <div className="interview-answer"><AnswerContent item={item} /></div>
              </details>
              <article className="interview-print-item">
                <h4>{index + 1}. {item.question}</h4>
                <AnswerContent item={item} />
              </article>
            </div>
          ))}
        </section>
      ))}
    </section>
  );
}
