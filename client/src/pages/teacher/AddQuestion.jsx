import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { sanitize, optionLabel, stripQBPTags } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';
import * as XLSX from 'xlsx';

const AddQuestion = () => {
    const navigate = useNavigate();
    const [questions, setQuestions] = useState([]);
    const [formData, setFormData] = useState({
        chapter: '',
        concept: '',
        subConcept: '',
        level: 'easy',
        classes: '11',
        type: 'MCQ',
        questionText: '',
        options: ['', '', '', ''],
        answer: '',
        solutionText: '',
        assertion: '',
        reason: '',
        statements: ['', ''],
        matchPairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
        numericalTolerance: 0,
        questionTextTranslation: '',
        optionsTranslation: ['', '', '', '']
    });
    const [imageFile, setImageFile] = useState(null);
    const [solutionImageFile, setSolutionImageFile] = useState(null);
    const [editId, setEditId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [expandedSolutions, setExpandedSolutions] = useState(new Set());

    const toggleSolution = (id) => {
        setExpandedSolutions(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkExcelImport = async (e) => {
        e.preventDefault();
        if (!importFile) return alert('Please select an Excel or CSV file first.');
        
        setImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    alert('The selected sheet is empty.');
                    setImporting(false);
                    return;
                }

                // POST parsed JSON to bulk import API
                const res = await api.post('/api/questions/bulk-import', { questions: json });
                alert(`Successfully imported ${res.data.count} questions!`);
                setShowImportModal(false);
                setImportFile(null);
                fetchQuestions(1);
            } catch (err) {
                console.error(err);
                alert('Import failed: ' + (err.response?.data?.msg || err.message));
            } finally {
                setImporting(false);
            }
        };
        reader.readAsArrayBuffer(importFile);
    };

    // Pagination & Search Filters
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [search, setSearch] = useState('');
    const [chapterFilter, setChapterFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });

    const fetchQuestions = async (targetPage = page) => {
        try {
            const params = new URLSearchParams({
                paginated: 'true',
                page: targetPage,
                limit: limit
            });
            if (search) params.append('search', search);
            if (chapterFilter) params.append('chapter', chapterFilter);
            if (typeFilter) params.append('type', typeFilter);
            if (classFilter) params.append('classes', classFilter);

            const res = await api.get(`/api/questions?${params.toString()}`);
            const totalFromHeader = parseInt(res.headers['x-total-count'] || res.headers['X-Total-Count']);

            if (res.data && res.data.questions) {
                setQuestions(res.data.questions);
                const paginationObj = res.data.pagination || {};
                if (totalFromHeader && !isNaN(totalFromHeader)) {
                    paginationObj.total = totalFromHeader;
                    paginationObj.pages = Math.ceil(totalFromHeader / (paginationObj.limit || limit)) || 1;
                }
                setPagination(paginationObj);
            } else {
                const list = Array.isArray(res.data) ? res.data : [];
                setQuestions(list);
                const realTotal = (!isNaN(totalFromHeader) && totalFromHeader > 0) ? totalFromHeader : list.length;
                const realPages = Math.ceil(realTotal / limit) || 1;
                setPagination({ page: targetPage, limit, total: realTotal, pages: realPages });
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchQuestions(page);
    }, [page, limit, chapterFilter, typeFilter, classFilter]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const submitData = new FormData();
            submitData.append('chapter', formData.chapter);
            submitData.append('concept', formData.concept);
            submitData.append('subConcept', formData.subConcept || '');
            submitData.append('level', formData.level);
            submitData.append('classes', formData.classes);
            submitData.append('type', formData.type);
            submitData.append('questionText', formData.questionText);
            submitData.append('answer', formData.answer);
            if (formData.solutionText) {
                submitData.append('solutionText', formData.solutionText);
            }
            if (formData.questionTextTranslation) {
                submitData.append('questionTextTranslation', formData.questionTextTranslation);
            }
            if (formData.optionsTranslation && formData.optionsTranslation.some(Boolean)) {
                submitData.append('optionsTranslation', JSON.stringify(formData.optionsTranslation));
            }
            
            // Format options & fields based on Question Type
            if (formData.type === 'MCQ' || formData.type === 'DIAGRAM_BASED') {
                submitData.append('options', JSON.stringify(formData.options));
            } else if (formData.type === 'ASSERTION_REASON') {
                submitData.append('assertion', formData.assertion);
                submitData.append('reason', formData.reason);
                submitData.append('options', JSON.stringify([
                    'Both A and R are true and R is the correct explanation of A',
                    'Both A and R are true but R is not the correct explanation of A',
                    'A is true but R is false',
                    'A is false but R is true'
                ]));
            } else if (formData.type === 'STATEMENT_BASED') {
                submitData.append('statements', JSON.stringify(formData.statements.filter(Boolean)));
                submitData.append('options', JSON.stringify(formData.options));
            } else if (formData.type === 'MATCH_FOLLOWING') {
                submitData.append('matchPairs', JSON.stringify(formData.matchPairs.filter(p => p.left || p.right)));
                submitData.append('options', JSON.stringify(formData.options));
            } else if (formData.type === 'NUMERICAL') {
                submitData.append('numericalTolerance', formData.numericalTolerance || 0);
            }

            if (imageFile) {
                submitData.append('image', imageFile);
            }
            if (solutionImageFile) {
                submitData.append('solutionImage', solutionImageFile);
            }

            if (editId) {
                await api.post(`/api/questions/update/${editId}`, submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Question updated successfully!');
            } else {
                await api.post('/api/questions', submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Question added successfully!');
            }
            
            setFormData({
                chapter: '',
                concept: '',
                subConcept: '',
                level: 'easy',
                classes: '11',
                type: 'MCQ',
                questionText: '',
                options: ['', '', '', ''],
                answer: '',
                solutionText: '',
                assertion: '',
                reason: '',
                statements: ['', ''],
                matchPairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
                numericalTolerance: 0,
                questionTextTranslation: '',
                optionsTranslation: ['', '', '', '']
            });
            setImageFile(null);
            setSolutionImageFile(null);
            setEditId(null);
            fetchQuestions();
            setShowForm(false);
        } catch (err) {
            console.error('Submit question error:', err);
            alert(`Error: ${err.response?.data?.msg || err.response?.data?.message || err.message}`);
        }
    };

    const handleEdit = (q) => {
        setFormData({
            chapter: q.chapter || '',
            concept: q.concept || '',
            subConcept: q.subConcept || '',
            level: q.level || 'easy',
            classes: q.classes[0] || '11',
            type: q.type || 'MCQ',
            questionText: q.questionText || '',
            options: q.options && q.options.length === 4 ? q.options : ['', '', '', ''],
            answer: q.answer || '',
            solutionText: q.solutionText || '',
            assertion: q.assertion || '',
            reason: q.reason || '',
            statements: q.statements && q.statements.length > 0 ? q.statements : ['', ''],
            matchPairs: q.matchPairs && q.matchPairs.length > 0 ? q.matchPairs : [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
            numericalTolerance: q.numericalTolerance || 0,
            questionTextTranslation: q.questionTextTranslation || '',
            optionsTranslation: q.optionsTranslation && q.optionsTranslation.length === 4 ? q.optionsTranslation : ['', '', '', '']
        });
        setEditId(q._id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if(window.confirm('Are you sure you want to delete this question?')) {
            try {
                await api.delete(`/api/questions/${id}`);
                fetchQuestions();
            } catch (err) {
                alert('Failed to delete question');
            }
        }
    };

    // Direct numerical conversion trigger from UI (clears options in-place)
    const handleConvertNumerical = async (q) => {
        if (window.confirm('Are you sure you want to convert this MCQ into a Numerical question? This will remove all options.')) {
            try {
                await api.post(`/api/questions/convert-numerical/${q._id}`);
                alert('Question converted to Numerical successfully!');
                fetchQuestions();
            } catch (err) {
                alert('Conversion failed: ' + (err.response?.data?.msg || err.message));
            }
        }
    };

    return (
        <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up">
            <div className="flex justify-between items-center mb-10 pb-8 border-b border-gray-100">
                <div>
                    <h2 className="text-3xl font-black text-navy tracking-tight mb-2 uppercase">Institutional Repository</h2>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Academic Question Bank Management</p>
                </div>
                <div className="flex gap-3 items-center">
                    <button 
                        onClick={() => {
                            if (showForm) {
                                setShowForm(false);
                                setEditId(null);
                                setFormData({
                                    chapter: '',
                                    concept: '',
                                    subConcept: '',
                                    level: 'easy',
                                    classes: '11',
                                    type: 'MCQ',
                                    questionText: '',
                                    options: ['', '', '', ''],
                                    answer: '',
                                    solutionText: '',
                                    assertion: '',
                                    reason: '',
                                    statements: ['', ''],
                                    matchPairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
                                    numericalTolerance: 0,
                                    questionTextTranslation: '',
                                    optionsTranslation: ['', '', '', '']
                                });
                                setImageFile(null);
                                setSolutionImageFile(null);
                            } else {
                                setShowForm(true);
                            }
                        }} 
                        className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg cursor-pointer ${showForm ? 'bg-gray-100 text-slate/60 hover:bg-gray-200' : 'bg-navy text-gold hover:scale-105 active:scale-95'}`}
                    >
                        {showForm ? '← View Repository' : '+ New Question'}
                    </button>
                    <button
                        onClick={() => navigate('/teacher/dashboard')}
                        className="bg-white border-2 border-gray-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm cursor-pointer"
                    >
                        ← Back
                    </button>
                </div>
            </div>

            {showForm ? (
                <div className="max-w-3xl mx-auto bg-gray-50/50 p-10 rounded-[2.5rem] border border-gray-100 shadow-inner">
                    <h3 className="text-xl font-black mb-8 text-navy flex items-center gap-4">
                        <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">{editId ? '✎' : '+'}</span>
                        {editId ? 'Edit Entry' : 'Create Entry'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Target Academic Class</label>
                                <select className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" value={formData.classes} onChange={e => setFormData({...formData, classes: e.target.value})}>
                                    <option value="11">Class 11</option>
                                    <option value="12">Class 12</option>
                                    <option value="JEE">JEE (Entrance)</option>
                                    <option value="KCET">KCET (Entrance)</option>
                                    <option value="NEET">NEET (Entrance)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Assessment Type</label>
                                <select 
                                    className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" 
                                    value={formData.type} 
                                    onChange={e=>setFormData({...formData, type: e.target.value})}
                                >
                                    <option value="MCQ">MCQ</option>
                                    <option value="ASSERTION_REASON">Assertion & Reason</option>
                                    <option value="STATEMENT_BASED">Statement-Based</option>
                                    <option value="TRUE_FALSE">True or False</option>
                                    <option value="MATCH_FOLLOWING">Match the Following</option>
                                    <option value="DIAGRAM_BASED">Diagram-Oriented</option>
                                    <option value="NUMERICAL">Numerical Answer Type</option>
                                    <option value="1m">1 Mark</option>
                                    <option value="2m">2 Marks</option>
                                    <option value="3m">3 Marks</option>
                                    <option value="4m">4 Marks</option>
                                    <option value="5m">5 Marks</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Difficulty Complexity</label>
                                <select className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" value={formData.level} onChange={e=>setFormData({...formData, level: e.target.value})}>
                                    <option value="easy">Easy (Foundational)</option>
                                    <option value="medium">Medium (Standard)</option>
                                    <option value="hard">Hard (Advanced)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Chapter Name</label>
                                <input type="text" list="chapters" placeholder="e.g. Cell" required className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500" value={formData.chapter} onChange={e=>setFormData({...formData, chapter: e.target.value})} />
                                <datalist id="chapters">
                                    {[...new Set(questions.map(q => q.chapter))].filter(Boolean).map(ch => <option key={ch} value={ch} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Concept / Topic</label>
                                <input type="text" list="concepts" placeholder="e.g. Plasma Membrane" required className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500" value={formData.concept} onChange={e=>setFormData({...formData, concept: e.target.value})} />
                                <datalist id="concepts">
                                    {[...new Set(questions.filter(q => !formData.chapter || q.chapter === formData.chapter).map(q => q.concept))].filter(Boolean).map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Sub-concept</label>
                                <input type="text" placeholder="e.g. Structure" className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500" value={formData.subConcept} onChange={e=>setFormData({...formData, subConcept: e.target.value})} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Question Content</label>
                            <textarea placeholder="Enter the exact question text here..." required className="w-full border border-gray-300 p-3 rounded-lg h-32 focus:ring-2 focus:ring-green-500 mb-3" value={formData.questionText} onChange={e=>setFormData({...formData, questionText: e.target.value})}></textarea>
                            
                            {/* Image Upload Area */}
                            <label className="block text-sm font-bold text-gray-700 mb-1 mt-2">Diagram / Reference Image (Optional/Required for Diagram-Oriented)</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-green-50 hover:border-green-400 transition cursor-pointer relative"
                                 onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-green-50', 'border-green-400'); }}
                                 onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-green-50', 'border-green-400'); }}
                                 onDrop={(e) => {
                                     e.preventDefault();
                                     e.currentTarget.classList.remove('bg-green-50', 'border-green-400');
                                     if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                         setImageFile(e.dataTransfer.files[0]);
                                     }
                                 }}
                            >
                                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) setImageFile(e.target.files[0]);
                                }} />
                                {imageFile ? (
                                    <div className="flex flex-col items-center">
                                        <div className="text-green-600 mb-2">
                                            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        <span className="font-medium text-gray-800">{imageFile.name}</span>
                                        <span className="text-xs text-gray-500 mt-1">Click or drag to replace</span>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-gray-400 mb-2 text-3xl">🖼️</div>
                                        <span className="font-medium text-gray-600 block">Drag and drop an image here</span>
                                        <span className="text-xs text-gray-500">or click to browse from your computer</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* QUESTION TYPE SPECIFIC DYNAMIC FIELDS */}
                        {formData.type === 'MCQ' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
                                <p className="font-bold text-sm text-gray-800">Multiple Choice Options:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {formData.options.map((opt, i) => (
                                        <div key={i} className="flex items-center">
                                            <span className="font-bold bg-gray-100 text-gray-600 w-8 h-8 flex items-center justify-center rounded-l-md border border-r-0 border-gray-300">{String.fromCharCode(65+i)}</span>
                                            <input type="text" placeholder={`Option content`} required className="flex-1 border border-gray-300 p-2 rounded-r-md text-sm focus:ring-2 focus:ring-green-500"
                                                value={opt} onChange={e => {
                                                    const newOpts = [...formData.options];
                                                    newOpts[i] = e.target.value;
                                                    setFormData({...formData, options: newOpts});
                                                }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.type === 'DIAGRAM_BASED' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
                                <p className="font-bold text-sm text-gray-800">Diagram-Based Choices (MCQ style option list):</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {formData.options.map((opt, i) => (
                                        <div key={i} className="flex items-center">
                                            <span className="font-bold bg-gray-100 text-gray-600 w-8 h-8 flex items-center justify-center rounded-l-md border border-r-0 border-gray-300">{String.fromCharCode(65+i)}</span>
                                            <input type="text" placeholder={`Option content`} required className="flex-1 border border-gray-300 p-2 rounded-r-md text-sm focus:ring-2 focus:ring-green-500"
                                                value={opt} onChange={e => {
                                                    const newOpts = [...formData.options];
                                                    newOpts[i] = e.target.value;
                                                    setFormData({...formData, options: newOpts});
                                                }} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.type === 'ASSERTION_REASON' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Assertion (Statement A)</label>
                                    <textarea required placeholder="Enter the Assertion statement..." className="w-full border border-gray-300 p-2 rounded-lg text-sm" value={formData.assertion} onChange={e=>setFormData({...formData, assertion: e.target.value})}></textarea>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Reason (Statement R)</label>
                                    <textarea required placeholder="Enter the Reason statement..." className="w-full border border-gray-300 p-2 rounded-lg text-sm" value={formData.reason} onChange={e=>setFormData({...formData, reason: e.target.value})}></textarea>
                                </div>
                                <div className="text-xs text-gray-500 italic">
                                    Options A-D are pre-configured to standard combinations:
                                    <ul className="list-disc pl-5 mt-1">
                                        <li>A: Both A and R are true and R is correct explanation of A</li>
                                        <li>B: Both A and R are true but R is not correct explanation of A</li>
                                        <li>C: A is true but R is false</li>
                                        <li>D: A is false but R is true</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {formData.type === 'STATEMENT_BASED' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                                <p className="font-bold text-sm text-gray-800">Statements list:</p>
                                {formData.statements.map((stmt, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                        <span className="font-bold bg-gray-100 text-gray-600 w-10 py-2 text-center rounded border border-gray-300 text-xs">S-{idx+1}</span>
                                        <textarea required placeholder={`Enter Statement ${idx+1}`} className="flex-1 border border-gray-300 p-2 rounded text-sm h-12" value={stmt} onChange={e => {
                                            const newStmts = [...formData.statements];
                                            newStmts[idx] = e.target.value;
                                            setFormData({...formData, statements: newStmts});
                                        }}></textarea>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setFormData({...formData, statements: [...formData.statements, '']})} className="text-xs font-bold text-blue-600 hover:text-blue-800">+ Add Statement</button>

                                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                                    <p className="font-bold text-xs text-gray-700">Statement MCQ Options (A, B, C, D):</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {formData.options.map((opt, idx) => (
                                            <input key={idx} type="text" placeholder={`Option ${String.fromCharCode(65+idx)} (e.g. Statement I is correct, II is incorrect)`} required className="border border-gray-300 p-2 rounded text-xs" value={opt} onChange={e => {
                                                const newOpts = [...formData.options];
                                                newOpts[idx] = e.target.value;
                                                setFormData({...formData, options: newOpts});
                                            }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.type === 'MATCH_FOLLOWING' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                                <p className="font-bold text-sm text-gray-800">Match Pairs (Column A & Column B):</p>
                                <div className="space-y-3">
                                    {formData.matchPairs.map((pair, idx) => (
                                        <div key={idx} className="grid grid-cols-2 gap-4">
                                            <input type="text" placeholder={`Column A Item ${idx+1}`} className="border border-gray-300 p-2 rounded text-xs" value={pair.left} onChange={e => {
                                                const newPairs = [...formData.matchPairs];
                                                newPairs[idx].left = e.target.value;
                                                setFormData({...formData, matchPairs: newPairs});
                                            }} />
                                            <input type="text" placeholder={`Column B Match ${idx+1}`} className="border border-gray-300 p-2 rounded text-xs" value={pair.right} onChange={e => {
                                                const newPairs = [...formData.matchPairs];
                                                newPairs[idx].right = e.target.value;
                                                setFormData({...formData, matchPairs: newPairs});
                                            }} />
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                                    <p className="font-bold text-xs text-gray-700">Matches MCQ Option Lists (A, B, C, D):</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {formData.options.map((opt, idx) => (
                                            <input key={idx} type="text" placeholder={`Option ${String.fromCharCode(65+idx)} (e.g. A-I, B-III, C-II)`} required className="border border-gray-300 p-2 rounded text-xs" value={opt} onChange={e => {
                                                const newOpts = [...formData.options];
                                                newOpts[idx] = e.target.value;
                                                setFormData({...formData, options: newOpts});
                                            }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {formData.type === 'TRUE_FALSE' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-3">
                                <label className="block text-xs font-bold text-gray-700">Correct Answer Choice:</label>
                                <select className="w-full border-2 border-gray-100 p-3 rounded-xl bg-white font-bold text-navy outline-none" value={formData.answer} onChange={e=>setFormData({...formData, answer: e.target.value})}>
                                    <option value="">-- Choose Answer --</option>
                                    <option value="True">True</option>
                                    <option value="False">False</option>
                                </select>
                            </div>
                        )}

                        {formData.type === 'NUMERICAL' && (
                            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Numerical Correct Value</label>
                                    <input type="text" required placeholder="e.g. 4.0 or -12.5" className="w-full border border-gray-300 p-3 rounded-lg text-sm" value={formData.answer} onChange={e=>setFormData({...formData, answer: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Answer Tolerance Range (+/- value)</label>
                                    <input type="number" step="any" placeholder="e.g. 0.01" className="w-full border border-gray-300 p-3 rounded-lg text-sm" value={formData.numericalTolerance} onChange={e=>setFormData({...formData, numericalTolerance: Number(e.target.value)})} />
                                </div>
                            </div>
                        )}

                        {formData.type !== 'TRUE_FALSE' && formData.type !== 'NUMERICAL' && (
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Correct Answer / Key</label>
                                <select required className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-green-500 bg-white" value={formData.answer} onChange={e=>setFormData({...formData, answer: e.target.value})}>
                                    <option value="">-- Select Correct Option --</option>
                                    <option value="A">Option A</option>
                                    <option value="B">Option B</option>
                                    <option value="C">Option C</option>
                                    <option value="D">Option D</option>
                                </select>
                            </div>
                        )}

                        {/* Bilingual Translations Block */}
                        <div className="bg-blue-50/30 p-6 rounded-2xl border border-blue-200/60 space-y-4">
                            <h4 className="font-black text-navy text-xs uppercase tracking-wide flex items-center gap-2">
                                🌐 Bilingual Translations (Optional)
                            </h4>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Question Content Translation</label>
                                <textarea 
                                    placeholder="Enter regional language translation (Hindi, Kannada, etc.) here..." 
                                    className="w-full border border-gray-300 p-3 rounded-lg h-20 focus:ring-2 focus:ring-blue-500 text-sm" 
                                    value={formData.questionTextTranslation || ''} 
                                    onChange={e=>setFormData({...formData, questionTextTranslation: e.target.value})}
                                ></textarea>
                            </div>

                            {formData.options && formData.options.length > 0 && (
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-gray-700">Options Translation</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {formData.options.map((opt, i) => (
                                            <div key={i} className="flex items-center">
                                                <span className="font-bold bg-blue-100 text-blue-800 w-8 h-8 flex items-center justify-center rounded-l-md border border-r-0 border-blue-200 text-xs">
                                                    {String.fromCharCode(65+i)}
                                                </span>
                                                <input 
                                                    type="text" 
                                                    placeholder={`Translated Option`} 
                                                    className="flex-1 border border-gray-300 p-2 rounded-r-md text-xs focus:ring-2 focus:ring-blue-500"
                                                    value={formData.optionsTranslation?.[i] || ''} 
                                                    onChange={e => {
                                                        const newTrans = [...(formData.optionsTranslation || ['', '', '', ''])];
                                                        newTrans[i] = e.target.value;
                                                        setFormData({...formData, optionsTranslation: newTrans});
                                                    }} 
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200">
                            <h4 className="font-black text-navy mb-4 border-b border-gray-200 pb-2">Detailed Solution (Optional)</h4>
                            
                            <label className="block text-sm font-bold text-gray-700 mb-1">Solution Description</label>
                            <textarea placeholder="Enter detailed step-by-step solution here..." className="w-full border border-gray-300 p-3 rounded-lg h-24 focus:ring-2 focus:ring-green-500 mb-4" value={formData.solutionText} onChange={e=>setFormData({...formData, solutionText: e.target.value})}></textarea>
                            
                            <label className="block text-sm font-bold text-gray-700 mb-1 mt-2">Diagramatic Solution / Reference Image</label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white hover:bg-green-50 hover:border-green-400 transition cursor-pointer relative"
                                 onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-green-50', 'border-green-400'); }}
                                 onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-green-50', 'border-green-400'); }}
                                 onDrop={(e) => {
                                     e.preventDefault();
                                     e.currentTarget.classList.remove('bg-green-50', 'border-green-400');
                                     if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                         setSolutionImageFile(e.dataTransfer.files[0]);
                                     }
                                 }}
                            >
                                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) setSolutionImageFile(e.target.files[0]);
                                }} />
                                {solutionImageFile ? (
                                    <div className="flex flex-col items-center">
                                        <div className="text-green-600 mb-2">
                                            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        <span className="font-medium text-gray-800">{solutionImageFile.name}</span>
                                        <span className="text-xs text-gray-500 mt-1">Click or drag to replace</span>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-gray-400 mb-2 text-3xl">📐</div>
                                        <span className="font-medium text-gray-600 block">Drag and drop solution image here</span>
                                        <span className="text-xs text-gray-500">or click to browse from your computer</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <button type="submit" className="w-full bg-navy text-gold font-black py-5 rounded-2xl hover:scale-[1.01] shadow-2xl transition-all transform active:scale-95 mt-6 uppercase tracking-[0.2em] text-xs">
                            {editId ? 'Update Repository Entry' : 'Finalize Repository Entry'}
                        </button>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 mb-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="font-black text-navy text-lg">Total Questions: <span className="text-green-600">{pagination.total || questions.length}</span></span>
                                <span className="text-xs text-gray-400 font-medium">Page {pagination.page} of {pagination.pages}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="px-4 py-2 bg-navy/5 text-navy border border-navy/20 font-bold rounded-xl text-xs hover:bg-navy hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    ← Previous
                                </button>
                                <span className="text-xs font-bold text-gray-700">Page {pagination.page} / {pagination.pages}</span>
                                <button 
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                    className="px-4 py-2 bg-navy/5 text-navy border border-navy/20 font-bold rounded-xl text-xs hover:bg-navy hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
                            <input 
                                type="text"
                                placeholder="🔍 Search question text..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchQuestions(1); } }}
                                className="w-full border border-gray-200 px-4 py-2.5 rounded-xl text-xs outline-none focus:border-navy"
                            />
                            <input 
                                type="text"
                                placeholder="Filter Chapter..."
                                value={chapterFilter}
                                onChange={e => { setChapterFilter(e.target.value); setPage(1); }}
                                className="w-full border border-gray-200 px-4 py-2.5 rounded-xl text-xs outline-none focus:border-navy"
                            />
                            <select 
                                value={typeFilter}
                                onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 bg-white outline-none focus:border-navy"
                            >
                                <option value="">All Question Types</option>
                                <option value="mcq">MCQ / Multiple Choice</option>
                                <option value="assertion">Assertion & Reason</option>
                                <option value="numerical">Numerical Answer</option>
                                <option value="match">Match the Following</option>
                            </select>
                            <select 
                                value={classFilter}
                                onChange={e => { setClassFilter(e.target.value); setPage(1); }}
                                className="w-full border border-gray-200 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 bg-white outline-none focus:border-navy"
                            >
                                <option value="">All Classes</option>
                                <option value="11">Class 11</option>
                                <option value="12">Class 12</option>
                            </select>
                        </div>
                    </div>

                    {questions.map(q => (
                        <div key={q._id} className="border border-gray-200 p-5 rounded-lg shadow-sm bg-white relative group hover:shadow-md transition">
                            <div className="absolute top-4 right-4 hidden group-hover:flex space-x-3 z-10">
                                {q.type === 'MCQ' && (
                                    <button onClick={() => handleConvertNumerical(q)} className="text-green-700 hover:text-green-900 text-sm font-bold bg-green-50 px-3 py-1 rounded">Convert to Numerical</button>
                                )}
                                <button onClick={() => handleEdit(q)} className="text-blue-600 hover:text-blue-800 text-sm font-bold bg-blue-50 px-3 py-1 rounded">Edit</button>
                                <button onClick={() => handleDelete(q._id)} className="text-red-600 hover:text-red-800 text-sm font-bold bg-red-50 px-3 py-1 rounded">Delete</button>
                            </div>
                            <div className="flex items-center flex-wrap gap-2 mb-3">
                                <span className="bg-green-100 text-green-800 text-[10px] px-3 py-1 rounded-full font-bold">{q.questionId}</span>
                                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">Class: {q.classes.join(', ')}</span>
                                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">Type: {q.type}</span>
                                <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">Level: {q.level}</span>
                                {q.sourceType !== 'REGULAR' && (
                                    <span className="text-[10px] font-semibold text-gold bg-navy px-3 py-1 rounded-full">{q.sourceType} ({q.sourceDisplayCode})</span>
                                )}
                            </div>

                            {/* Dynamic Display of Question Content */}
                            {q.type === 'ASSERTION_REASON' ? (
                                <div className="space-y-2 mt-2 text-base text-gray-900 font-medium">
                                    <p><strong>Assertion (A):</strong> <MathRenderer inline={true} text={q.assertion} /></p>
                                    <p><strong>Reason (R):</strong> <MathRenderer inline={true} text={q.reason} /></p>
                                </div>
                            ) : q.type === 'STATEMENT_BASED' ? (
                                <div className="space-y-2 mt-2 text-base text-gray-900 font-medium">
                                    <MathRenderer text={q.questionText} />
                                    {q.statements.map((stmt, idx) => (
                                        <p key={idx}><strong>Statement {idx+1}:</strong> <MathRenderer inline={true} text={stmt} /></p>
                                    ))}
                                </div>
                            ) : q.type === 'MATCH_FOLLOWING' ? (
                                <div className="space-y-2 mt-2 text-base text-gray-900 font-medium">
                                    <MathRenderer text={q.questionText} />
                                    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/50 max-w-md">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr>
                                                    <th className="text-left font-bold pb-2">Column A</th>
                                                    <th className="text-left font-bold pb-2">Column B</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {q.matchPairs?.map((pair, idx) => (
                                                    <tr key={idx}>
                                                        <td className="py-1">{String.fromCharCode(65+idx)}. <MathRenderer inline={true} text={pair.left} /></td>
                                                        <td className="py-1">{idx+1}. <MathRenderer inline={true} text={pair.right} /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <MathRenderer className="mt-2 text-base text-gray-900 font-medium whitespace-pre-wrap" text={q.questionText} />
                            )}

                            {q.imageUrl && (
                                <div className="mt-3">
                                    <img src={q.imageUrl} alt="Question Reference" className="max-h-48 rounded border border-gray-200" />
                                </div>
                            )}
                            
                            {(q.type === 'MCQ' || q.type === 'DIAGRAM_BASED' || q.type === 'ASSERTION_REASON' || q.type === 'STATEMENT_BASED' || q.type === 'MATCH_FOLLOWING') && q.options && q.options.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-100">
                                    {q.options.map((opt, idx) => (
                                        <div key={idx} className="flex"><strong className="mr-1">{optionLabel(idx, q.classes)})</strong> <MathRenderer inline={true} text={opt} /></div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3 text-sm font-bold text-gray-700">
                                Correct Answer: <MathRenderer inline={true} className="text-navy" text={q.answer} />
                            </div>
                            {q.type === 'NUMERICAL' && q.numericalTolerance > 0 && (
                                <div className="text-xs text-gray-500">Tolerance range: +/- {q.numericalTolerance}</div>
                            )}

                            {(q.solutionText || q.solutionImageUrl) && (
                                <div className="mt-4">
                                    <button
                                        type="button"
                                        onClick={() => toggleSolution(q._id)}
                                        className="text-xs font-bold text-green-800 bg-green-50/80 border border-green-200 hover:bg-green-100 px-3.5 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer shadow-sm"
                                    >
                                        <span>💡</span>
                                        <span>{expandedSolutions.has(q._id) ? 'Hide Detailed Solution' : 'Show Detailed Solution'}</span>
                                    </button>
                                    
                                    {expandedSolutions.has(q._id) && (
                                        <div className="mt-3 bg-green-50/60 p-4 rounded-2xl border border-green-200 animate-fade-in-up">
                                            <h5 className="font-bold text-green-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span>💡</span> Detailed Solution & Explanation
                                            </h5>
                                            {q.solutionText && (
                                                <MathRenderer className="text-sm text-gray-700 whitespace-pre-wrap mb-2" text={stripQBPTags(q.solutionText)} />
                                            )}
                                            {q.solutionImageUrl && (
                                                <div className="mt-2">
                                                    <img src={q.solutionImageUrl} alt="Solution Diagram" className="max-h-48 rounded-xl border border-gray-200" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Bottom Pagination controls */}
                    {questions.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between mt-4">
                            <span className="text-xs font-bold text-gray-600">Showing page {pagination.page} of {pagination.pages} ({pagination.total} total questions)</span>
                            <div className="flex items-center gap-2">
                                <button 
                                    disabled={pagination.page <= 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="px-4 py-2 bg-white text-navy border border-gray-300 font-bold rounded-xl text-xs hover:bg-navy hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    ← Previous
                                </button>
                                <button 
                                    disabled={pagination.page >= pagination.pages}
                                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                    className="px-4 py-2 bg-white text-navy border border-gray-300 font-bold rounded-xl text-xs hover:bg-navy hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                    {questions.length === 0 && (
                        <div className="text-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                            <div className="text-gray-400 text-5xl mb-4">📚</div>
                            <h3 className="text-xl font-bold text-gray-700 mb-2">Your Question Bank is Empty</h3>
                            <p className="text-gray-500 mb-6">Start building your database by adding your first question.</p>
                            <button onClick={() => setShowForm(true)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow transition">
                                + Add First Question
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddQuestion;
