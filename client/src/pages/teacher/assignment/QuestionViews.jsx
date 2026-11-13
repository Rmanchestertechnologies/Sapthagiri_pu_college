import MathRenderer from '../../../components/MathRenderer';
import { optionLabel } from '../../../utils/sanitize';

// Helper to extract the introductory sentence of a match-the-following question
export function getMatchIntroText(q) {
    const raw = q.questionText || q.question || '';
    const match = raw.match(/^([\s\S]*?)(?=(?:\n\s*|^)(?:\*\*)?(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b)/i);
    if (match && match[1].trim().length > 0) {
        return match[1].trim();
    }
    return raw;
}

// Helper component to render match the following pairs side-by-side
export const QuestionMatchTable = ({ q }) => {
    const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0)
        ? q.matchPairs
        : (Array.isArray(q.column_a) && q.column_a.length > 0 && Array.isArray(q.column_b) && q.column_b.length > 0)
            ? q.column_a.map((left, idx) => ({ left, right: q.column_b[idx] || '' }))
            : [];

    if (pairs.length === 0) return null;

    const leftLabels = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'];
    const rightLabels = ['(i)', '(ii)', '(iii)', '(iv)', '(v)', '(vi)'];

    return (
        <div className="my-2.5 border border-blue-200 rounded-xl overflow-hidden shadow-2xs bg-white text-xs">
            <div className="grid grid-cols-2 bg-navy text-gold font-black text-[10px] sm:text-[11px] uppercase tracking-wider px-3 py-1.5 border-b border-navy/20">
                <span>Column I / List I</span>
                <span>Column II / List II</span>
            </div>
            <div className="divide-y divide-gray-100">
                {pairs.map((p, idx) => {
                    const leftStr = typeof p === 'object' ? (p.left || '') : String(p);
                    const rightStr = typeof p === 'object' ? (p.right || '') : '';
                    if (!leftStr && !rightStr) return null;

                    return (
                        <div key={idx} className="grid grid-cols-2 px-3 py-2 text-slate-800 bg-gray-50/40 hover:bg-blue-50/30 transition">
                            <div className="flex items-start gap-1.5 pr-2">
                                <span className="font-bold text-navy flex-shrink-0 text-[11px]">{leftLabels[idx] || `${idx + 1}.`}</span>
                                <div className="min-w-0 font-medium leading-relaxed">
                                    <MathRenderer inline text={leftStr} />
                                </div>
                            </div>
                            <div className="flex items-start gap-1.5 pl-2 border-l border-gray-100">
                                <span className="font-bold text-navy flex-shrink-0 text-[11px]">{rightLabels[idx] || `(${idx + 1})`}</span>
                                <div className="min-w-0 font-medium leading-relaxed">
                                    <MathRenderer inline text={rightStr} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Helper component to render complete options for a question
export const QuestionOptionsDisplay = ({ q, options = [] }) => {
    if (!options || options.length === 0) {
        const isNum = q && ((q.type || '').includes('NUM') || Boolean(q.num_answer || q.correct_option));
        if (isNum) {
            return (
                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 bg-gray-100 px-2 py-0.5 rounded">
                        Numerical / Free Response
                    </span>
                    {(q.answer || q.num_answer) && (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            Key: {q.answer || q.num_answer}
                        </span>
                    )}
                </div>
            );
        }
        return null;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100">
            {options.map((opt, oIdx) => {
                const optText = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');
                const label = typeof opt === 'object' && opt.label ? opt.label : optionLabel(oIdx);

                return (
                    <div key={oIdx} className="flex items-start gap-2 text-xs text-slate-700 bg-gray-50/80 rounded-xl p-2 border border-gray-100">
                        <span className="font-black text-navy bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[10px] flex-shrink-0">
                            ({label})
                        </span>
                        <div className="flex-1 min-w-0 font-medium">
                            <MathRenderer inline text={optText} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
