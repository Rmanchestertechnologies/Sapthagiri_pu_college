import React, { useState, useEffect } from 'react';
import api from '../../api';

const PreviousYearPapers = () => {
    const [papers, setPapers] = useState([]);
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        title: '',
        examType: 'NEET',
        year: new Date().getFullYear(),
        subject: 'Mixed',
        shift: ''
    });

    const [importText, setImportText] = useState('');
    const [parsedPreview, setParsedPreview] = useState([]);
    const [isParsing, setIsParsing] = useState(false);
    const [duplicateWarnings, setDuplicateWarnings] = useState([]);

    const fetchPapers = async () => {
        try {
            const res = await api.get('/api/previous-year-papers');
            setPapers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchPapers();
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/previous-year-papers', createForm);
            alert('Previous Year Paper created successfully!');
            setShowCreateModal(false);
            setCreateForm({ title: '', examType: 'NEET', year: new Date().getFullYear(), subject: 'Mixed', shift: '' });
            fetchPapers();
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        }
    };

    const handleOpenPaper = async (id) => {
        try {
            const res = await api.get(`/api/previous-year-papers/${id}`);
            setSelectedPaper(res.data);
            setParsedPreview([]);
            setDuplicateWarnings([]);
        } catch (err) {
            alert('Failed to load Previous Year Paper');
        }
    };

    const handleParseText = async () => {
        if (!importText) return alert('Pasted text is empty.');
        setIsParsing(true);
        try {
            // Re-use the parse text endpoint in grand-tests since the prompt parsing is general
            const res = await api.post('/api/grand-tests/parse-text', {
                text: importText,
                examType: selectedPaper.examType,
                subject: selectedPaper.subject
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
            const res = await api.post(`/api/previous-year-papers/${selectedPaper._id}/import`, {
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
                handleOpenPaper(selectedPaper._id);
            }
        } catch (err) {
            alert('Import failed: ' + (err.response?.data?.msg || err.message));
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this Previous Year Paper? Associated questions will be converted to REGULAR.')) {
            try {
                await api.delete(`/api/previous-year-papers/${id}`);
                fetchPapers();
                if (selectedPaper?._id === id) setSelectedPaper(null);
            } catch (err) {
                alert('Delete failed');
            }
        }
    };

    return (
        <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up space-y-8">
            <div className="flex justify-between items-center pb-6 border-b border-gray-100">
                <div>
                    <h2 className="text-3xl font-black text-navy uppercase tracking-tight mb-2">Previous Year Papers</h2>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Archive of PYQs & Shift Classification</p>
                </div>
                <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                    + Upload PYQ Paper
                </button>
            </div>

            {/* List & Workspace Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* PYQ Papers List */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-xs font-black text-navy uppercase tracking-widest mb-4">PYQ Directory</h3>
                    {papers.map(p => (
                        <div 
                            key={p._id} 
                            onClick={() => handleOpenPaper(p._id)}
                            className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedPaper?._id === p._id ? 'border-navy bg-navy/5 shadow-md' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-navy font-black text-lg">{p.year}</span>
                                <span className="text-[9px] font-black bg-gold text-navy px-2 py-0.5 rounded uppercase tracking-wider">{p.examType}</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate mb-3">{p.title}</h4>
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate/40 uppercase tracking-wider">
                                <span>{p.shift || 'Full Paper'}</span>
                                <span className="text-navy">{p.questions?.length || 0} Qs</span>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(p._id); }} 
                                className="text-[10px] text-red-500 font-bold hover:text-red-700 mt-4 block"
                            >
                                Delete Archive
                            </button>
                        </div>
                    ))}
                    {papers.length === 0 && (
                        <p className="text-sm font-bold text-slate/30 uppercase tracking-widest text-center py-10">No PYQ papers uploaded yet.</p>
                    )}
                </div>

                {/* PYQ Workspace */}
                <div className="lg:col-span-2 space-y-8">
                    {selectedPaper ? (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-md space-y-6">
                            <div className="border-b border-gray-100 pb-4">
                                <h3 className="text-2xl font-black text-navy uppercase tracking-tight">{selectedPaper.title}</h3>
                                <p className="text-[10px] font-bold text-slate/40 uppercase tracking-[0.2em] mt-1">{selectedPaper.examType} • {selectedPaper.year} • {selectedPaper.shift || 'Standard Session'} • {selectedPaper.subject}</p>
                            </div>

                            {/* Raw text importer */}
                            <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-4">
                                <h4 className="font-black text-xs text-navy uppercase tracking-widest">AI PYQ Document Ingestion</h4>
                                <p className="text-xs text-slate/50">Paste raw PYQ exam text containing questions, options, and answer keys below. Gemini AI will structure and categorize them.</p>
                                <textarea 
                                    placeholder="Paste PYQ questions text here..." 
                                    className="w-full border border-gray-200 p-4 rounded-2xl text-xs h-32 focus:ring-2 focus:ring-navy outline-none font-mono"
                                    value={importText}
                                    onChange={e => setImportText(e.target.value)}
                                />
                                <button 
                                    onClick={handleParseText} 
                                    disabled={isParsing}
                                    className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md w-full disabled:opacity-50"
                                >
                                    {isParsing ? 'Parsing PYQ using Gemini AI...' : 'Parse PYQ'}
                                </button>
                            </div>

                            {/* Preview Parsed */}
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
                                                        {q.options.map((o, oi) => <div key={oi}>{String.fromCharCode(65+oi)}) {o}</div>)}
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

                            {/* Duplicate Warning */}
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

                            {/* PYQ Questions List */}
                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                <h4 className="font-black text-xs text-navy uppercase tracking-widest">Assigned Questions ({selectedPaper.questions?.length || 0})</h4>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {selectedPaper.questions?.map(q => (
                                        <div key={q._id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs">
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <span className="font-black bg-navy text-gold px-2 py-0.5 rounded text-[8px] tracking-wider uppercase">{q.questionId}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">{q.type}</span>
                                                <span className="text-[9px] font-bold text-slate/40 uppercase tracking-wider">Chapter: {q.chapter}</span>
                                            </div>
                                            <p className="font-medium text-slate whitespace-pre-wrap">{q.questionText}</p>
                                        </div>
                                    ))}
                                    {selectedPaper.questions?.length === 0 && (
                                        <p className="text-slate/30 font-bold text-xs uppercase tracking-widest text-center py-6">This PYQ paper has 0 imported questions.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                            <div className="text-5xl text-gray-400 mb-4">📚</div>
                            <h4 className="text-lg font-black text-navy uppercase tracking-widest mb-2">PYQ Workspace</h4>
                            <p className="text-xs text-slate/40 max-w-sm mx-auto leading-relaxed">Select a Previous Year Paper from the sidebar to import historical items or review questions.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create PYQ Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-gray-100 animate-fade-in-up">
                        <h3 className="font-black text-xl text-navy uppercase tracking-wide mb-6">Create PYQ Record</h3>
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Paper Title</label>
                                <input 
                                    type="text" required placeholder="e.g. NEET 2024 Biology Paper" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.title} onChange={e => setCreateForm({...createForm, title: e.target.value})}
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
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Academic Year</label>
                                <input 
                                    type="number" required placeholder="e.g. 2024" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.year} onChange={e => setCreateForm({...createForm, year: Number(e.target.value)})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Shift / Session (Optional)</label>
                                <input 
                                    type="text" placeholder="e.g. Session 1 Shift A" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.shift} onChange={e => setCreateForm({...createForm, shift: e.target.value})}
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 border border-gray-200 text-slate py-3 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 bg-navy text-gold py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PreviousYearPapers;
