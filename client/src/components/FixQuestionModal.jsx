import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, X, Wrench, Save } from 'lucide-react';
import api from '../api';
import MathRenderer from './MathRenderer';
import { SPRING } from '../ui/motion';
import { findQuestionProblems, textProblem } from '../utils/questionProblems';

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-[#1e1b4b] font-mono leading-relaxed outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100';

/** Fix one bank question: edit the stored text / options / answer / solution with a live preview. Only changed fields are saved. */
export default function FixQuestionModal({ question, onClose, onSaved }) {
    const original = useMemo(() => ({
        question: question.raw_question ?? question.questionText ?? '',
        opt_a: question.opt_a ?? '', opt_b: question.opt_b ?? '', opt_c: question.opt_c ?? '', opt_d: question.opt_d ?? '',
        assertion: question.assertion ?? '', reason: question.reason ?? '',
        correct_option: question.correct_option ?? '',
        solution_text: question.solutionText ?? '',
    }), [question]);
    const [form, setForm] = useState(original);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const dirty = Object.keys(original).filter(k => form[k] !== original[k]);
    const isAR = question.type === 'ASSERTION_REASON';
    const hasOptions = ['MCQ', 'DIAGRAM_BASED', 'ASSERTION_REASON', 'STATEMENT_BASED'].includes(question.type);
    const before = useMemo(() => findQuestionProblems(question), [question]);
    const problemOf = (k) => (k === 'question' || k === 'assertion' || k === 'reason' || k === 'solution_text' || /^opt_/.test(k)) ? textProblem(form[k]) : '';

    const save = async () => {
        setSaving(true); setError('');
        try {
            const body = {}; dirty.forEach(k => { body[k] = form[k]; });
            const res = await api.post(`/api/questions/${question._id || question.id}/fix`, body);
            onSaved(res.data);
        } catch (e) {
            setError(e.response?.data?.msg || 'Could not save. Please try again.');
        } finally { setSaving(false); }
    };

    const block = (k, label, rows = 3) => {
        const problem = problemOf(k);
        return (
            <div key={k}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</label>
                    {problem && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600"><AlertTriangle size={12} /> still has a problem</span>}
                    {!problem && form[k] !== original[k] && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 size={12} /> looks good</span>}
                </div>
                <textarea rows={rows} className={`${field} ${problem ? 'border-rose-300' : ''}`} value={form[k]} onChange={e => set(k, e.target.value)} spellCheck={false} />
                {form[k].trim() && <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[14px] text-slate-800"><MathRenderer text={form[k]} /></div>}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm" onMouseDown={onClose}>
            <motion.div role="dialog" aria-modal="true" aria-label="Fix question" onMouseDown={(e) => e.stopPropagation()}
                initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING.island}
                className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
                <header className="flex items-start justify-between gap-4 px-7 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <span className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30"><Wrench size={22} /></span>
                        <div className="min-w-0">
                            <h3 className="font-display text-[22px] leading-tight text-[#1e1b4b]">Fix this question</h3>
                            <p className="text-xs text-slate-500 font-medium truncate">{question.subject} · {question.chapter} · {question.type} · <span className="font-mono">{String(question._id || question.id).slice(0, 8)}</span></p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 shrink-0 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center cursor-pointer"><X size={18} /></button>
                </header>

                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-5">
                    {before.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <p className="text-[13px] font-bold text-amber-900 flex items-center gap-2"><AlertTriangle size={15} /> What is wrong now</p>
                            <ul className="mt-1.5 space-y-1 text-[12.5px] text-amber-900">
                                {before.map((p, i) => <li key={i}><span className="font-bold capitalize">{p.part}:</span> {p.problem}</li>)}
                            </ul>
                        </div>
                    )}
                    {block('question', 'Question text', 5)}
                    {isAR && <>{block('assertion', 'Assertion')}{block('reason', 'Reason')}</>}
                    {hasOptions && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {block('opt_a', 'Option 1 (A)', 2)}{block('opt_b', 'Option 2 (B)', 2)}
                            {block('opt_c', 'Option 3 (C)', 2)}{block('opt_d', 'Option 4 (D)', 2)}
                        </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                        <div>
                            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Correct answer</label>
                            <input className={field} value={form.correct_option} onChange={e => set('correct_option', e.target.value)} placeholder="A, B, C or D" />
                        </div>
                        <p className="self-end text-[12px] text-slate-500 font-medium">Letter of the correct option. For several answers write "A, C". For a match question write "A → 4; B → 2".</p>
                    </div>
                    {block('solution_text', 'Solution', 5)}
                    <p className="text-[12px] text-slate-500 font-medium">Maths goes between dollar signs, for example <span className="font-mono">$\frac{'{1}{2}'}$</span> or <span className="font-mono">$x^2$</span>. The preview under each box shows exactly how it will print.</p>
                </div>

                <footer className="flex items-center justify-between gap-3 px-7 py-4 border-t border-slate-100 bg-slate-50/70">
                    <p className={`text-[12.5px] font-semibold ${error ? 'text-rose-600' : 'text-slate-500'}`} role={error ? 'alert' : undefined}>{error || (dirty.length ? `${dirty.length} change${dirty.length > 1 ? 's' : ''} to save` : 'No changes yet')}</p>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
                        <button type="button" onClick={save} disabled={saving || dirty.length === 0}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#1e1b4b] px-5 text-[13px] font-bold text-white hover:bg-[#312e81] disabled:opacity-50 cursor-pointer"><Save size={15} className="text-[#d6b878]" /> {saving ? 'Saving…' : 'Save changes'}</button>
                    </div>
                </footer>
            </motion.div>
        </div>
    );
}
