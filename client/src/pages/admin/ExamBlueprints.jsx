import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const ExamBlueprints = () => {
    const navigate = useNavigate();
    const [blueprints, setBlueprints] = useState([]);
    const [selectedBP, setSelectedBP] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        examType: 'NEET',
        durationMinutes: 180,
        subjects: []
    });

    // Helper to setup mock blueprint subject layouts in form
    const [newSubject, setNewSubject] = useState({
        subjectName: '',
        totalQuestions: 0,
        sections: [{ sectionName: '', numQuestions: 0, allowedToAnswer: 0, questionTypes: ['MCQ'], markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }]
    });

    const fetchBlueprints = async () => {
        try {
            const res = await api.get('/api/exam-blueprints');
            setBlueprints(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchBlueprints();
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/exam-blueprints', createForm);
            alert('Blueprint created successfully!');
            setShowCreateModal(false);
            setCreateForm({ name: '', examType: 'NEET', durationMinutes: 180, subjects: [] });
            fetchBlueprints();
        } catch (err) {
            alert(err.response?.data?.msg || err.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this blueprint?')) {
            try {
                await api.delete(`/api/exam-blueprints/${id}`);
                fetchBlueprints();
                if (selectedBP?._id === id) setSelectedBP(null);
            } catch (err) {
                alert('Delete failed');
            }
        }
    };

    const handleAddSubjectToForm = () => {
        if (!newSubject.subjectName || newSubject.totalQuestions <= 0) {
            return alert('Please specify subject name and question counts.');
        }
        setCreateForm(prev => ({
            ...prev,
            subjects: [...prev.subjects, { ...newSubject }]
        }));
        setNewSubject({
            subjectName: '',
            totalQuestions: 0,
            sections: [{ sectionName: '', numQuestions: 0, allowedToAnswer: 0, questionTypes: ['MCQ'], markingRules: { correct: 4, incorrect: -1, unattempted: 0 } }]
        });
    };

    return (
        <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-fade-in-up space-y-8">
            <div className="flex justify-between items-center pb-6 border-b border-gray-100 flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-black text-navy uppercase tracking-tight mb-2">Exam Blueprints</h2>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Centralized Blueprint Marking & Section Rules Engine</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowCreateModal(true)} 
                        className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
                    >
                        + Create Blueprint
                    </button>
                    <button 
                        onClick={() => navigate('/admin/dashboard')} 
                        className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm cursor-pointer"
                    >
                        ← Back
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List Blueprints */}
                <div className="lg:col-span-1 space-y-4">
                    <h3 className="text-xs font-black text-navy uppercase tracking-widest mb-4">Available Blueprints</h3>
                    {blueprints.map(bp => (
                        <div 
                            key={bp._id} 
                            onClick={() => setSelectedBP(bp)}
                            className={`p-6 rounded-3xl border cursor-pointer transition-all ${selectedBP?._id === bp._id ? 'border-navy bg-navy/5 shadow-md' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-navy font-black text-sm">{bp.name}</span>
                                <span className="text-[9px] font-black bg-gold text-navy px-2 py-0.5 rounded uppercase tracking-wider">{bp.examType}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate/40 uppercase tracking-wider mt-3">
                                <span>Duration: {bp.durationMinutes} min</span>
                                <span className="text-navy">{bp.subjects?.length || 0} Subjects</span>
                            </div>
                            <div className="flex gap-4 mt-4 items-center">
                                <button 
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!window.confirm(`Auto-generate a new question paper from blueprint "${bp.name}"?`)) return;
                                        try {
                                            const res = await api.post(`/api/exam-blueprints/${bp._id}/generate-paper`);
                                            alert(`Successfully auto-generated paper: "${res.data.title}"! It is now saved as a draft.`);
                                        } catch (err) {
                                            alert(err.response?.data?.msg || err.message);
                                        }
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3 py-1 rounded-xl text-[9px] uppercase tracking-wider transition"
                                >
                                    ⚡ Generate Paper
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(bp._id); }} 
                                    className="text-[10px] text-red-500 font-bold hover:text-red-700 block"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Blueprint details workspace */}
                <div className="lg:col-span-2">
                    {selectedBP ? (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-md space-y-6">
                            <div className="border-b border-gray-100 pb-4 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-navy uppercase tracking-tight">{selectedBP.name}</h3>
                                    <p className="text-[10px] font-bold text-slate/40 uppercase tracking-[0.2em] mt-1">Exam Type: {selectedBP.examType} • Duration: {selectedBP.durationMinutes} min</p>
                                </div>
                                <span className="px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest bg-green-100 text-green-800 uppercase">Active</span>
                            </div>

                            <div className="space-y-6">
                                {selectedBP.subjects?.map((sub, sIdx) => (
                                    <div key={sIdx} className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-4">
                                        <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                                            <h4 className="font-black text-sm text-navy uppercase tracking-wider">{sub.subjectName}</h4>
                                            <span className="text-xs font-bold text-slate/50">Total Qs: {sub.totalQuestions}</span>
                                        </div>

                                        <div className="space-y-4">
                                            {sub.sections?.map((sec, secIdx) => (
                                                <div key={secIdx} className="bg-white p-4 rounded-2xl border border-gray-100 text-xs space-y-2">
                                                    <div className="flex justify-between font-bold text-slate">
                                                        <span>{sec.sectionName || `Section ${secIdx + 1}`}</span>
                                                        <span>{sec.numQuestions} Qs {sec.allowedToAnswer ? `(Answer any ${sec.allowedToAnswer})` : ''}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {sec.questionTypes?.map(t => (
                                                            <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">{t}</span>
                                                        ))}
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate/40 uppercase tracking-widest pt-2 border-t border-gray-50">
                                                        <div>Correct: <span className="text-green-600 font-black">+{sec.markingRules?.correct}</span></div>
                                                        <div>Incorrect: <span className="text-red-500 font-black">{sec.markingRules?.incorrect}</span></div>
                                                        <div>Unattempted: <span className="text-slate font-black">{sec.markingRules?.unattempted}</span></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                            <div className="text-5xl text-gray-400 mb-4">📐</div>
                            <h4 className="text-lg font-black text-navy uppercase tracking-widest mb-2">Blueprint Details</h4>
                            <p className="text-xs text-slate/40 max-w-sm mx-auto leading-relaxed">Select a Blueprint template from the sidebar to inspect subject sections, marking rules, and permitted question types.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Blueprint Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-lg w-full border border-gray-100 max-h-[85vh] overflow-y-auto animate-fade-in-up">
                        <h3 className="font-black text-xl text-navy uppercase tracking-wide mb-6">Create Blueprint</h3>
                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Blueprint Name</label>
                                <input 
                                    type="text" required placeholder="e.g. JEE Mains standard" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})}
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
                                <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Duration (Minutes)</label>
                                <input 
                                    type="number" required placeholder="e.g. 180" 
                                    className="w-full border border-gray-200 p-3 rounded-xl text-xs focus:ring-2 focus:ring-navy outline-none"
                                    value={createForm.durationMinutes} onChange={e => setCreateForm({...createForm, durationMinutes: Number(e.target.value)})}
                                />
                            </div>

                            {/* Added Subjects List Preview */}
                            <div className="space-y-2 border-t pt-4">
                                <p className="font-bold text-xs text-navy uppercase tracking-wider">Subjects Added ({createForm.subjects.length})</p>
                                {createForm.subjects.map((sub, idx) => (
                                    <div key={idx} className="bg-gray-50 p-3 rounded-lg text-xs flex justify-between">
                                        <span>{sub.subjectName}</span>
                                        <span className="font-bold">{sub.totalQuestions} Qs</span>
                                    </div>
                                ))}
                            </div>

                            {/* Subject Adding Mini Form */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                <p className="font-bold text-xs text-navy uppercase tracking-wider">Add Subject Details</p>
                                <input 
                                    type="text" placeholder="Subject Name (e.g. Physics)" 
                                    className="w-full border border-gray-200 p-2 rounded-lg text-xs"
                                    value={newSubject.subjectName} onChange={e => setNewSubject({...newSubject, subjectName: e.target.value})}
                                />
                                <input 
                                    type="number" placeholder="Total Qs count (e.g. 25)" 
                                    className="w-full border border-gray-200 p-2 rounded-lg text-xs"
                                    value={newSubject.totalQuestions || ''} onChange={e => setNewSubject({...newSubject, totalQuestions: Number(e.target.value)})}
                                />
                                <button type="button" onClick={handleAddSubjectToForm} className="bg-navy text-gold w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
                                    + Add Subject
                                </button>
                            </div>

                            <div className="flex gap-4 pt-4 border-t">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 border border-gray-200 text-slate py-3 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                                <button type="submit" className="flex-1 bg-navy text-gold py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Save Blueprint</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExamBlueprints;
