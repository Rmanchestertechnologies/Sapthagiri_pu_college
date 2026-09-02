import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import { AuthContext } from '../../../context/AuthContext';

const TeacherOmr = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Check OMR Permission
    const hasOmrAccess = Boolean(user?.role === 'admin' || user?.omrAccess || user?.omr_access);

    // State
    const [papers, setPapers] = useState([]);
    const [selectedPaperId, setSelectedPaperId] = useState('');
    const [paperKeyData, setPaperKeyData] = useState(null);
    const [loadingPapers, setLoadingPapers] = useState(true);
    const [loadingKey, setLoadingKey] = useState(false);

    // Exam & Scoring Configuration
    const DEFAULT_MARKING_SCHEMES = {
        KCET: { correct: 1, wrong: 0, blank: 0 },
        JEE: { correct: 4, wrong: -1, blank: 0 },
        NEET: { correct: 4, wrong: -1, blank: 0 }
    };
    const [examType, setExamType] = useState('NEET');
    const [markingScheme, setMarkingScheme] = useState({ correct: 4, wrong: -1, blank: 0 });

    const handleExamTypeChange = (type) => {
        setExamType(type);
        if (DEFAULT_MARKING_SCHEMES[type]) {
            setMarkingScheme({ ...DEFAULT_MARKING_SCHEMES[type] });
        }
    };

    // Active Tab
    const [activeTab, setActiveTab] = useState('select'); // 'select', 'scan', 'results', 'student'

    // Upload & Scanning State
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [batchSummary, setBatchSummary] = useState(null);

    // Results State
    const [resultsData, setResultsData] = useState(null);
    const [loadingResults, setLoadingResults] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [sortField, setSortField] = useState('rank');
    const [sortOrder, setSortOrder] = useState('asc');

    // Student Analysis State
    const [selectedStudentRoll, setSelectedStudentRoll] = useState('');
    const [studentAnalysis, setStudentAnalysis] = useState(null);
    const [loadingStudent, setLoadingStudent] = useState(false);

    const fileInputRef = useRef(null);

    // Load available QPG papers
    useEffect(() => {
        if (!hasOmrAccess) return;
        const fetchPapers = async () => {
            try {
                setLoadingPapers(true);
                const res = await api.get('/api/omr/papers');
                const list = res.data?.papers || [];
                setPapers(list);
                if (list.length > 0) {
                    setSelectedPaperId(list[0].id || list[0]._id);
                }
            } catch (err) {
                console.error('Failed to load QPG papers:', err);
            } finally {
                setLoadingPapers(false);
            }
        };
        fetchPapers();
    }, [hasOmrAccess]);

    // Load selected paper's answer key & concepts
    useEffect(() => {
        if (!selectedPaperId) return;
        const fetchPaperKey = async () => {
            try {
                setLoadingKey(true);
                const res = await api.get(`/api/omr/papers/${selectedPaperId}/key`);
                setPaperKeyData(res.data);

                // Auto-detect exam type from paper title / classes / type
                const paperObj = papers.find(p => String(p.id || p._id) === String(selectedPaperId));
                const titleStr = `${paperObj?.title || ''} ${(paperObj?.classes || []).join(' ')} ${res.data?.paper?.examType || ''}`.toUpperCase();
                if (titleStr.includes('KCET') || titleStr.includes('CET')) {
                    handleExamTypeChange('KCET');
                } else if (titleStr.includes('JEE')) {
                    handleExamTypeChange('JEE');
                } else if (titleStr.includes('NEET')) {
                    handleExamTypeChange('NEET');
                }
            } catch (err) {
                console.error('Failed to load answer key:', err);
                setPaperKeyData(null);
            } finally {
                setLoadingKey(false);
            }
        };
        fetchPaperKey();
        fetchResults(selectedPaperId);
    }, [selectedPaperId]);

    // Fetch batch results for paper
    const fetchResults = async (paperId) => {
        if (!paperId) return;
        try {
            setLoadingResults(true);
            const res = await api.get(`/api/omr/results/${paperId}`);
            setResultsData(res.data);
        } catch (err) {
            console.error('Failed to load results:', err);
        } finally {
            setLoadingResults(false);
        }
    };

    // Fetch individual student analysis
    const handleViewStudentAnalysis = async (rollNo) => {
        if (!rollNo || !selectedPaperId) return;
        setSelectedStudentRoll(rollNo);
        try {
            setLoadingStudent(true);
            const res = await api.get(`/api/omr/results/${selectedPaperId}/student/${encodeURIComponent(rollNo)}`);
            setStudentAnalysis(res.data);
            setActiveTab('student');
        } catch (err) {
            alert('Failed to load student analysis: ' + (err.response?.data?.msg || err.message));
        } finally {
            setLoadingStudent(false);
        }
    };

    // Handle File Selection
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setSelectedFiles(files);
        }
    };

    // Handle Bulk Scan Submission
    const handleStartScanning = async () => {
        if (selectedFiles.length === 0) {
            alert('Please select or capture at least one OMR sheet image.');
            return;
        }
        if (!selectedPaperId) {
            alert('Please select a QPG Question Paper first.');
            return;
        }

        const formData = new FormData();
        formData.append('paperId', selectedPaperId);
        formData.append('examType', examType);
        formData.append('correctMarks', markingScheme.correct);
        formData.append('wrongMarks', markingScheme.wrong);
        formData.append('blankMarks', markingScheme.blank);

        selectedFiles.forEach((f) => {
            formData.append('sheets', f);
        });

        try {
            setIsScanning(true);
            setScanProgress(20);

            const timer = setInterval(() => {
                setScanProgress((prev) => (prev < 90 ? prev + 10 : prev));
            }, 800);

            const res = await api.post('/api/omr/scan', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            clearInterval(timer);
            setScanProgress(100);

            setBatchSummary(res.data);
            await fetchResults(selectedPaperId);
            setSelectedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = '';

            setTimeout(() => {
                setActiveTab('results');
                setIsScanning(false);
                setScanProgress(0);
            }, 600);

        } catch (err) {
            setIsScanning(false);
            setScanProgress(0);
            alert('OMR scanning error: ' + (err.response?.data?.msg || err.message));
        }
    };

    // Export Result Sheet to CSV
    const handleExportCSV = () => {
        if (!resultsData || !resultsData.submissions || resultsData.submissions.length === 0) {
            alert('No result data to export.');
            return;
        }

        const subs = resultsData.submissions;
        const allSubjects = Object.keys(subs[0]?.subjectScores || {});

        let header = ['Rank', 'Roll No', 'Student Name', 'Series', 'Total Score', 'Correct', 'Wrong', 'Not Attempted'];
        allSubjects.forEach(s => {
            header.push(`${s} Score`, `${s} Correct`, `${s} Wrong`, `${s} Blank`);
        });

        const rows = subs.map(s => {
            const row = [
                s.rank,
                `"${s.rollNumber}"`,
                `"${s.studentName}"`,
                s.series,
                s.scoreData.totalScore || 0,
                s.scoreData.correctCount || 0,
                s.scoreData.wrongCount || 0,
                s.scoreData.blankCount || 0
            ];
            allSubjects.forEach(subName => {
                const subStat = s.subjectScores[subName] || {};
                row.push(subStat.score || 0, subStat.correct || 0, subStat.wrong || 0, subStat.notAttempted || 0);
            });
            return row.join(',');
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `OMR_Results_${paperKeyData?.title || selectedPaperId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!hasOmrAccess) {
        return (
            <div className="max-w-3xl mx-auto p-12 text-center bg-white rounded-3xl border border-red-200 shadow-xl mt-12 animate-fade-in-up">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    🔒
                </div>
                <h2 className="text-2xl font-black text-navy uppercase tracking-tight mb-2">Access Denied</h2>
                <p className="text-sm font-semibold text-slate-600 max-w-md mx-auto mb-6">
                    You do not have permission to access the OMR Module. Please contact the College Administrator to assign OMR evaluation access to your account.
                </p>
                <button
                    onClick={() => navigate('/teacher/dashboard')}
                    className="bg-navy text-gold px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition"
                >
                    Return to Workspace
                </button>
            </div>
        );
    }

    const selectedPaper = papers.find(p => (p.id || p._id) === selectedPaperId);

    // Filter and Sort Submissions
    const filteredSubmissions = (resultsData?.submissions || [])
        .filter(s => {
            if (!searchFilter.trim()) return true;
            const q = searchFilter.toLowerCase();
            return (s.rollNumber || '').toLowerCase().includes(q) || (s.studentName || '').toLowerCase().includes(q);
        })
        .sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (sortField === 'totalScore') {
                valA = a.scoreData?.totalScore || 0;
                valB = b.scoreData?.totalScore || 0;
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in-up font-sans">
            {/* Top Navigation Banner */}
            <div className="bg-gradient-to-r from-navy via-navy to-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-gold/30 flex flex-wrap items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-gold/5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-gold text-navy text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow">
                            OMR Module
                        </span>
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                            Live Integration
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        Optical Mark Recognition Evaluation
                    </h1>
                    <p className="text-xs text-gold/70 font-semibold mt-1">
                        Automated bubble detection, scoring against QPG answer keys, and student concept diagnostics.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <button
                        onClick={() => navigate('/teacher/dashboard')}
                        className="bg-white/10 text-white border border-white/20 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition cursor-pointer"
                    >
                        ← Dashboard
                    </button>
                </div>
            </div>

            {/* Step Navigation Tabs */}
            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-2">
                <button
                    onClick={() => setActiveTab('select')}
                    className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        activeTab === 'select' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[10px]">1</span>
                    <span>QPG Paper & Key</span>
                </button>

                <button
                    onClick={() => setActiveTab('scan')}
                    className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        activeTab === 'scan' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[10px]">2</span>
                    <span>Upload & Scan Sheets</span>
                </button>

                <button
                    onClick={() => setActiveTab('results')}
                    className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        activeTab === 'results' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[10px]">3</span>
                    <span>Class Result Sheet {resultsData?.totalStudents ? `(${resultsData.totalStudents})` : ''}</span>
                </button>

                <button
                    onClick={() => {
                        if (resultsData?.submissions?.length > 0 && !selectedStudentRoll) {
                            handleViewStudentAnalysis(resultsData.submissions[0].rollNumber);
                        } else {
                            setActiveTab('student');
                        }
                    }}
                    className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        activeTab === 'student' ? 'bg-navy text-gold shadow-md' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                    <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[10px]">4</span>
                    <span>Student Diagnostics</span>
                </button>
            </div>

            {/* ── TAB 1: SELECT QPG PAPER & CONFIGURE ── */}
            {activeTab === 'select' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Paper Selector & Exam Settings */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                            <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <span className="text-gold text-base">📚</span> Select QPG Question Paper
                            </h3>

                            {loadingPapers ? (
                                <div className="py-8 text-center text-xs font-bold text-slate-400 animate-pulse">
                                    Loading question papers...
                                </div>
                            ) : papers.length === 0 ? (
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs font-bold text-amber-800">
                                    No question papers found. Please create a question paper in QPG first.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">
                                            Available Papers
                                        </label>
                                        <select
                                            value={selectedPaperId}
                                            onChange={(e) => setSelectedPaperId(e.target.value)}
                                            className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none cursor-pointer transition shadow-sm text-sm"
                                        >
                                            {papers.map((p) => (
                                                <option key={p.id || p._id} value={p.id || p._id}>
                                                    {p.title} ({p.subject} • {p.questionCount}Q)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2 ml-1">
                                            OMR Grid Calibration Model
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['NEET', 'KCET', 'JEE'].map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => handleExamTypeChange(type)}
                                                    className={`py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all border ${
                                                        examType === type
                                                            ? 'bg-navy text-gold border-navy shadow-sm'
                                                            : 'bg-gray-50 border-gray-200 text-slate-600 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>

                                        {examType === 'KCET' && (
                                            <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 font-medium leading-tight">
                                                <span className="font-bold">✓ KCET Official Rules:</span> +1 Mark per question • <strong>No negative marking</strong> (Wrong = 0).
                                            </div>
                                        )}
                                        {examType === 'JEE' && (
                                            <div className="mt-2.5 p-2 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 font-medium leading-tight">
                                                <span className="font-bold">✓ JEE Main Rules:</span> +4 Marks for correct • <strong>-1 Mark penalty</strong> for wrong.
                                            </div>
                                        )}
                                        {examType === 'NEET' && (
                                            <div className="mt-2.5 p-2 bg-purple-50 border border-purple-200 rounded-xl text-[11px] text-purple-800 font-medium leading-tight">
                                                <span className="font-bold">✓ NEET UG Rules:</span> +4 Marks for correct • <strong>-1 Mark penalty</strong> for wrong.
                                            </div>
                                        )}
                                    </div>

                                    {/* Marking Scheme */}
                                    <div className="pt-2 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-3 ml-1">
                                            <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest">
                                                Marking Scheme
                                            </label>
                                            <span className="text-[10px] text-gray-500 font-medium">
                                                {examType === 'KCET' ? 'No negative marking' : 'Negative marking enabled'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <span className="block text-[9px] font-black text-emerald-600 uppercase mb-1">Correct</span>
                                                <input
                                                    type="number"
                                                    value={markingScheme.correct}
                                                    onChange={(e) => setMarkingScheme({ ...markingScheme, correct: Number(e.target.value) })}
                                                    className="w-full border border-gray-200 p-2.5 rounded-xl font-black text-center text-navy text-sm outline-none focus:border-navy"
                                                />
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black text-red-600 uppercase mb-1">Wrong</span>
                                                <input
                                                    type="number"
                                                    value={markingScheme.wrong}
                                                    onChange={(e) => setMarkingScheme({ ...markingScheme, wrong: Number(e.target.value) })}
                                                    className="w-full border border-gray-200 p-2.5 rounded-xl font-black text-center text-navy text-sm outline-none focus:border-navy"
                                                />
                                            </div>
                                            <div>
                                                <span className="block text-[9px] font-black text-slate-500 uppercase mb-1">Blank</span>
                                                <input
                                                    type="number"
                                                    value={markingScheme.blank}
                                                    onChange={(e) => setMarkingScheme({ ...markingScheme, blank: Number(e.target.value) })}
                                                    className="w-full border border-gray-200 p-2.5 rounded-xl font-black text-center text-navy text-sm outline-none focus:border-navy"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setActiveTab('scan')}
                                        className="w-full bg-gold text-navy font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:shadow-xl hover:scale-[1.02] transition shadow-md mt-4 cursor-pointer"
                                    >
                                        Proceed to Scan Sheets →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Retrieved QPG Answer Key & Concept Mapping Overview */}
                    <div className="lg:col-span-2">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-xs font-black text-navy uppercase tracking-[0.2em] flex items-center gap-2">
                                        <span>🔑</span> QPG Verified Answer Key &amp; Concept Mapping
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-1">
                                        Source of truth retrieved directly from QPG questions database.
                                    </p>
                                </div>
                                {paperKeyData && (
                                    <span className="bg-navy text-gold text-xs font-black px-4 py-1.5 rounded-xl uppercase">
                                        {paperKeyData.totalQuestions} Questions Loaded
                                    </span>
                                )}
                            </div>

                            {loadingKey ? (
                                <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">
                                    Loading questions and answer key metadata...
                                </div>
                            ) : !paperKeyData || paperKeyData.questions?.length === 0 ? (
                                <div className="py-12 text-center text-xs font-bold text-slate-400">
                                    No questions found for this paper.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Subjects & Concepts Summary */}
                                    <div className="flex flex-wrap gap-2">
                                        {paperKeyData.subjects?.map((sub) => (
                                            <span key={sub} className="bg-slate-100 text-navy text-[11px] font-black px-3 py-1 rounded-xl border border-slate-200">
                                                🔬 {sub}
                                            </span>
                                        ))}
                                        {paperKeyData.concepts?.slice(0, 5).map((conc) => (
                                            <span key={conc} className="bg-gold/15 text-navy text-[11px] font-bold px-3 py-1 rounded-xl border border-gold/30">
                                                💡 {conc}
                                            </span>
                                        ))}
                                        {paperKeyData.concepts?.length > 5 && (
                                            <span className="bg-gray-100 text-slate-500 text-[11px] font-bold px-3 py-1 rounded-xl">
                                                +{paperKeyData.concepts.length - 5} more concepts
                                            </span>
                                        )}
                                    </div>

                                    {/* Question & Answer Grid */}
                                    <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-2xl">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-slate-50 sticky top-0 border-b border-gray-200 text-navy font-black text-[10px] uppercase tracking-wider">
                                                <tr>
                                                    <th className="p-3">Q#</th>
                                                    <th className="p-3">Subject</th>
                                                    <th className="p-3">Concept / Topic</th>
                                                    <th className="p-3 text-center">Correct Key</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                                                {paperKeyData.questions.map((q) => (
                                                    <tr key={q.id} className="hover:bg-slate-50/50">
                                                        <td className="p-3 font-black text-navy">{q.questionNumber}</td>
                                                        <td className="p-3 font-semibold text-slate-600">{q.subject}</td>
                                                        <td className="p-3 text-slate-600">{q.concept}</td>
                                                        <td className="p-3 text-center font-black">
                                                            <span className="inline-block px-2.5 py-1 rounded-lg bg-navy text-gold font-black shadow-sm min-w-[32px] text-center text-xs tracking-wide">
                                                                {q.correctAnswer || '—'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── TAB 2: SCAN & UPLOAD OMR SHEETS ── */}
            {activeTab === 'scan' && (
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-gold/20 text-navy rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner">
                            📷
                        </div>
                        <h2 className="text-xl font-black text-navy uppercase tracking-tight mb-2">
                            Upload OMR Sheets for Evaluation
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold max-w-lg mx-auto mb-8">
                            Select single or multiple scanned OMR sheets (bulk upload supported). The system automatically crops canonical registration markers, extracts the Roll Number, and evaluates bubbles.
                        </p>

                        {/* File Picker / Drop Zone */}
                        <div
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            className="border-3 border-dashed border-gold/50 bg-amber-50/30 hover:bg-amber-50/60 p-10 rounded-3xl transition cursor-pointer flex flex-col items-center justify-center gap-3 mb-6 group"
                        >
                            <span className="text-4xl group-hover:scale-110 transition-transform">📂</span>
                            <span className="font-black text-sm text-navy">
                                {selectedFiles.length > 0
                                    ? `${selectedFiles.length} OMR sheet(s) selected`
                                    : 'Click to select or drag and drop OMR sheet images'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400">
                                Supports JPG, JPEG, PNG • Up to 100 sheets in a single batch
                            </span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/jpg"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>

                        {/* Selected Files List Preview */}
                        {selectedFiles.length > 0 && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 text-left max-h-40 overflow-y-auto">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                    Queued Sheets ({selectedFiles.length}):
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedFiles.map((f, i) => (
                                        <span key={i} className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 shadow-sm">
                                            📄 {f.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Progress Bar */}
                        {isScanning && (
                            <div className="mb-6 space-y-2">
                                <div className="flex justify-between text-xs font-black text-navy uppercase tracking-wider">
                                    <span>Processing OMR Sheets...</span>
                                    <span>{scanProgress}%</span>
                                </div>
                                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-gold to-navy transition-all duration-300"
                                        style={{ width: `${scanProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {/* Batch Action Buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <button
                                onClick={handleStartScanning}
                                disabled={isScanning || selectedFiles.length === 0}
                                className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg ${
                                    isScanning || selectedFiles.length === 0
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-gold text-navy hover:scale-105 hover:shadow-xl cursor-pointer'
                                }`}
                            >
                                {isScanning ? 'Evaluating Sheets...' : `Start OMR Evaluation (${selectedFiles.length}) →`}
                            </button>

                            {selectedFiles.length > 0 && !isScanning && (
                                <button
                                    onClick={() => {
                                        setSelectedFiles([]);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    }}
                                    className="px-6 py-4 rounded-2xl border border-gray-200 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-gray-50 transition cursor-pointer"
                                >
                                    Clear Queue
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── TAB 3: RESULT SHEET (CLASS OVERVIEW) ── */}
            {activeTab === 'results' && (
                <div className="space-y-8">
                    {/* Summary Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                Total Processed
                            </span>
                            <span className="text-3xl font-black text-navy">
                                {resultsData?.totalStudents || 0}
                            </span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                Class Average
                            </span>
                            <span className="text-3xl font-black text-gold">
                                {resultsData?.aggregate?.avgScore || 0}
                            </span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                Highest Score
                            </span>
                            <span className="text-3xl font-black text-emerald-600">
                                {resultsData?.aggregate?.topScore || 0}
                            </span>
                        </div>
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                Correct / Wrong / Blank
                            </span>
                            <div className="text-xs font-black space-x-1.5 mt-2">
                                <span className="text-emerald-600 font-black">{resultsData?.aggregate?.totalCorrect || 0} C</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-red-500 font-black">{resultsData?.aggregate?.totalWrong || 0} W</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-400 font-black">{resultsData?.aggregate?.totalBlank || 0} NA</span>
                            </div>
                        </div>
                    </div>

                    {/* Result Sheet Table */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                                    Candidate Score Sheet — {paperKeyData?.title || 'Selected Exam'}
                                </h3>
                                <p className="text-xs text-slate-400 font-semibold mt-1">
                                    Click any candidate to open detailed question-by-question &amp; concept error diagnostics.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    placeholder="Search Roll No or Name..."
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    className="border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-navy outline-none focus:border-navy"
                                />

                                <button
                                    onClick={handleExportCSV}
                                    className="bg-navy text-gold px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:scale-105 transition shadow cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>📥</span> Export CSV
                                </button>
                            </div>
                        </div>

                        {loadingResults ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">
                                Loading result records...
                            </div>
                        ) : filteredSubmissions.length === 0 ? (
                            <div className="py-12 text-center text-xs font-bold text-slate-400">
                                No student submissions processed yet for this paper.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-gray-200 text-navy font-black text-[10px] uppercase tracking-wider">
                                            <th className="p-3">Rank</th>
                                            <th className="p-3">Roll No</th>
                                            <th className="p-3">Student Name</th>
                                            <th className="p-3 text-center">Series</th>

                                            {/* Dynamic Subject Columns */}
                                            {Object.keys(filteredSubmissions[0]?.subjectScores || {}).map((subj) => (
                                                <th key={subj} className="p-3 text-center border-l border-gray-200">
                                                    <div>{subj}</div>
                                                    <div className="text-[8px] text-slate-400 font-bold font-mono">C / W / NA / Marks</div>
                                                </th>
                                            ))}

                                            <th className="p-3 text-right font-black border-l border-gray-200">Total Score</th>
                                            <th className="p-3 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                                        {filteredSubmissions.map((s) => (
                                            <tr key={s.id} className="hover:bg-amber-50/30 transition">
                                                <td className="p-3 font-black text-navy">#{s.rank}</td>
                                                <td className="p-3 font-bold text-navy">{s.rollNumber}</td>
                                                <td className="p-3 font-semibold">{s.studentName}</td>
                                                <td className="p-3 text-center">
                                                    <span className="bg-slate-100 text-navy font-black px-2 py-0.5 rounded text-[10px]">
                                                        {s.series}
                                                    </span>
                                                </td>

                                                {/* Subject Stats */}
                                                {Object.keys(filteredSubmissions[0]?.subjectScores || {}).map((subj) => {
                                                    const stat = s.subjectScores[subj] || { correct: 0, wrong: 0, notAttempted: 0, score: 0 };
                                                    return (
                                                        <td key={subj} className="p-3 text-center border-l border-gray-100 font-mono text-xs">
                                                            <span className="text-emerald-600 font-bold">{stat.correct}</span> /{' '}
                                                            <span className="text-red-500 font-bold">{stat.wrong}</span> /{' '}
                                                            <span className="text-slate-400 font-bold">{stat.notAttempted}</span> |{' '}
                                                            <span className="text-navy font-black">{stat.score}</span>
                                                        </td>
                                                    );
                                                })}

                                                <td className="p-3 text-right font-black text-sm text-navy border-l border-gray-100">
                                                    {s.scoreData?.totalScore || 0}
                                                </td>

                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleViewStudentAnalysis(s.rollNumber)}
                                                        className="bg-gold/20 text-navy hover:bg-gold px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                                                    >
                                                        Analysis →
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── TAB 4: STUDENT-WISE & CONCEPT DIAGNOSTICS ── */}
            {activeTab === 'student' && (
                <div className="space-y-8">
                    {/* Student Selector Card */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-6">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                                Diagnostic Review
                            </span>
                            <h3 className="text-xl font-black text-navy uppercase tracking-tight">
                                Student Concept &amp; Error Analysis
                            </h3>
                        </div>

                        <div className="flex items-center gap-3">
                            <label className="text-xs font-bold text-slate-500">Select Student:</label>
                            <select
                                value={selectedStudentRoll}
                                onChange={(e) => handleViewStudentAnalysis(e.target.value)}
                                className="border border-gray-200 p-2.5 rounded-xl font-bold text-navy text-xs outline-none focus:border-navy cursor-pointer"
                            >
                                {(resultsData?.submissions || []).map((s) => (
                                    <option key={s.id} value={s.rollNumber}>
                                        {s.studentName} (Roll: {s.rollNumber} • #{s.rank})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {loadingStudent ? (
                        <div className="py-16 text-center text-xs font-bold text-slate-400 animate-pulse">
                            Loading student performance &amp; concept errors...
                        </div>
                    ) : !studentAnalysis ? (
                        <div className="py-16 text-center text-xs font-bold text-slate-400">
                            Please select a student above to inspect their performance.
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Candidate Overview Card */}
                            <div className="bg-gradient-to-r from-navy to-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-wrap items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-2xl font-black text-gold">{studentAnalysis.studentName}</span>
                                        <span className="bg-gold/20 text-gold border border-gold/40 text-xs font-mono font-black px-2.5 py-0.5 rounded-lg">
                                            Roll: {studentAnalysis.rollNumber}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-semibold">
                                        Series: <span className="font-bold text-white">{studentAnalysis.series}</span> • Exam: {paperKeyData?.title}
                                    </p>
                                </div>

                                <div className="flex items-center gap-6 text-center">
                                    <div>
                                        <span className="text-[10px] font-black text-gold uppercase tracking-widest block">Total Score</span>
                                        <span className="text-3xl font-black text-white">{studentAnalysis.scoreData?.totalScore || 0}</span>
                                    </div>
                                    <div className="h-10 w-px bg-white/20"></div>
                                    <div>
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Correct</span>
                                        <span className="text-3xl font-black text-emerald-400">{studentAnalysis.scoreData?.correctCount || 0}</span>
                                    </div>
                                    <div className="h-10 w-px bg-white/20"></div>
                                    <div>
                                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">Wrong</span>
                                        <span className="text-3xl font-black text-red-400">{studentAnalysis.scoreData?.wrongCount || 0}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Concept-Wise Error Analysis Matrix */}
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                                <div>
                                    <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                        <span>🧠</span> Concept-Wise Diagnostic Breakdown
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-1">
                                        Concepts containing incorrect or skipped questions are prioritized to guide remedial coaching.
                                    </p>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-gray-200 text-navy font-black text-[10px] uppercase tracking-wider">
                                                <th className="p-3">Concept / Topic</th>
                                                <th className="p-3">Subject</th>
                                                <th className="p-3 text-center text-emerald-600">Correct</th>
                                                <th className="p-3 text-center text-red-500">Wrong</th>
                                                <th className="p-3 text-center text-slate-400">Not Attempted</th>
                                                <th className="p-3 text-center">Total Qs</th>
                                                <th className="p-3 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                                            {(studentAnalysis.conceptAnalysis || []).map((c, i) => {
                                                const hasErrors = c.wrong > 0;
                                                return (
                                                    <tr key={i} className={`hover:bg-slate-50/50 ${hasErrors ? 'bg-red-50/20' : ''}`}>
                                                        <td className="p-3 font-bold text-navy">{c.concept}</td>
                                                        <td className="p-3 text-slate-500 font-semibold">{c.subject}</td>
                                                        <td className="p-3 text-center font-black text-emerald-600">{c.correct}</td>
                                                        <td className="p-3 text-center font-black text-red-500">{c.wrong}</td>
                                                        <td className="p-3 text-center font-black text-slate-400">{c.notAttempted}</td>
                                                        <td className="p-3 text-center font-bold">{c.total}</td>
                                                        <td className="p-3 text-right font-black">
                                                            {c.wrong >= 2 ? (
                                                                <span className="bg-red-100 text-red-700 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                                                                    ⚠️ Needs Focus
                                                                </span>
                                                            ) : c.wrong === 1 ? (
                                                                <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                                                                    Review
                                                                </span>
                                                            ) : (
                                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                                                                    ✓ Strong
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Question-By-Question Detailed Log */}
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
                                <div>
                                    <h3 className="text-sm font-black text-navy uppercase tracking-wider flex items-center gap-2">
                                        <span>📝</span> Complete Question-By-Question Responses
                                    </h3>
                                    <p className="text-xs text-slate-400 font-semibold mt-1">
                                        Individual bubble detection and marks awarded per question.
                                    </p>
                                </div>

                                <div className="max-h-96 overflow-y-auto border border-gray-100 rounded-2xl">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 sticky top-0 border-b border-gray-200 text-navy font-black text-[10px] uppercase tracking-wider">
                                            <tr>
                                                <th className="p-3">Q#</th>
                                                <th className="p-3">Subject</th>
                                                <th className="p-3">Concept</th>
                                                <th className="p-3 text-center">Correct Key</th>
                                                <th className="p-3 text-center">Marked Bubble</th>
                                                <th className="p-3 text-center">Status</th>
                                                <th className="p-3 text-right">Marks</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                                            {(studentAnalysis.questionEvaluations || []).map((q) => (
                                                <tr key={q.questionNumber} className="hover:bg-slate-50/50">
                                                    <td className="p-3 font-black text-navy">{q.questionNumber}</td>
                                                    <td className="p-3 font-semibold text-slate-500">{q.subject}</td>
                                                    <td className="p-3 text-slate-600">{q.concept}</td>
                                                    <td className="p-3 text-center font-black">
                                                        <span className="inline-block w-6 h-6 leading-6 rounded bg-navy text-gold text-xs">
                                                            {q.correctAnswer}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-black">
                                                        <span className={`inline-block w-6 h-6 leading-6 rounded text-xs ${
                                                            q.status === 'correct' ? 'bg-emerald-100 text-emerald-800' :
                                                            q.status === 'wrong' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-500'
                                                        }`}>
                                                            {q.detectedAnswer === 'BLANK' ? '—' : q.detectedAnswer}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-black">
                                                        {q.status === 'correct' && <span className="text-emerald-600">✓ Correct</span>}
                                                        {q.status === 'wrong' && <span className="text-red-500">✗ Wrong</span>}
                                                        {q.status === 'not_attempted' && <span className="text-slate-400">— Blank</span>}
                                                    </td>
                                                    <td className="p-3 text-right font-black">
                                                        <span className={q.marks > 0 ? 'text-emerald-600' : q.marks < 0 ? 'text-red-500' : 'text-slate-400'}>
                                                            {q.marks > 0 ? `+${q.marks}` : q.marks}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TeacherOmr;
