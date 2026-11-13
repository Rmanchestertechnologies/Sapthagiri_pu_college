import { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertTriangle, Sparkles, FileText, ScanLine, ShieldCheck } from 'lucide-react';
import { SPRING } from '../../ui/motion';

const UnifiedLogin = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const { login, user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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
            setError(err.msg || err.message || 'Invalid email or password. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const features = [
        { Icon: Sparkles, title: 'Papers that build themselves', text: 'Pick chapters and a question mix; the balanced paper assembles in seconds.' },
        { Icon: FileText, title: 'Print-ready A4 and answer keys', text: 'Clean typography, solution keys and Word export from one place.' },
        { Icon: ScanLine, title: 'OMR and online exams', text: 'Scan sheets or run the exam on the lab computers.' },
    ];
    const field = 'w-full rounded-2xl border border-slate-200 bg-white/80 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-amber-500';

    return (
        <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-[#050e1f] font-sans">
            {/* brand side */}
            <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white">
                <div className="absolute inset-0 bg-cover bg-center opacity-40 scale-105" style={{ backgroundImage: "url('/SapthagiriCampus.webp')" }} aria-hidden="true" />
                <div className="absolute inset-0 bg-gradient-to-br from-[#050e1f]/95 via-[#081b3b]/85 to-[#0d2a5e]/70" aria-hidden="true" />
                <div className="absolute -bottom-24 -left-16 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl" aria-hidden="true" />
                <div className="relative flex items-center gap-3">
                    <span className="w-12 h-12 rounded-2xl bg-white p-1 shadow-xl"><img src="/SapthagiriLogo.jpg" alt="" className="w-full h-full object-contain rounded-xl" /></span>
                    <span className="font-black tracking-tight text-lg">Sapthagiri PU College</span>
                </div>
                <div className="relative max-w-lg">
                    <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING.soft} className="eyebrow">Davanagere · The land of opportunity</motion.p>
                    <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING.soft, delay: 0.05 }} className="mt-3 text-4xl xl:text-5xl font-extrabold leading-[1.08]">
                        Question papers,<br />made effortless.
                    </motion.h1>
                    <ul className="mt-10 space-y-5">
                        {features.map(({ Icon, title, text }, i) => (
                            <motion.li key={title} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING.soft, delay: 0.15 + i * 0.08 }} className="flex gap-4">
                                <span className="w-10 h-10 shrink-0 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-amber-400"><Icon size={19} /></span>
                                <span><span className="block font-bold">{title}</span><span className="block text-sm text-white/60 leading-relaxed">{text}</span></span>
                            </motion.li>
                        ))}
                    </ul>
                </div>
                <p className="relative text-xs text-white/40 font-semibold">© Sapthagiri PU College, Davanagere</p>
            </aside>

            {/* form side */}
            <main className="relative flex items-center justify-center p-5 sm:p-10 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-amber-300/25 blur-3xl pointer-events-none" aria-hidden="true" />
                <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={SPRING.island} className="relative w-full max-w-md">
                    <div className="lg:hidden text-center mb-8">
                        <span className="inline-block w-16 h-16 rounded-2xl bg-white p-1 shadow-xl ring-2 ring-amber-400/70"><img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-xl" /></span>
                        <h1 className="mt-4 text-2xl font-black text-[#081b3b]">Sapthagiri PU College</h1>
                    </div>

                    <div className="rounded-[28px] bg-white/90 backdrop-blur-xl p-8 sm:p-10 shadow-[0_30px_70px_-25px_rgba(8,27,59,0.35)] border border-white">
                        <h2 className="text-2xl font-extrabold text-[#081b3b]">Welcome back</h2>
                        <p className="mt-1 text-sm text-slate-500 font-medium">Sign in to the question paper portal.</p>

                        {error && (
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert"
                                className="mt-6 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700">
                                <AlertTriangle size={15} className="mt-px shrink-0" /><span>{error}</span>
                            </motion.div>
                        )}

                        <form onSubmit={onSubmit} className="mt-7 space-y-5">
                            <label className="block">
                                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#081b3b] mb-2">College ID / email</span>
                                <span className="relative block">
                                    <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="email" required autoComplete="username" placeholder="name@example.com" value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })} className={field} />
                                </span>
                            </label>
                            <label className="block">
                                <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#081b3b] mb-2">Password</span>
                                <span className="relative block">
                                    <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })} className={`${field} pr-12`} />
                                    <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </span>
                            </label>

                            <motion.button type="submit" disabled={isSubmitting} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} transition={SPRING.press}
                                className="group w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#081b3b] to-[#0d2a5e] py-4 text-sm font-extrabold uppercase tracking-widest text-amber-400 shadow-xl shadow-blue-950/25 disabled:opacity-70">
                                {isSubmitting ? (
                                    <><span className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" /><span>Signing in…</span></>
                                ) : (
                                    <><span>Sign in</span><ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </motion.button>
                        </form>

                        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400"><ShieldCheck size={13} /> Secure sign-in for faculty and administrators</p>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

export default UnifiedLogin;
