import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';

const UnifiedLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const { login, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // If already logged in, redirect them
    if (user) {
        if (user.role === 'admin') return <Navigate to="/admin/dashboard" />;
        if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" />;
    }

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            const loggedInUser = await login(formData.email, formData.password);
            if (loggedInUser.role === 'admin') {
                navigate('/admin/dashboard');
            } else if (loggedInUser.role === 'teacher') {
                navigate('/teacher/dashboard');
            }
        } catch (err) {
            setError(err.msg || 'Invalid email or password. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 font-sans overflow-hidden bg-[#06101E]">
            {/* Campus Background Image with Deep Gradient Overlay */}
            <div 
                className="absolute inset-0 bg-cover bg-center filter blur-[3px] scale-105 opacity-35 transition-all duration-1000"
                style={{ backgroundImage: "url('/SapthagiriCampus.webp')" }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-[#06101E]/95 via-[#091B38]/85 to-[#06101E]/90"></div>

            {/* Glowing Accent Orbs */}
            <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-2xl border-t-4 border-amber-500 shadow-blue-950/50">
                {/* College Crest & Header */}
                <div className="text-center mb-8">
                    <div className="relative inline-block mb-4">
                        <div className="w-24 h-24 rounded-full overflow-hidden mx-auto shadow-xl ring-4 ring-amber-400/80 bg-white p-1 transform hover:scale-105 transition-transform duration-300">
                            <img 
                                src="/SapthagiriLogo.jpg" 
                                alt="Sapthagiri PU College" 
                                className="w-full h-full object-contain rounded-full" 
                            />
                        </div>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-[#081B3B] tracking-tight uppercase leading-tight">
                        Sapthagiri PU College
                    </h1>
                    <div className="flex items-center justify-center gap-2 mt-1.5">
                        <span className="h-px w-6 bg-amber-400"></span>
                        <p className="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest">
                            Davanagere • The Land of Opportunity
                        </p>
                        <span className="h-px w-6 bg-amber-400"></span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-1">
                        Question Paper Generator Suite
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3.5 rounded-2xl mb-6 text-xs font-bold border border-red-200 text-center flex items-center justify-center gap-2 animate-shake">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-5">
                    <div>
                        <label className="block text-[11px] font-black text-[#081B3B] uppercase tracking-wider mb-2 ml-1">
                            College ID / Email Address
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">✉</span>
                            <input 
                                type="email" 
                                required 
                                placeholder="Enter College ID / Email"
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})} 
                                className="w-full border-2 border-slate-200 p-3.5 pl-11 rounded-2xl bg-slate-50/70 focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-sm font-medium text-slate-800" 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-black text-[#081B3B] uppercase tracking-wider mb-2 ml-1">
                            Secret Password
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">🔒</span>
                            <input 
                                type="password" 
                                required 
                                placeholder="••••••••"
                                value={formData.password} 
                                onChange={e => setFormData({...formData, password: e.target.value})} 
                                className="w-full border-2 border-slate-200 p-3.5 pl-11 rounded-2xl bg-slate-50/70 focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-sm font-medium text-slate-800" 
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-[#081B3B] hover:bg-[#0B2552] text-amber-400 font-black p-4 rounded-2xl text-sm uppercase tracking-widest shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 border border-amber-400/30"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>Authenticating...</span>
                            </>
                        ) : (
                            <span>Access Faculty Portal →</span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UnifiedLogin;
