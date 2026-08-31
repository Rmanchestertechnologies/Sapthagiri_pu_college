/**
 * PaperAnalysisModal.jsx
 *
 * Professional academic analytics dashboard and printable report for question papers.
 * Renders:
 * 1. Subject-wise Difficulty Level Analysis (Table, Bar Chart, Donut Charts)
 * 2. Class-wise Question Distribution (Table, Grouped Bar Chart, Donut Charts)
 * 3. Question Type Analysis (Table, Multi-bar Chart, Donut Charts, Matrix)
 *
 * Preserves 100% full vibrant colors, legends, and styling when printed or downloaded as PDF.
 */
import React, { useState, useMemo } from 'react';

// Helper to draw clean SVG Donut Segments with vibrant persistent colors
const DonutChart = ({ data, size = 160, holeRadius = 45, title = '' }) => {
    const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
    if (total === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-4">
                <div className="w-24 h-24 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 font-bold">
                    No Data
                </div>
                {title && <span className="text-xs font-bold text-gray-700 mt-2">{title}</span>}
            </div>
        );
    }

    const radius = size / 2 - 10;
    const center = size / 2;

    let cumulativeAngle = 0;
    const slices = data.map((d) => {
        const fraction = d.value / total;
        const angle = fraction * 360;
        const startAngle = cumulativeAngle;
        const endAngle = cumulativeAngle + angle;
        cumulativeAngle += angle;

        const startRad = ((startAngle - 90) * Math.PI) / 180;
        const endRad = ((endAngle - 90) * Math.PI) / 180;

        const x1 = center + radius * Math.cos(startRad);
        const y1 = center + radius * Math.sin(startRad);
        const x2 = center + radius * Math.cos(endRad);
        const y2 = center + radius * Math.sin(endRad);

        const x3 = center + holeRadius * Math.cos(endRad);
        const y3 = center + holeRadius * Math.sin(endRad);
        const x4 = center + holeRadius * Math.cos(startRad);
        const y4 = center + holeRadius * Math.sin(startRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${holeRadius} ${holeRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
            'Z',
        ].join(' ');

        const pct = Math.round(fraction * 1000) / 10;

        return {
            ...d,
            pathData,
            pct,
            midAngle: startAngle + angle / 2,
        };
    });

    return (
        <div className="flex flex-col items-center print-color-safe">
            {title && <h5 className="text-sm font-black text-gray-800 mb-2">{title}</h5>}
            <div className="relative flex items-center justify-center">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
                    {slices.map((s, idx) => (
                        <path
                            key={idx}
                            d={s.pathData}
                            fill={s.color}
                            stroke="#ffffff"
                            strokeWidth="2"
                            style={{ fill: s.color }}
                        >
                            <title>{`${s.label}: ${s.value} Qs (${s.pct}%)`}</title>
                        </path>
                    ))}
                    <circle cx={center} cy={center} r={holeRadius} fill="#ffffff" />
                </svg>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                {slices.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1 text-[11px] font-bold text-gray-700">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }}></span>
                        <span>{s.label}: {s.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Bar chart component with inline colored bars for 100% print color preservation
const GroupedBarChart = ({ categories, series, height = 180 }) => {
    let maxVal = 1;
    categories.forEach((_, cIdx) => {
        series.forEach((s) => {
            const v = s.data[cIdx] || 0;
            if (v > maxVal) maxVal = v;
        });
    });
    maxVal = Math.ceil(maxVal * 1.15);

    return (
        <div className="w-full bg-white p-4 rounded-2xl border border-gray-200 print-color-safe">
            <div className="flex justify-center items-center gap-6 mb-4">
                {series.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                        <span className="w-3 h-3 rounded" style={{ backgroundColor: s.color }}></span>
                        <span>{s.name}</span>
                    </div>
                ))}
            </div>

            <div className="flex items-end justify-around gap-4" style={{ height: `${height}px` }}>
                {categories.map((cat, cIdx) => (
                    <div key={cIdx} className="flex-1 flex flex-col items-center h-full justify-end">
                        <div className="flex items-end justify-center gap-1.5 w-full h-[85%] border-b border-gray-300 pb-1">
                            {series.map((s, sIdx) => {
                                const val = s.data[cIdx] || 0;
                                const pctHeight = Math.max(6, Math.round((val / maxVal) * 100));
                                return (
                                    <div key={sIdx} className="flex-1 max-w-[24px] flex flex-col items-center h-full justify-end relative">
                                        <span className="text-[9px] font-black text-gray-700 mb-0.5">{val}</span>
                                        <div
                                            style={{
                                                height: `${pctHeight}%`,
                                                backgroundColor: s.color,
                                                minHeight: '4px',
                                            }}
                                            className="w-full rounded-t shadow-sm"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <span className="text-[11px] font-bold text-gray-700 mt-2 truncate max-w-[70px] text-center">{cat}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PaperAnalysisModal = ({ isOpen, onClose, paperTitle = 'Assessment Paper', questions = [], examType = 'NEET' }) => {
    const [activeTab, setActiveTab] = useState('difficulty');

    const subjects = useMemo(() => {
        const presentSubjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];
        if (presentSubjects.length === 1) {
            return presentSubjects;
        }
        if (presentSubjects.length > 1 && !['NEET', 'JEE', 'CET'].includes(examType)) {
            return presentSubjects;
        }
        if (examType === 'NEET') return ['Physics', 'Chemistry', 'Botany', 'Zoology'];
        if (examType === 'JEE') return ['Physics', 'Chemistry', 'Mathematics'];
        if (examType === 'CET') return ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
        return presentSubjects.length > 0 ? presentSubjects : ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    }, [examType, questions]);

    const matchSubject = (qSubject) => {
        if (!qSubject) return subjects[0];
        const qs = qSubject.toLowerCase().trim();
        for (const s of subjects) {
            const sl = s.toLowerCase();
            if (qs.includes(sl) || sl.includes(qs)) return s;
            if (sl.includes('math') && qs.includes('math')) return s;
            if (sl.includes('bio') && (qs.includes('bio') || qs.includes('bot') || qs.includes('zoo'))) return s;
        }
        return subjects[0];
    };

    // 1. Difficulty Level Breakdown
    const diffData = useMemo(() => {
        const result = {};
        subjects.forEach(s => {
            result[s] = { easy: 0, medium: 0, hard: 0, total: 0 };
        });

        questions.forEach(q => {
            const sub = matchSubject(q.subject);
            const lvl = (q.level || 'medium').toLowerCase();
            if (result[sub]) {
                if (lvl === 'easy') result[sub].easy += 1;
                else if (lvl === 'hard') result[sub].hard += 1;
                else result[sub].medium += 1;
                result[sub].total += 1;
            }
        });

        const grand = { easy: 0, medium: 0, hard: 0, total: 0 };
        subjects.forEach(s => {
            const subObj = result[s];
            grand.easy += subObj.easy;
            grand.medium += subObj.medium;
            grand.hard += subObj.hard;
            grand.total += subObj.total;
        });

        return { subjects: result, grand };
    }, [questions, subjects]);

    // 2. Class Distribution Breakdown
    const classData = useMemo(() => {
        const result = {};
        subjects.forEach(s => {
            result[s] = { class11: 0, class12: 0, total: 0 };
        });

        questions.forEach(q => {
            const sub = matchSubject(q.subject);
            const classes = Array.isArray(q.classes) ? q.classes : [q.class || '12'];
            const is11 = classes.some(c => String(c).includes('11') || String(c).toLowerCase().includes('xi') || String(c).toLowerCase().includes('i puc'));
            if (result[sub]) {
                if (is11) result[sub].class11 += 1;
                else result[sub].class12 += 1;
                result[sub].total += 1;
            }
        });

        const grand = { class11: 0, class12: 0, total: 0 };
        subjects.forEach(s => {
            const subObj = result[s];
            grand.class11 += subObj.class11;
            grand.class12 += subObj.class12;
            grand.total += subObj.total;
        });

        return { subjects: result, grand };
    }, [questions, subjects]);

    // 3. Question Type Breakdown
    const typeData = useMemo(() => {
        const result = {};
        subjects.forEach(s => {
            result[s] = { single: 0, stmt: 0, multi: 0, assertion: 0, match: 0, diagram: 0, total: 0 };
        });

        questions.forEach(q => {
            const sub = matchSubject(q.subject);
            const t = (q.type || q.q_type || 'MCQ').toUpperCase();
            if (result[sub]) {
                if (t.includes('ASSERTION')) result[sub].assertion += 1;
                else if (t.includes('MATCH')) result[sub].match += 1;
                else if (t.includes('MULTIPLE_STATEMENT')) result[sub].multi += 1;
                else if (t.includes('STATEMENT')) result[sub].stmt += 1;
                else if (t.includes('DIAGRAM') || q.imageUrl || q.image_url) result[sub].diagram += 1;
                else result[sub].single += 1;
                result[sub].total += 1;
            }
        });

        const grand = { single: 0, stmt: 0, multi: 0, assertion: 0, match: 0, diagram: 0, total: 0 };
        subjects.forEach(s => {
            const r = result[s];
            grand.single += r.single;
            grand.stmt += r.stmt;
            grand.multi += r.multi;
            grand.assertion += r.assertion;
            grand.match += r.match;
            grand.diagram += r.diagram;
            grand.total += r.total;
        });

        return { subjects: result, grand };
    }, [questions, subjects]);

    const handleDownloadPdf = () => {
        window.print();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border-b-8 border-gold animate-fade-in-up overflow-hidden my-auto print-analysis-container">
                
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50/80 no-print">
                    <div>
                        <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em] bg-navy px-3 py-1 rounded-full">Academic Analytics</span>
                        <h2 className="text-xl font-black text-navy mt-1 uppercase tracking-tight">{paperTitle}</h2>
                        <p className="text-xs text-gray-500 font-bold">{questions.length} Questions Analyzed</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownloadPdf}
                            className="bg-gold text-navy hover:bg-navy hover:text-gold px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition shadow flex items-center gap-2 cursor-pointer"
                        >
                            <span>🖨</span> Download / Print Full Color Analysis
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate/30 hover:text-red-500 bg-white rounded-full w-9 h-9 flex items-center justify-center text-lg font-bold border border-gray-200 shadow transition"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Tabs for screen view */}
                <div className="flex border-b border-gray-200 bg-white px-6 pt-3 gap-3 no-print">
                    <button
                        onClick={() => setActiveTab('difficulty')}
                        className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition ${
                            activeTab === 'difficulty' ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        1. Difficulty Level
                    </button>
                    <button
                        onClick={() => setActiveTab('class')}
                        className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition ${
                            activeTab === 'class' ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        2. Class-Wise Split
                    </button>
                    <button
                        onClick={() => setActiveTab('types')}
                        className={`pb-3 px-4 font-black text-xs uppercase tracking-wider border-b-2 transition ${
                            activeTab === 'types' ? 'border-navy text-navy' : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        3. Question Types
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-8 print-body-content">
                    
                    {/* SECTION 1: DIFFICULTY LEVEL */}
                    {(activeTab === 'difficulty' || window.matchMedia('print').matches) && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-black text-base text-navy uppercase">Subject-Wise Difficulty Level Breakdown</h3>
                                <span className="text-xs font-bold text-gray-500">Target Standard Split: 40% Easy / 40% Medium / 20% Hard</span>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-300 text-center text-xs font-bold">
                                    <thead>
                                        <tr className="bg-navy text-gold">
                                            <th className="p-2.5 text-left pl-4 border border-gray-400">Subject</th>
                                            <th className="p-2.5 border border-gray-400">Easy (40%)</th>
                                            <th className="p-2.5 border border-gray-400">Medium (40%)</th>
                                            <th className="p-2.5 border border-gray-400">Hard (20%)</th>
                                            <th className="p-2.5 border border-gray-400">Total Questions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((sub, idx) => {
                                            const d = diffData.subjects[sub] || { easy: 0, medium: 0, hard: 0, total: 0 };
                                            return (
                                                <tr key={sub} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2.5 border border-gray-300 text-left pl-4 font-black text-navy">{sub}</td>
                                                    <td className="p-2.5 border border-gray-300 text-emerald-700">{d.easy} ({d.total ? Math.round((d.easy / d.total) * 100) : 0}%)</td>
                                                    <td className="p-2.5 border border-gray-300 text-amber-700">{d.medium} ({d.total ? Math.round((d.medium / d.total) * 100) : 0}%)</td>
                                                    <td className="p-2.5 border border-gray-300 text-rose-700">{d.hard} ({d.total ? Math.round((d.hard / d.total) * 100) : 0}%)</td>
                                                    <td className="p-2.5 border border-gray-300 font-black text-navy">{d.total}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-amber-50 font-black text-navy border-t-2 border-gray-400">
                                            <td className="p-2.5 border border-gray-400 text-left pl-4">GRAND TOTAL</td>
                                            <td className="p-2.5 border border-gray-400 text-emerald-700">{diffData.grand.easy} ({diffData.grand.total ? Math.round((diffData.grand.easy / diffData.grand.total) * 100) : 0}%)</td>
                                            <td className="p-2.5 border border-gray-400 text-amber-700">{diffData.grand.medium} ({diffData.grand.total ? Math.round((diffData.grand.medium / diffData.grand.total) * 100) : 0}%)</td>
                                            <td className="p-2.5 border border-gray-400 text-rose-700">{diffData.grand.hard} ({diffData.grand.total ? Math.round((diffData.grand.hard / diffData.grand.total) * 100) : 0}%)</td>
                                            <td className="p-2.5 border border-gray-400 font-black">{diffData.grand.total}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <div>
                                    <h4 className="text-center font-black text-gray-700 text-xs mb-2 uppercase tracking-wider">Difficulty Distribution Across Subjects</h4>
                                    <GroupedBarChart
                                        categories={subjects}
                                        series={[
                                            { name: 'Easy', color: '#10b981', data: subjects.map(s => diffData.subjects[s]?.easy || 0) },
                                            { name: 'Medium', color: '#f59e0b', data: subjects.map(s => diffData.subjects[s]?.medium || 0) },
                                            { name: 'Hard', color: '#ef4444', data: subjects.map(s => diffData.subjects[s]?.hard || 0) },
                                        ]}
                                    />
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                    <DonutChart
                                        title="Overall Paper Difficulty"
                                        data={[
                                            { label: 'Easy', value: diffData.grand.easy, color: '#10b981' },
                                            { label: 'Medium', value: diffData.grand.medium, color: '#f59e0b' },
                                            { label: 'Hard', value: diffData.grand.hard, color: '#ef4444' },
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECTION 2: CLASS-WISE DISTRIBUTION */}
                    {(activeTab === 'class' || window.matchMedia('print').matches) && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-black text-base text-navy uppercase">Class-Wise Question Distribution (11th vs 12th)</h3>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-300 text-center text-xs font-bold">
                                    <thead>
                                        <tr className="bg-navy text-gold">
                                            <th className="p-2.5 text-left pl-4 border border-gray-400">Subject</th>
                                            <th className="p-2.5 border border-gray-400">Class 11 (XI / I PUC)</th>
                                            <th className="p-2.5 border border-gray-400">Class 12 (XII / II PUC)</th>
                                            <th className="p-2.5 border border-gray-400">Total Questions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((sub, idx) => {
                                            const d = classData.subjects[sub] || { class11: 0, class12: 0, total: 0 };
                                            return (
                                                <tr key={sub} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2.5 border border-gray-300 text-left pl-4 font-black text-navy">{sub}</td>
                                                    <td className="p-2.5 border border-gray-300 text-blue-700">{d.class11} ({d.total ? Math.round((d.class11 / d.total) * 100) : 0}%)</td>
                                                    <td className="p-2.5 border border-gray-300 text-red-700">{d.class12} ({d.total ? Math.round((d.class12 / d.total) * 100) : 0}%)</td>
                                                    <td className="p-2.5 border border-gray-300 font-black text-navy">{d.total}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-amber-50 font-black text-navy border-t-2 border-gray-400">
                                            <td className="p-2.5 border border-gray-400 text-left pl-4">GRAND TOTAL</td>
                                            <td className="p-2.5 border border-gray-400 text-blue-700">{classData.grand.class11}</td>
                                            <td className="p-2.5 border border-gray-400 text-red-700">{classData.grand.class12}</td>
                                            <td className="p-2.5 border border-gray-400 font-black">{classData.grand.total}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Donut Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                                {subjects.map(s => {
                                    const d = classData.subjects[s] || { class11: 0, class12: 0 };
                                    return (
                                        <div key={s} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 flex flex-col items-center">
                                            <DonutChart
                                                title={s}
                                                size={140}
                                                holeRadius={38}
                                                data={[
                                                    { label: '11th', value: d.class11, color: '#2563eb' },
                                                    { label: '12th', value: d.class12, color: '#dc2626' },
                                                ]}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: QUESTION TYPES */}
                    {(activeTab === 'types' || window.matchMedia('print').matches) && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-black text-base text-navy uppercase">Question Type Breakdown</h3>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse border border-gray-300 text-center text-xs font-bold">
                                    <thead>
                                        <tr className="bg-navy text-gold">
                                            <th className="p-2 border border-gray-400 text-left pl-3">Subject</th>
                                            <th className="p-2 border border-gray-400">MCQ</th>
                                            <th className="p-2 border border-gray-400">Statement</th>
                                            <th className="p-2 border border-gray-400">Assertion-Reason</th>
                                            <th className="p-2 border border-gray-400">Match Col</th>
                                            <th className="p-2 border border-gray-400">Diagram Based</th>
                                            <th className="p-2 border border-gray-400">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subjects.map((sub, idx) => {
                                            const r = typeData.subjects[sub] || { single: 0, stmt: 0, multi: 0, assertion: 0, match: 0, diagram: 0, total: 0 };
                                            return (
                                                <tr key={sub} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                    <td className="p-2 border border-gray-300 text-left pl-3 font-black text-navy">{sub}</td>
                                                    <td className="p-2 border border-gray-300">{r.single}</td>
                                                    <td className="p-2 border border-gray-300">{r.stmt + r.multi}</td>
                                                    <td className="p-2 border border-gray-300">{r.assertion}</td>
                                                    <td className="p-2 border border-gray-300">{r.match}</td>
                                                    <td className="p-2 border border-gray-300">{r.diagram}</td>
                                                    <td className="p-2 border border-gray-300 font-black text-navy">{r.total}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-amber-50 font-black text-navy border-t-2 border-gray-400">
                                            <td className="p-2 border border-gray-400 text-left pl-3">Total</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.single}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.stmt + typeData.grand.multi}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.assertion}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.match}</td>
                                            <td className="p-2 border border-gray-400">{typeData.grand.diagram}</td>
                                            <td className="p-2 border border-gray-400 font-black">{typeData.grand.total}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center p-5 border-t border-gray-200 bg-gray-50/80 no-print">
                    <div className="text-xs font-bold text-gray-500">
                        Academic Audit & Assessment Analysis System • Sapthagiri PU College, Davanagere
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-navy text-gold px-7 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow"
                    >
                        Close Analysis
                    </button>
                </div>
            </div>

            {/* Print Styles with Explicit Full Color Enforcement */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body * { visibility: hidden; }
                    .print-analysis-container, .print-analysis-container * {
                        visibility: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    .print-analysis-container {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default PaperAnalysisModal;