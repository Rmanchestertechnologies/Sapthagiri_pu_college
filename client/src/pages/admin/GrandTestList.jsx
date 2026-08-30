import React, { useState, useEffect } from 'react';
import api from '../../api';
import { sanitize, optionLabel, stripQBPTags } from '../../utils/sanitize';
import MathRenderer from '../../components/MathRenderer';

const GrandTestList = () => {
    const [grandTests, setGrandTests] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedGT, setSelectedGT] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        title: '',
        code: '',
        examType: 'NEET',
        academicYearLevel: 'FIRST_YEAR',
        subject: 'Mixed',
        templateId: ''
    });

    const [importText, setImportText] = useState('');
    const [parsedPreview, setParsedPreview] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [duplicateWarnings, setDuplicateWarnings] = useState([]);

    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editForm, setEditForm] = useState({
        questionText: '',
        options: ['', '', '', ''],
        answer: '',
        chapter: '',
        concept: '',
        level: 'medium',
        solutionText: ''
    });

    // DB Question Replacement State
    const [replacingQuestionId, setReplacingQuestionId] = useState(null);
    const [showReplaceModal, setShowReplaceModal] = useState(false);
    const [dbQuestions, setDbQuestions] = useState([]);
    const [dbSearch, setDbSearch] = useState('');
    const [dbSubject, setDbSubject] = useState('');
    const [dbChapter, setDbChapter] = useState('');
    const [dbLevel, setDbLevel] = useState('');
    const [dbType, setDbType] = useState('');
    const [dbPage, setDbPage] = useState(1);
    const [dbTotalPages, setDbTotalPages] = useState(1);
    const [loadingDb, setLoadingDb] = useState(false);
    const [isGeneratingVariant, setIsGeneratingVariant] = useState(false);

    const handleOpenReplaceModal = (qId) => {
        setReplacingQuestionId(qId);
        setShowReplaceModal(true);
        setDbSearch('');
        setDbChapter('');
        setDbLevel('');
        setDbType('');
        setDbPage(1);
        setDbSubject(selectedGT?.subject && selectedGT.subject !== 'Mixed' ? selectedGT.subject : '');
    };

    const fetchDbQuestions = async () => {
        setLoadingDb(true);
        try {
            const queryParams = new URLSearchParams({
                page: dbPage,
                limit: 8,
                paginated: 'true'
            });
            if (dbSubject) queryParams.append('subject', dbSubject);
            else if (selectedGT?.subject && selectedGT.subject !== 'Mixed') queryParams.append('subject', selectedGT.subject);
            
            if (dbSearch) queryParams.append('search', dbSearch);
            if (dbChapter) queryParams.append('chapter', dbChapter);
            if (dbLevel) queryParams.append('level', dbLevel);
            if (dbType) queryParams.append('type', dbType);

            const res = await api.get(`/api/questions?${queryParams.toString()}`);
            if (res.data.questions) {
                setDbQuestions(res.data.questions);
                setDbTotalPages(res.data.pagination?.pages || 1);
            } else {
                setDbQuestions(res.data || []);
                setDbTotalPages(1);
            }
        } catch (err) {
            console.error('Failed to fetch DB questions:', err);
        } finally {
            setLoadingDb(false);
        }
    };

    useEffect(() => {
        if (showReplaceModal) {
            fetchDbQuestions();
        }
    }, [showReplaceModal, dbPage, dbSubject, dbLevel, dbType]);

    const handleReplaceSubmit = async (newQuestionId) => {
        if (!window.confirm('Are you sure you want to replace this question?')) return;
        try {
            await api.post(`/api/grand-tests/${selectedGT._id}/questions/${replacingQuestionId}/replace`, {
                dbQuestionId: newQuestionId,
                source: 'supabase'
            });
            alert('Question replaced successfully!');
            setShowReplaceModal(false);
            setReplacingQuestionId(null);
            handleOpenGT(selectedGT._id);
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        }
    };

    const handleGenerateVariant = async (qId) => {
        if (!window.confirm('Generate an AI variant for this question? This will replace the current question with a newly generated AI variation.')) return;
        setIsGeneratingVariant(true);
        try {
            await api.post(`/api/questions/${qId}/generate-variant`);
            alert('AI Variant generated and swapped successfully!');
            handleOpenGT(selectedGT._id);
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        } finally {
            setIsGeneratingVariant(false);
        }
    };

    const fetchGrandTests = async () => {
        try {
            const res = await api.get('/api/grand-tests');
            setGrandTests(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchGrandTests();
        api.get('/api/templates').then(res => setTemplates(res.data)).catch(console.error);
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/grand-tests', createForm);
            alert('Grand Test created successfully!');
            setShowCreateModal(false);
            setCreateForm({ title: '', code: '', examType: 'NEET', academicYearLevel: 'FIRST_YEAR', subject: 'Mixed', templateId: '' });
            fetchGrandTests();
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        }
    };

    const handleUpdateTemplate = async (templateId) => {
        try {
            const res = await api.put(`/api/grand-tests/${selectedGT._id}`, { templateId: templateId || null });
            setSelectedGT(prev => ({ ...prev, templateId: res.data.templateId }));
            alert('Template layout updated successfully!');
            fetchGrandTests();
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        }
    };

    const handleOpenGT = async (id) => {
        try {
            const res = await api.get(`/api/grand-tests/${id}`);
            setSelectedGT(res.data);
            setParsedPreview([]);
            setDuplicateWarnings([]);
        } catch (err) {
            alert('Failed to load Grand Test');
        }
    };

    const handleParseText = async () => {
        if (!importText) return alert('Pasted text is empty.');
        setIsParsing(true);
        try {
            const res = await api.post('/api/grand-tests/parse-text', {
                text: importText,
                examType: selectedGT.examType,
                subject: selectedGT.subject
            });
            setParsedPreview(res.data);
            alert(`Gemini parsed ${res.data.length} questions! Review them below.`);
        } catch (err) {
            alert('Parsing failed: ' + (err.response?.data?.msg || err.message));
        }
        setIsParsing(false);
    };

    const handleConfirmImport = async (importAnyway = false) => {
        try {
            const res = await api.post(`/api/grand-tests/${selectedGT._id}/import`, {
                questions: parsedPreview,
                importAnyway
            });

            if (res.data.duplicates) {
                setDuplicateWarnings(res.data.duplicates);
                alert(`Duplicate warning: ${res.data.duplicates.length} questions might be duplicates. Review the warnings below.`);
            } else {
                alert(res.data.msg);
                setParsedPreview([]);
                setImportText('');
                handleOpenGT(selectedGT._id);
            }
        } catch (err) {
            alert('Import failed: ' + (err.response?.data?.msg || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this Grand Test? Associated questions will be converted to REGULAR.')) {
            try {
                await api.delete(`/api/grand-tests/${id}`);
                fetchGrandTests();
                if (selectedGT?._id === id) setSelectedGT(null);
            } catch (err) {
                alert('Delete failed');
            }
        }
    };

    const handleOpenEditQuestion = (q) => {
        setEditingQuestion(q);
        setEditForm({
            questionText: q.questionText || '',
            options: q.options && q.options.length === 4 ? q.options : (q.options || ['', '', '', '']),
            answer: q.answer || '',
            chapter: q.chapter || '',
            concept: q.concept || '',
            level: q.level || 'medium',
            solutionText: q.solutionText || ''
        });
    };

    const handleEditQuestionSubmit = async (e) => {
        e.preventDefault();
        try {
            const submitData = new FormData();
            submitData.append('questionText', editForm.questionText);
            submitData.append('options', JSON.stringify(editForm.options));
            submitData.append('answer', editForm.answer);
            submitData.append('chapter', editForm.chapter);
            submitData.append('concept', editForm.concept);
            submitData.append('level', editForm.level);
            submitData.append('solutionText', editForm.solutionText);

            await api.post(`/api/questions/update/${editingQuestion._id}`, submitData);
            alert('Question updated successfully!');
            setEditingQuestion(null);
            handleOpenGT(selectedGT._id);
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        }
    };

    const handleRemoveQuestion = async (qId) => {
        if (window.confirm('Are you sure you want to remove this question from this Grand Test?')) {
            try {
                await api.delete(`/api/grand-tests/${selectedGT._id}/questions/${qId}`);
                alert('Question removed successfully!');
                handleOpenGT(selectedGT._id);
            } catch (err) {
                alert('Failed to remove question');
            }
        }
    };

    return (
        <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up space-y-8">
            <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                <div>
                    <h2 className="text-3xl font-black text-navy uppercase tracking-tight mb-2">Grand Test Panels</h2>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Institutional Grand Test & Paper Management</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                    + Create Grand Test
                </button>
            </div>

            {/* List & Details View Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* GT Directory List */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-xs font-black text-navy uppercase tracking-widest mb-4">Grand Test Directory</h3>
                    {grandTests.map(gt => (
                        <div 
                            key={gt._id} 
                            onClick={() => handleOpenGT(gt._id)}
                            className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedGT?._id === gt._id ? 'border-navy bg-navy/5 shadow-md' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-navy font-black text-lg">{gt.code}</span>
                                <span className="text-[9px] font-black bg-gold text-navy px-2 py-0.5 rounded uppercase tracking-wider">{gt.examType}</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate mb-3">{gt.title}</h4>
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate/40 uppercase tracking-wider">
                                <span>{gt.academicYearLevel === 'FIRST_YEAR' ? 'Class 11 / 1st Year' : 'Class 12 / 2nd Year'}</span>
                                <span className="text-navy">{gt.questions?.length || 0} Questions</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(gt._id); }} 
                                className="text-[10px] text-red-500 font-bold hover:text-red-700 mt-4 block"
                            >
                                Delete Test
                            </button>
                        </div>
                    ))}
                    {grandTests.length === 0 && (
                        <p className="text-sm font-bold text-slate/30 uppercase tracking-widest text-center py-10">No grand tests added yet.</p>
                    )}
                </div>

                {/* GT Workspace (Parser & Questions List) */}
                <div className="lg:col-span-2 space-y-8">
                    {selectedGT ? (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-md space-y-6">
                            <div className="border-b border-gray-100 pb-4 space-y-4">
                                <div>
                                    <h3 className="text-2xl font-black text-navy uppercase tracking-tight">{selectedGT.title}</h3>
                                    <p className="text-[10px] font-bold text-slate/40 uppercase tracking-[0.2em] mt-1">{selectedGT.examType} • {selectedGT.academicYearLevel} • {selectedGT.subject}</p>
                                </div>
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                    <label className="text-[10px] font-black text-navy/60 uppercase tracking-widest">Template Layout:</label>
                                    <select 
                                        className="border border-gray-200 px-3 py-1.5 rounded-xl text-xs bg-white focus:ring-2 focus:ring-navy outline-none font-bold text-navy"
                                        value={selectedGT.templateId || ''} 
                                        onChange={(e) => handleUpdateTemplate(e.target.value)}
                                    >
                                        <option value="">— None (No Template) —</option>
                                        {templates.map(t => (
                                            <option key={t._id} value={t._id}>{t.name} ({t.templateType || 'LOGO/HEADER'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Paste text parser */}
                            <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-4">
                                <h4 className="font-black text-xs text-navy uppercase tracking-widest">AI Raw Document Ingestion</h4>
                                <p className="text-xs text-slate/50">Paste raw question list containing questions, options, and answer keys below. Gemini AI will structure and categorize them.</p>
                                <textarea 
                                    placeholder="Paste exam questions text here..." 
                                    className="w-full border border-gray-200 p-4 rounded-2xl text-xs h-32 focus:ring-2 focus:ring-navy outline-none font-mono"
                                    value={importText}
                                    onChange={e => setImportText(e.target.value)}
                                />
                                <button 
                                    onClick={handleParseText} 
                                    disabled={isParsing}
                                    className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md w-full disabled:opacity-50"
                                >
                                    {isParsing ? 'Parsing Document using Gemini AI...' : 'Parse Document'}
                                </button>
                            </div>

                            {/* Parsed Previews */}
                            {parsedPreview.length > 0 && (
                                <div className="bg-green-50/20 p-6 rounded-3xl border border-green-100 space-y-4">
                                    <h4 className="font-black text-xs text-green-800 uppercase tracking-widest">Extracted Question Previews ({parsedPreview.length})</h4>
                                    <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                                        {parsedPreview.map((q, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 text-xs">
                                                <div className="flex justify-between font-bold text-[10px] text-slate/40 uppercase tracking-wider mb-2">
                                                    <span>Q-{idx+1} ({q.type})</span>
                                                    <span>Chapter: {q.chapter || 'Unclassified'}</span>
                                                </div>
                                                <p className="font-medium text-slate mb-2">{q.questionText}</p>
                                                {q.options && q.options.length > 0 && (
                                                    <div className="grid grid-cols-2 gap-2 pl-4 text-slate/60 mb-2">
                                                        {q.options.map((o, oi) => <div key={oi}>{optionLabel(oi, selectedGT?.examType ? [selectedGT.examType] : [])}) {o}</div>)}
                                                    </div>
                                                )}
                                                <div className="font-bold text-navy">Answer: {q.answer}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => handleConfirmImport(false)}
                                        className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all w-full"
                                    >
                                        Confirm Import to Question Bank
                                    </button>
                                </div>
                            )}

                            {/* Duplicate Warnings */}
                            {duplicateWarnings.length > 0 && (
                                <div className="bg-red-50/30 p-6 rounded-3xl border border-red-100 space-y-4">
                                    <h4 className="font-black text-xs text-red-800 uppercase tracking-widest">Duplicate Warnings ({duplicateWarnings.length})</h4>
                                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2 text-xs">
                                        {duplicateWarnings.map((dup, idx) => (
                                            <div key={idx} className="p-3 bg-white border border-red-100 rounded-lg">
                                                <strong>Index {dup.index + 1}:</strong> {dup.text.substring(0, 100)}...
                                            </div>
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => handleConfirmImport(true)}
                                        className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all w-full"
                                    >
                                        Import Anyway
                                    </button>
                                </div>
                            )}

                            {/* Questions list inside the GT */}
                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <h4 className="font-black text-xs text-navy uppercase tracking-widest">Assigned Questions ({selectedGT.questions?.length || 0})</h4>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {selectedGT.questions?.map(q => (
                                        <div key={q._id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs relative group">
                                            <div className="absolute top-4 right-4 hidden group-hover:flex space-x-2 z-10">
                                                <button onClick={() => handleOpenEditQuestion(q)} className="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded">Edit</button>
                                                <button onClick={() => handleOpenReplaceModal(q._id)} className="text-purple-600 hover:text-purple-800 font-bold bg-purple-50 px-2 py-1 rounded">Replace</button>
                                                <button onClick={() => handleGenerateVariant(q._id)} disabled={isGeneratingVariant} className="text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 px-2 py-1 rounded disabled:opacity-50">AI Variant</button>
                                                <button onClick={() => handleRemoveQuestion(q._id)} className="text-red-600 hover:text-red-800 font-bold bg-red-50 px-2 py-1 rounded">Remove</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <span className="font-black bg-navy text-gold px-2 py-0.5 rounded text-[8px] tracking-wider uppercase">{q.questionId}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">{q.type}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">Chapter: {q.chapter}</span>
                                                {q.answer && (
                                                    <span className="text-[9px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1">Correct: <MathRenderer inline={true} text={q.answer} /></span>
                                                )}
                                            </div>
                                            <MathRenderer className="font-medium text-slate whitespace-pre-wrap mb-2" text={q.questionText} />
                                            {q.options && q.options.length > 0 && (
                                                <div className="grid grid-cols-2 gap-2 pl-4 text-slate/60 mb-2 border-t border-gray-100/50 pt-2 mt-2">
                                                    {q.options.map((o, oi) => <div key={oi} className="flex"><span className="mr-1">{optionLabel(oi, q.classes || (selectedGT?.examType ? [selectedGT.examType] : []))}</span> <MathRenderer inline={true} text={o} /></div>)}
                                                </div>
                                            )}
                                            {q.solutionText && (
                                                <div className="text-gray-500 bg-green-50/20 p-2 rounded mt-2 border border-green-50/30">
                                                    <strong>Solution:</strong> <MathRenderer inline={true} text={q.solutionText} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {selectedGT.questions?.length === 0 && (
                                        <p className="text-slate/30 font-bold text-xs uppercase tracking-widest text-center py-6">This grand test has 0 imported questions.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                            <div className="text-5xl text-gray-400 mb-4">📑</div>
                            <h4 className="text-lg font-black text-navy uppercase tracking-widest mb-2">GT Workspace</h4>
                            <p className="text-xs text-slate/40 max-w-sm mx-auto leading-relaxed">Select a Grand Test from the sidebar list to inspect questions, import new items, or edit metadata.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create GT Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-gray-100 animate-fade-in-up">
                        <h3 className="font-black text-xl text-navy uppercase tracking-wide mb-6">Create Grand Test</h3>
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Test Title</label>
                                <input 
                                    type="text" required placeholder="e.g. NEET Grand Test 1" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.title} onChange={e => setCreateForm({...createForm, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Test Code / ID</label>
                                <input 
                                    type="text" required placeholder="e.g. NEET-GT-1" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.code} onChange={e => setCreateForm({...createForm, code: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Exam Type</label>
                                <select 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs bg-white focus:ring-2 focus:ring-navy outline-none font-bold"
                                    value={createForm.examType} onChange={e => setCreateForm({...createForm, examType: e.target.value})}
                                >
                                    <option value="NEET">NEET</option>
                                    <option value="JEE">JEE</option>
                                    <option value="CET">CET</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Academic Level</label>
                                <select 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs bg-white focus:ring-2 focus:ring-navy outline-none font-bold"
                                    value={createForm.academicYearLevel} onChange={e => setCreateForm({...createForm, academicYearLevel: e.target.value})}
                                >
                                    <option value="FIRST_YEAR">Class 11 / 1st Year</option>
                                    <option value="SECOND_YEAR">Class 12 / 2nd Year</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Template Layout</label>
                                <select 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs bg-white focus:ring-2 focus:ring-navy outline-none font-bold"
                                    value={createForm.templateId} onChange={e => setCreateForm({...createForm, templateId: e.target.value})}
                                >
                                    <option value="">— None (No Template) —</option>
                                    {templates.map(t => (
                                        <option key={t._id} value={t._id}>{t.name} ({t.templateType || 'LOGO/HEADER'})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 border border-gray-200 text-slate py-3 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 bg-navy text-gold py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        {/* Edit Question Modal */}
            {editingQuestion && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-2xl w-full border border-gray-100 max-h-[90vh] overflow-y-auto animate-fade-in-up">
                        <h3 className="font-black text-xl text-navy uppercase tracking-wide mb-6">Edit Question</h3>
                        <form onSubmit={handleEditQuestionSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Question Text</label>
                                <textarea 
                                    required rows={4}
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={editForm.questionText} onChange={e => setEditForm({...editForm, questionText: e.target.value})}
                                />
                            </div>
                            
                            {editingQuestion.type === 'MCQ' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {editForm.options.map((opt, oIdx) => (
                                        <div key={oIdx}>
                                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Option {String.fromCharCode(65+oIdx)}</label>
                                            <input 
                                                type="text" required
                                                className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                                value={opt} 
                                                onChange={e => {
                                                    const newOpts = [...editForm.options];
                                                    newOpts[oIdx] = e.target.value;
                                                    setEditForm({...editForm, options: newOpts});
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Correct Answer / Option</label>
                                    <input 
                                        type="text" required placeholder={editingQuestion.type === 'MCQ' ? "e.g. Option text or A/B/C/D" : "e.g. 10.5"}
                                        className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                        value={editForm.answer} onChange={e => setEditForm({...editForm, answer: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Difficulty Level</label>
                                    <select 
                                        className="w-full border border-gray-200 p-3 rounded-xl text-xs bg-white focus:ring-2 focus:ring-navy outline-none font-bold"
                                        value={editForm.level} onChange={e => setEditForm({...editForm, level: e.target.value})}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Chapter</label>
                                    <input 
                                        type="text" required
                                        className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                        value={editForm.chapter} onChange={e => setEditForm({...editForm, chapter: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Concept</label>
                                    <input 
                                        type="text" required
                                        className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                        value={editForm.concept} onChange={e => setEditForm({...editForm, concept: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Detailed Solution / Explanation</label>
                                <textarea 
                                    rows={3}
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={editForm.solutionText} onChange={e => setEditForm({...editForm, solutionText: e.target.value})}
                                />
                            </div>

                            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 font-sans">
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Live Question Preview</label>
                                <MathRenderer className="text-xs font-medium text-slate whitespace-pre-wrap" text={editForm.questionText} />
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setEditingQuestion(null)} className="flex-1 border border-gray-200 text-slate py-3 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 bg-navy text-gold py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Replace Question Modal */}
            {showReplaceModal && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-4xl w-full border border-gray-100 max-h-[90vh] overflow-y-auto animate-fade-in-up flex flex-col gap-6 font-sans">
                        <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="font-black text-xl text-navy uppercase tracking-wide">Replace Question</h3>
                                <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] mt-1">Select a question from the database to swap</p>
                            </div>
                            <button onClick={() => setShowReplaceModal(false)} className="text-slate/40 hover:text-red-500 font-bold text-xl">✕</button>
                        </div>

                        {/* Search & Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <div className="md:col-span-2">
                                <label className="block text-[9px] font-black text-navy/40 uppercase tracking-widest mb-1">Search Keywords</label>
                                <input 
                                    type="text" placeholder="Search question text..."
                                    className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white focus:ring-2 focus:ring-navy outline-none"
                                    value={dbSearch} onChange={e => setDbSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchDbQuestions()}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-navy/40 uppercase tracking-widest mb-1">Subject</label>
                                <select 
                                    className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-bold"
                                    value={dbSubject} onChange={e => setDbSubject(e.target.value)}
                                >
                                    <option value="">Any Subject</option>
                                    <option value="Physics">Physics</option>
                                    <option value="Chemistry">Chemistry</option>
                                    <option value="Biology">Biology</option>
                                    <option value="Botany">Botany</option>
                                    <option value="Zoology">Zoology</option>
                                    <option value="Maths">Maths</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] font-black text-navy/40 uppercase tracking-widest mb-1">Difficulty</label>
                                <select 
                                    className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-bold"
                                    value={dbLevel} onChange={e => setDbLevel(e.target.value)}
                                >
                                    <option value="">Any Level</option>
                                    <option value="easy">Easy</option>
                                    <option value="medium">Medium</option>
                                    <option value="hard">Hard</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={fetchDbQuestions}
                                    className="w-full bg-navy text-gold py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-md"
                                >
                                    Search
                                </button>
                            </div>
                        </div>

                        {/* Questions List */}
                        <div className="flex-1 overflow-y-auto space-y-4 max-h-[40vh] pr-2">
                            {loadingDb ? (
                                <p className="text-center text-xs font-bold text-slate/40 uppercase tracking-widest py-10">Loading database questions...</p>
                            ) : dbQuestions.length === 0 ? (
                                <p className="text-center text-xs font-bold text-slate/40 uppercase tracking-widest py-10">No questions found matching filters.</p>
                            ) : (
                                dbQuestions.map(q => (
                                    <div key={q.id || q._id} className="p-4 border border-gray-100 hover:border-navy/20 rounded-2xl bg-gray-50/50 flex flex-col gap-2 relative group text-xs">
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-wrap gap-2">
                                                <span className="font-black bg-navy text-gold px-2 py-0.5 rounded text-[8px] tracking-wider uppercase">{q.subject}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">{q.type}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">Chapter: {q.chapter}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">Level: {q.level}</span>
                                            </div>
                                            <button 
                                                onClick={() => handleReplaceSubmit(q.id || q._id)}
                                                className="bg-purple-600 text-white px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-purple-700 transition"
                                            >
                                                Select & Replace
                                            </button>
                                        </div>
                                        <MathRenderer className="font-medium text-slate mt-1" text={q.questionText || q.question} />
                                        {q.options && q.options.length > 0 && (
                                            <div className="grid grid-cols-2 gap-2 pl-4 text-slate/60 mt-1">
                                                {q.options.map((o, oi) => <div key={oi} className="flex"><span className="mr-1">{optionLabel(oi, q.classes || (selectedGT?.examType ? [selectedGT.examType] : []))}</span> <MathRenderer inline={true} text={o} /></div>)}
                                            </div>
                                        )}
                                        <div className="font-bold text-green-700 mt-1">Correct Answer: <MathRenderer inline={true} text={q.answer || q.correct_option} /></div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination */}
                        {dbTotalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 pt-4 border-t border-gray-100">
                                <button 
                                    disabled={dbPage === 1}
                                    onClick={() => setDbPage(p => Math.max(1, p - 1))}
                                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-40"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-bold text-slate/60">Page {dbPage} of {dbTotalPages}</span>
                                <button 
                                    disabled={dbPage === dbTotalPages}
                                    onClick={() => setDbPage(p => Math.min(dbTotalPages, p + 1))}
                                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GrandTestList;
