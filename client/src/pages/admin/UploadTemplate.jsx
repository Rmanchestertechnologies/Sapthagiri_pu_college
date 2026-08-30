import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const UploadTemplate = () => {
    const [templateFile, setTemplateFile] = useState(null);
    const [templateTitle, setTemplateTitle] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [address, setAddress] = useState('');
    const [headerText, setHeaderText] = useState('');
    const [instructions, setInstructions] = useState('');
    const [footerText, setFooterText] = useState('');
    const [watermarkText, setWatermarkText] = useState('');
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [templateType, setTemplateType] = useState('FULL_PAPER');
    const [viewingTemplate, setViewingTemplate] = useState(null);
    const navigate = useNavigate();

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await api.get('/api/templates');
            setTemplates(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleTemplateUpload = async (e) => {
        e.preventDefault();
        const data = new FormData();
        if (templateFile) {
            data.append('template', templateFile);
        }
        data.append('title', templateTitle || (templateFile ? templateFile.name : 'Custom Template'));
        data.append('description', templateDesc);
        data.append('templateType', templateType);
        data.append('institutionName', institutionName);
        data.append('address', address);
        data.append('headerText', headerText);
        data.append('instructions', instructions);
        data.append('footerText', footerText);
        data.append('watermarkText', watermarkText);

        try {
            setUploading(true);
            await api.post('/api/templates', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('Template created successfully!');
            setTemplateFile(null);
            setTemplateTitle('');
            setTemplateDesc('');
            setTemplateType('FULL_PAPER');
            setInstitutionName('');
            setAddress('');
            setHeaderText('');
            setInstructions('');
            setFooterText('');
            setWatermarkText('');
            setPreviewUrl(null);
            fetchTemplates();
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.msg || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await api.delete(`/api/templates/${id}`);
            fetchTemplates();
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <div className="animate-fade-in-up max-w-5xl mx-auto space-y-10 px-4 py-8 font-sans">
            {/* Header */}
            <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-8 border-navy flex justify-between items-center">
                <div>
                    <h3 className="font-black text-2xl text-navy mb-2 uppercase tracking-tight">Template Management</h3>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Upload & Manage Institutional Templates</p>
                </div>
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm">← Back</button>
            </div>

            {/* Upload Form */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-sm font-black mb-6 text-navy uppercase tracking-[0.2em] flex items-center gap-3">
                    <span className="bg-gold text-navy w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shadow">↑</span>
                    Upload Visual Template (PDF / PNG / JPG)
                </h3>
                <form onSubmit={handleTemplateUpload} className="flex flex-col gap-5">
                    <div>
                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Template Name *</label>
                        <input
                            type="text" required
                            placeholder="e.g. Sapthagiri PU College Standard Layout 2026"
                            className="w-full border-2 border-gray-200 p-3.5 rounded-2xl bg-gray-50/50 font-bold text-sm focus:border-navy outline-none transition-all"
                            value={templateTitle}
                            onChange={e => setTemplateTitle(e.target.value)}
                        />
                    </div>

                    <div className="w-full">
                        <label className="block text-xs font-black text-navy uppercase tracking-wider mb-2">Select Template File (Supported: PDF, PNG, JPG/JPEG) *</label>
                        <input
                            type="file" required accept="image/*,application/pdf"
                            onChange={(e) => {
                                if (e.target.files[0]) {
                                    setTemplateFile(e.target.files[0]);
                                    setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                                }
                            }}
                            className="w-full border-2 border-dashed border-gray-300 p-6 rounded-2xl bg-gray-50/50 hover:bg-white focus:border-navy outline-none transition-all font-bold text-navy cursor-pointer file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-navy file:text-gold hover:file:scale-105"
                        />
                    </div>

                    {previewUrl && (
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center">
                            <p className="text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Uploaded Template Preview</p>
                            {templateFile?.type === 'application/pdf' ? (
                                <div className="flex flex-col items-center py-4">
                                    <span className="text-4xl mb-1">📄</span>
                                    <span className="text-xs text-navy font-bold">{templateFile.name} (PDF Document)</span>
                                </div>
                            ) : (
                                <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto object-contain rounded-xl shadow-sm" />
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={uploading}
                        className="w-full bg-navy text-gold py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.01] transition-all shadow-lg active:scale-95 disabled:opacity-50 mt-2"
                    >
                        {uploading ? 'Uploading & Processing...' : '🚀 Save & Activate Template'}
                    </button>
                </form>
            </div>

            {/* Uploaded Templates Gallery */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100">
                <h3 className="text-sm font-black mb-8 text-navy uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="bg-navy text-gold w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg">🖼</span>
                    Uploaded Templates ({templates.length})
                </h3>

                {loading ? (
                    <div className="text-center py-10 text-slate/40 font-bold text-sm">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-16 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="text-4xl mb-4">🖼️</div>
                        <p className="text-slate/30 font-bold text-xs uppercase tracking-widest">No templates uploaded yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {templates.map(t => {
                            const isPdf = t.fileUrl?.toLowerCase().endsWith('.pdf') || t.originalName?.toLowerCase().endsWith('.pdf') || t.filename?.toLowerCase().endsWith('.pdf');
                            return (
                                <div key={t._id} className="group relative bg-gray-50 rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-navy/20 transition-all">
                                    <div className="h-36 bg-white flex flex-col items-center justify-center overflow-hidden border-b border-gray-100">
                                        {isPdf ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-5xl mb-1">📄</span>
                                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">PDF Document</span>
                                            </div>
                                        ) : (
                                            <img
                                                src={t.fileUrl}
                                                alt={t.title || t.originalName}
                                                className="max-h-full max-w-full object-contain p-3"
                                                onError={e => { e.target.src = ''; e.target.parentNode.innerHTML = '<div class="text-4xl">🖼️</div>'; }}
                                            />
                                        )}
                                    </div>
                                    <div className="p-5">
                                        <div className="flex justify-between items-center gap-2">
                                            <h4 className="font-black text-sm text-navy truncate flex-1">{t.title || t.originalName}</h4>
                                            <span className="bg-navy text-gold text-[7px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">{t.templateType || 'FULL_PAPER'}</span>
                                        </div>
                                        {t.description && <p className="text-[10px] text-slate/50 mt-1 font-medium leading-relaxed">{t.description}</p>}
                                        <p className="text-[9px] font-bold text-slate/30 uppercase tracking-widest mt-2">
                                            {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="absolute top-3 right-3 hidden group-hover:flex gap-2">
                                        <button
                                            onClick={() => setViewingTemplate(t)}
                                            className="bg-navy text-gold text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-navy/80 transition"
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleDelete(t._id)}
                                            className="bg-red-500 text-white text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider hover:bg-red-600 transition">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {viewingTemplate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                    <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-2xl p-10 border-b-8 border-gold animate-fade-in-up flex flex-col max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-navy mb-1 tracking-tight">{viewingTemplate.title}</h2>
                                <span className="bg-navy text-gold text-[8px] font-black px-2 py-0.5 rounded tracking-wider uppercase">{viewingTemplate.templateType || 'FULL_PAPER'}</span>
                            </div>
                            <button onClick={() => setViewingTemplate(null)} className="text-slate/30 hover:text-red-500 bg-gray-50 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold border border-gray-100 transition">×</button>
                        </div>
                        
                        <div className="space-y-6 text-sm text-slate font-medium">
                            {viewingTemplate.fileUrl && (
                                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50 text-center">
                                    <p className="text-[10px] font-black text-navy/40 uppercase tracking-widest mb-2">Uploaded Asset</p>
                                    {(viewingTemplate.fileUrl.endsWith('.pdf') || viewingTemplate.originalName?.endsWith('.pdf') || viewingTemplate.filename?.endsWith('.pdf')) ? (
                                        <div className="flex flex-col items-center py-6">
                                            <span className="text-5xl mb-2">📄</span>
                                            <span className="text-xs text-navy font-bold">{viewingTemplate.originalName || 'Document.pdf'}</span>
                                            <a href={viewingTemplate.fileUrl} target="_blank" rel="noreferrer" className="mt-4 text-xs bg-navy text-gold px-4 py-2 rounded-xl font-bold uppercase tracking-wider">Open PDF Document</a>
                                        </div>
                                    ) : (
                                        <img src={viewingTemplate.fileUrl} alt="Template Asset" className="max-h-64 mx-auto object-contain rounded-xl" />
                                    )}
                                </div>
                            )}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[9px] font-black text-navy/40 uppercase tracking-widest">Institution Name</span>
                                    <span className="text-navy font-bold">{viewingTemplate.institutionName || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black text-navy/40 uppercase tracking-widest">Institution Address</span>
                                    <span className="text-[#1e3280]">{viewingTemplate.address || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black text-navy/40 uppercase tracking-widest">Exam Header</span>
                                    <span className="text-navy">{viewingTemplate.headerText || '-'}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black text-navy/40 uppercase tracking-widest">Watermark Text</span>
                                    <span className="text-navy">{viewingTemplate.watermarkText || '-'}</span>
                                </div>
                            </div>
                            
                            {viewingTemplate.instructions && (
                                <div>
                                    <span className="block text-[9px] font-black text-navy/40 uppercase tracking-widest mb-2">Instructions</span>
                                    <pre className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-xs font-sans whitespace-pre-wrap text-slate/80">{viewingTemplate.instructions}</pre>
                                </div>
                            )}
                            
                            {viewingTemplate.footerText && (
                                <div>
                                    <span className="block text-[9px] font-black text-navy/40 uppercase tracking-widest">Footer Text</span>
                                    <span className="text-navy">{viewingTemplate.footerText}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadTemplate;
