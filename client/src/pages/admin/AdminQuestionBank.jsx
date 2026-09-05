import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize, optionLabel, isOptionCorrect, getResolvedAnswerLabel } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';


const MultiSelectCheckbox = ({ label, options, selectedValues, onChange, disabled }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (val) => {
        if (selectedValues.includes(val)) {
            onChange(selectedValues.filter(v => v !== val));
        } else {
            onChange([...selectedValues, val]);
        }
    };

    return (
        <div ref={containerRef} className="relative inline-block text-left w-full select-none">
            <div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full border border-gray-200 p-3 rounded-xl text-xs bg-white font-bold flex justify-between items-center disabled:opacity-50 outline-none text-left"
                >
                    <span className="truncate">
                        {selectedValues.length === 0 ? label : `${label} (${selectedValues.length})`}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-2">▼</span>
                </button>
            </div>

            {isOpen && !disabled && (
                <div className="absolute left-0 mt-1 w-full rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 max-h-60 overflow-y-auto border border-gray-100">
                    <div className="py-1">
                        {options.length === 0 ? (
                            <div className="px-4 py-2 text-xs text-gray-400 italic">No options available</div>
                        ) : (
                            options.map((opt) => {
                                const checked = selectedValues.includes(opt);
                                return (
                                    <label key={opt} className="flex items-center px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleOption(opt)}
                                            className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded mr-2 focus:ring-blue-500"
                                        />
                                        <span className="truncate">{opt}</span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const AdminQuestionBank = () => {
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [allQuestions, setAllQuestions] = useState([]);
    const [filters, setFilters] = useState({
        examType: '',
        subject: '',
        classes: '',
        academicYearLevel: '',
        chapter: [],
        concept: [],
        subConcept: [],
        level: [],
        type: [],
        sourceType: ''
    });

    const [uniqueChapters, setUniqueChapters] = useState([]);
    const [uniqueConcepts, setUniqueConcepts] = useState([]);
    const [uniqueSubConcepts, setUniqueSubConcepts] = useState([]);

    const fetchAllQuestionsOnce = async () => {
        try {
            const res = await api.get('/api/questions?limit=20000&paginated=true');
            const list = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
            setAllQuestions(list);
            const chs = [...new Set(list.map(q => q.chapter))].filter(Boolean);
            setUniqueChapters(chs);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchAllQuestionsOnce();
    }, []);

    const fetchQuestions = async () => {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('limit', '20000');
            queryParams.append('paginated', 'true');
            Object.keys(filters).forEach(key => {
                if (Array.isArray(filters[key])) {
                    if (filters[key].length > 0) {
                        queryParams.append(key, filters[key].join(','));
                    }
                } else if (filters[key]) {
                    queryParams.append(key, filters[key]);
                }
            });
            const res = await api.get(`/api/questions?${queryParams.toString()}`);
            const list = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
            setQuestions(list);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchQuestions();
    }, [filters]);

    // Handle cascade filters with arrays
    const handleChapterChange = (chapters) => {
        setFilters(prev => ({
            ...prev,
            chapter: chapters,
            concept: [],
            subConcept: []
        }));
        const matchingQs = allQuestions.filter(q => chapters.length === 0 || chapters.includes(q.chapter));
        setUniqueConcepts([...new Set(matchingQs.map(q => q.concept))].filter(Boolean));
    };

    const handleConceptChange = (concepts) => {
        setFilters(prev => ({
            ...prev,
            concept: concepts,
            subConcept: []
        }));
        const matchingQs = allQuestions.filter(q => 
            (filters.chapter.length === 0 || filters.chapter.includes(q.chapter)) &&
            (concepts.length === 0 || concepts.includes(q.concept))
        );
        setUniqueSubConcepts([...new Set(matchingQs.map(q => q.subConcept))].filter(Boolean));
    };

    const handleSubConceptChange = (subConcepts) => {
        setFilters(prev => ({
            ...prev,
            subConcept: subConcepts
        }));
    };

    const handleClearFilters = () => {
        setFilters({
            examType: '',
            subject: '',
            classes: '',
            academicYearLevel: '',
            chapter: [],
            concept: [],
            subConcept: [],
            level: [],
            type: [],
            sourceType: ''
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this question?')) {
            try {
                await api.delete(`/api/questions/${id}`);
                fetchQuestions();
            } catch (err) {
                alert('Failed to delete question');
            }
        }
    };

    return (
        <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up space-y-8">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-black text-navy uppercase tracking-tight mb-2">Unified Question Bank</h2>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Central Repository Control & Taxonomy Mapping</p>
                </div>
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm cursor-pointer"
                >
                    ← Back
                </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <select className="border border-gray-200 p-3 rounded-xl text-xs bg-white font-bold" value={filters.examType} onChange={e => setFilters({...filters, examType: e.target.value})}>
                    <option value="">All Exams</option>
                    <option value="JEE">JEE</option>
                    <option value="NEET">NEET</option>
                    <option value="CET">CET</option>
                </select>

                <select className="border border-gray-200 p-3 rounded-xl text-xs bg-white font-bold" value={filters.subject} onChange={e => setFilters({...filters, subject: e.target.value})}>
                    <option value="">All Subjects</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Maths">Maths</option>
                    <option value="Biology">Biology</option>
                    <option value="Botany">Botany</option>
                    <option value="Zoology">Zoology</option>
                </select>

                <MultiSelectCheckbox 
                    label="All Levels" 
                    options={["easy", "medium", "hard"]} 
                    selectedValues={filters.level} 
                    onChange={vals => setFilters(f => ({ ...f, level: vals }))} 
                />

                <MultiSelectCheckbox 
                    label="All Types" 
                    options={["MCQ", "ASSERTION_REASON", "STATEMENT_BASED", "MATCH_FOLLOWING", "DIAGRAM_BASED", "NUMERICAL"]} 
                    selectedValues={filters.type} 
                    onChange={vals => setFilters(f => ({ ...f, type: vals }))} 
                />

                <select className="border border-gray-200 p-3 rounded-xl text-xs bg-white font-bold" value={filters.sourceType} onChange={e => setFilters({...filters, sourceType: e.target.value})}>
                    <option value="">All Sources</option>
                    <option value="REGULAR">Regular (Manual)</option>
                    <option value="GT">Grand Test (GT)</option>
                    <option value="PYQ">Previous Year (PYQ)</option>
                </select>

                {/* Cascade Taxonomy */}
                <MultiSelectCheckbox 
                    label="All Chapters" 
                    options={uniqueChapters} 
                    selectedValues={filters.chapter} 
                    onChange={handleChapterChange} 
                />

                <MultiSelectCheckbox 
                    label="All Concepts" 
                    options={uniqueConcepts} 
                    selectedValues={filters.concept} 
                    onChange={handleConceptChange} 
                    disabled={filters.chapter.length === 0}
                />

                <MultiSelectCheckbox 
                    label="All Sub-concepts" 
                    options={uniqueSubConcepts} 
                    selectedValues={filters.subConcept} 
                    onChange={handleSubConceptChange} 
                    disabled={filters.concept.length === 0}
                />

                <button onClick={handleClearFilters} className="col-span-2 bg-navy text-gold py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md">
                    Clear Filters
                </button>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 gap-6">
                <p className="text-sm font-bold text-navy">Matches Found: <span className="text-gold font-black">{questions.length}</span></p>
                {questions.map(q => (
                    <div key={q._id} className="border border-gray-200 p-6 rounded-3xl shadow-sm bg-white relative group hover:shadow-md transition">
                        <div className="absolute top-4 right-4 hidden group-hover:flex gap-2 transition z-10">
                            <button 
                                onClick={async () => {
                                    if (!window.confirm('Are you sure you want to generate an AI variant of this question and save it as a new question in the bank?')) return;
                                    try {
                                        const res = await api.post(`/api/questions/${q._id}/generate-variant`);
                                        alert('AI Variant created and saved successfully as: ' + res.data.questionId);
                                        fetchQuestions();
                                    } catch (err) {
                                        alert(err.response?.data?.msg || err.message);
                                    }
                                }} 
                                className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
                            >
                                AI Variant
                            </button>
                            <button 
                                onClick={() => handleDelete(q._id)} 
                                className="text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
                            >
                                Delete
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="bg-navy/5 text-navy text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider">{q.questionId}</span>
                            <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-full">Subject: {q.subject}</span>
                            <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-full">Class: {q.classes.join(', ')}</span>
                            <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-full">Type: {q.type}</span>
                            <span className="text-[10px] font-semibold text-gray-600 bg-gray-50 px-3 py-1 rounded-full">Level: {q.level}</span>
                            <span className="text-[10px] font-semibold text-gold bg-navy px-3 py-1 rounded-full uppercase tracking-wider">{q.sourceType} {q.sourceDisplayCode ? `(${q.sourceDisplayCode})` : ''}</span>
                        </div>

                        {/* Rendering formats based on questionType — Uniform Font & Size, Normal Weight */}
                        {q.type === 'ASSERTION_REASON' ? (
                            <div className="space-y-2 mt-2 text-[15px] text-slate-800 font-normal leading-relaxed">
                                {q.questionText && <MathRenderer text={q.questionText} />}
                                <p className="font-normal"><span>Assertion (A):</span> <MathRenderer inline text={q.assertion} /></p>
                                <p className="font-normal"><span>Reason (R):</span> <MathRenderer inline text={q.reason} /></p>
                            </div>
                        ) : q.type === 'STATEMENT_BASED' ? (
                            <div className="space-y-2 mt-2 text-[15px] text-slate-800 font-normal leading-relaxed">
                                <MathRenderer text={q.questionText} />
                                {q.statements?.map((stmt, idx) => (
                                    <p key={idx} className="font-normal"><span>Statement {idx+1}:</span> <MathRenderer inline text={stmt} /></p>
                                ))}
                            </div>
                        ) : q.type === 'MATCH_FOLLOWING' ? (
                            <div className="space-y-2 mt-2 text-[15px] text-slate-800 font-normal leading-relaxed">
                                <MathRenderer text={q.questionText} />
                                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50 max-w-lg mt-2">
                                    <table className="w-full text-[15px] font-normal">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left font-normal pb-2 text-slate-700">Column A</th>
                                                <th className="text-left font-normal pb-2 text-slate-700">Column B</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {q.matchPairs?.map((pair, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-1.5 pr-2 font-normal text-slate-800">
                                                        ({String.fromCharCode(97+idx)}) <MathRenderer inline text={pair.left || ''} />
                                                    </td>
                                                    <td className="py-1.5 pl-2 font-normal text-slate-800">
                                                        ({['i','ii','iii','iv','v'][idx] || idx+1}) <MathRenderer inline text={pair.right || ''} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2 text-[15px] text-slate-800 font-normal leading-relaxed whitespace-pre-wrap">
                                <MathRenderer text={q.questionText} />
                            </div>
                        )}

                        {q.imageUrl && (
                            <div className="mt-3">
                                <img src={q.imageUrl} alt="Reference Diagram" className="max-h-56 rounded border border-gray-200 object-contain" />
                            </div>
                        )}
                        
                        {(q.type === 'MCQ' || q.type === 'DIAGRAM_BASED' || q.type === 'ASSERTION_REASON' || q.type === 'STATEMENT_BASED' || q.type === 'MATCH_FOLLOWING') && q.options && q.options.length > 0 && (
                            <div className="mt-4 space-y-2 text-[15px] text-slate-800 font-normal">
                                {q.options.map((opt, idx) => {
                                    const optLbl = optionLabel(idx, q.classes);
                                    const optVal = typeof opt === 'object' ? (opt.text || opt.optionText || '') : String(opt || '');
                                    const isCorrect = isOptionCorrect(q, idx);
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`flex items-baseline gap-2 font-normal ${
                                                isCorrect ? 'text-emerald-700 font-medium' : 'text-slate-800'
                                            }`}
                                        >
                                            <span className="font-normal min-w-[22px]">{optLbl}:</span>
                                            <div className="flex-1 min-w-0 font-normal">
                                                <MathRenderer inline={true} text={optVal} />
                                                {isCorrect && <span className="ml-2 text-emerald-600 font-bold">✓</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-normal text-slate-500">
                            <div>
                                Correct: <span className="text-emerald-700 font-bold">{getResolvedAnswerLabel(q)}</span>
                            </div>
                            {q.solutionText && (
                                <details className="cursor-pointer text-slate-600 font-normal">
                                    <summary className="hover:text-navy">View Detailed Solution</summary>
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-[15px] text-slate-800 font-normal">
                                        <MathRenderer text={q.solutionText} />
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminQuestionBank;
