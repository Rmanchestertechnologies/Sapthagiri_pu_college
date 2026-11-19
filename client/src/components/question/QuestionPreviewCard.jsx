// One question, shown the way it will print: question text, statements, assertion / reason, the two match columns as a table,
// the diagram, and the options one under the other with a round letter (the correct one in green when `showAnswer`).
// Every list that lets a teacher look at or pick questions uses this card, and it reads the question through
// buildQuestionPreview - the same parsing as the paper - so nothing the paper prints is missing here.
import MathRenderer from '../MathRenderer';
import { buildQuestionPreview } from './previewModel';

const PAPER_FONT = '"Times New Roman", Times, Georgia, serif';
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function Text({ value, className = '' }) {
    if (!value) return null;
    return <MathRenderer inline text={value} className={className} />;
}

export function QuestionPreviewBody({ q, number = null, showAnswer = false, showSolution = false, hideOptions = false, size = 15 }) {
    const m = buildQuestionPreview(q);
    if (!m) return null;
    const shortOptions = m.options.length > 0 && m.options.every(o => String(o.text).replace(/\$|\\[a-z]+|[{}]/gi, '').length <= 22);

    return (
        <div className="qpc-body flex items-start gap-1.5 text-slate-900" style={{ fontFamily: PAPER_FONT, fontSize: `${size}px`, lineHeight: 1.5 }}>
            {number != null && <span className="shrink-0 font-bold">Q{number}.</span>}
            <div className="min-w-0 flex-1">
            {/* question */}
            {m.stem && <div className="whitespace-pre-line"><Text value={m.stem} /></div>}

            {/* statements */}
            {m.statements.length > 0 && (
                <div className={`${m.stem ? 'mt-1.5' : ''} space-y-1`}>
                    {m.statements.map((s, i) => (
                        <div key={i} className="flex items-baseline gap-2">
                            <span className="shrink-0 font-bold">{s.label}</span>
                            <div className="min-w-0 flex-1"><Text value={s.text} /></div>
                        </div>
                    ))}
                </div>
            )}
            {m.outro && <div className="mt-1.5"><Text value={m.outro} /></div>}

            {/* assertion / reason */}
            {m.kind === 'assertion' && (
                <div className={`${m.stem ? 'mt-1.5' : ''} space-y-1`}>
                    <div><span className="font-bold">Assertion (A): </span><Text value={m.assertion} /></div>
                    {m.reason && <div><span className="font-bold">Reason (R): </span><Text value={m.reason} /></div>}
                </div>
            )}

            {/* match the following */}
            {m.columns && (
                <table className="mt-2 w-full border-collapse overflow-hidden rounded-md text-[0.93em]">
                    <thead>
                        <tr className="bg-slate-100 text-left normal-case tracking-normal">
                            <th className="w-1/2 border border-slate-300 px-3 py-1.5 font-bold" colSpan={2}>Column I</th>
                            <th className="w-1/2 border border-slate-300 px-3 py-1.5 font-bold" colSpan={2}>Column II</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: Math.max(m.columns.left.length, m.columns.right.length) }).map((_, i) => {
                            const l = m.columns.left[i]; const r = m.columns.right[i];
                            return (
                                <tr key={i} className="align-top">
                                    <td className="w-8 border border-slate-300 px-2 py-1.5 text-center font-bold">{l ? l.label : ''}</td>
                                    <td className="border border-slate-300 px-3 py-1.5">{l ? <Text value={l.text} /> : null}</td>
                                    <td className="w-10 border border-slate-300 px-2 py-1.5 text-center font-bold">{r ? `(${r.label})` : ''}</td>
                                    <td className="border border-slate-300 px-3 py-1.5">{r ? <Text value={r.text} /> : null}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            {/* diagram */}
            {m.diagramUrl && (
                <div className="mt-2">
                    <img src={m.diagramUrl} alt="Diagram" loading="lazy" className="max-h-48 max-w-full rounded border border-slate-200 bg-white object-contain p-1" />
                </div>
            )}

            {/* options */}
            {!hideOptions && m.options.length > 0 && (
                <div className={`mt-2 grid gap-1 ${shortOptions ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    {m.options.map((o, i) => {
                        const correct = showAnswer && o.correct;
                        return (
                            <div key={i} className={`flex items-start gap-2.5 rounded-lg px-2 py-1 ${correct ? 'bg-emerald-50' : ''}`}>
                                <span className={`mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-bold ${correct ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                    {LETTERS[i] || i + 1}
                                </span>
                                <div className="min-w-0 flex-1"><Text value={o.text} /></div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* numerical / free response */}
            {!hideOptions && m.options.length === 0 && (
                <div className="mt-2 flex items-center gap-2 font-sans text-[11px]">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600">Numerical / free response</span>
                    {showAnswer && m.answerText && <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">Answer: {m.answerText}</span>}
                </div>
            )}

            {showSolution && m.solution && (
                <div className="mt-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-[0.93em]">
                    <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-emerald-700">Solution</span>
                    <div className="mt-0.5 whitespace-pre-line"><Text value={m.solution} /></div>
                </div>
            )}
            </div>
        </div>
    );
}

/**
 * Card around the body: a strip of small labels on top (`badges`), an action area on the right (`actions`), selected look.
 */
export default function QuestionPreviewCard({ q, number = null, badges = null, actions = null, selected = false, onClick, showAnswer = true, showSolution = false, hideOptions = false, className = '' }) {
    return (
        <div
            onClick={onClick}
            className={`rounded-2xl border bg-white transition ${onClick ? 'cursor-pointer select-none' : ''} ${selected ? 'border-amber-400 ring-2 ring-amber-200 shadow-md' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'} ${className}`}
        >
            {(badges || actions) && (
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">{badges}</div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className="px-4 py-3">
                <QuestionPreviewBody q={q} number={number} showAnswer={showAnswer} showSolution={showSolution} hideOptions={hideOptions} />
            </div>
        </div>
    );
}
