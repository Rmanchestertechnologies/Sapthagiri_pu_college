import React, { useState, useEffect } from 'react';
import api from '../../api';

const TemplateCart = ({ onClose }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await api.get('/api/templates');
                setTemplates(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-navy/40 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right border-l-4 border-gold">
                {/* Drawer Header */}
                <div className="bg-navy p-6 flex items-center justify-between border-b-4 border-gold">
                    <div>
                        <h2 className="font-black text-white text-lg uppercase tracking-widest">Templates</h2>
                        <p className="text-gold/60 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            {templates.length} available
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="bg-white/10 text-gold w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg hover:bg-white/20 transition"
                    >
                        ✕
                    </button>
                </div>

                {/* Templates List */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-4">
                            <div className="w-10 h-10 border-4 border-navy/20 border-t-navy rounded-full animate-spin" />
                            <p className="text-slate/40 font-bold text-xs uppercase tracking-widest">Loading templates...</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-4">
                            <div className="text-5xl">🖼️</div>
                            <p className="text-slate/30 font-bold text-xs uppercase tracking-widest text-center">
                                No templates uploaded yet.<br />Ask your admin to add templates.
                            </p>
                        </div>
                    ) : (
                        templates.map(t => (
                            <div
                                key={t._id}
                                onClick={() => setSelected(t)}
                                className="group bg-gray-50 rounded-3xl border border-gray-100 overflow-hidden cursor-pointer hover:border-navy/30 hover:shadow-lg transition-all"
                            >
                                <div className="h-28 bg-white flex items-center justify-center overflow-hidden border-b border-gray-100">
                                    <img
                                        src={t.fileUrl}
                                        alt={t.title || t.originalName}
                                        className="max-h-full max-w-full object-contain p-3"
                                        onError={e => { e.target.src = ''; e.target.parentNode.innerHTML = '<div style="font-size:2rem">🖼️</div>'; }}
                                    />
                                </div>
                                <div className="p-4">
                                    <h4 className="font-black text-sm text-navy truncate">{t.title || t.originalName}</h4>
                                    {t.description && (
                                        <p className="text-[10px] text-slate/50 mt-1 font-medium leading-relaxed">{t.description}</p>
                                    )}
                                    <p className="text-[9px] font-bold text-slate/30 uppercase tracking-widest mt-2">
                                        {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                    <a
                                        href={t.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="mt-3 flex items-center justify-center gap-2 w-full bg-navy text-gold text-[10px] font-black py-2.5 rounded-xl uppercase tracking-widest hover:bg-navy/80 transition"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download / View
                                    </a>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div className="p-5 border-t border-gray-100 bg-gray-50">
                    <p className="text-[10px] font-bold text-slate/40 uppercase tracking-widest text-center">
                        Templates are uploaded by your administrator
                    </p>
                </div>
            </div>

            {/* Full Preview Modal */}
            {selected && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-6"
                    onClick={() => setSelected(null)}
                >
                    <div
                        className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-navy p-6 flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-white text-base uppercase tracking-widest">{selected.title || selected.originalName}</h3>
                                {selected.description && <p className="text-gold/60 text-[10px] mt-1">{selected.description}</p>}
                            </div>
                            <button onClick={() => setSelected(null)} className="text-gold font-black text-xl">✕</button>
                        </div>
                        <div className="p-6 bg-gray-50 flex items-center justify-center">
                            <img
                                src={selected.fileUrl}
                                alt={selected.title || selected.originalName}
                                className="max-h-72 object-contain rounded-2xl shadow-md"
                            />
                        </div>
                        <div className="p-6 flex gap-4">
                            <button onClick={() => setSelected(null)} className="flex-1 border border-gray-200 text-slate py-3 rounded-xl text-xs font-black uppercase tracking-widest">Close</button>
                            <a
                                href={selected.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 bg-navy text-gold py-3 rounded-xl text-xs font-black uppercase tracking-widest text-center hover:bg-navy/80 transition"
                            >
                                Download
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TemplateCart;
