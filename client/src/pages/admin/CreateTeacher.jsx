import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const CreateTeacher = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', subject: '' });
    const [teachers, setTeachers] = useState([]);
    const [loadingTeachers, setLoadingTeachers] = useState(true);
    const navigate = useNavigate();
    const subjects = ['Physics', 'Chemistry', 'Biology', 'Maths', 'Computer Science', 'Kannada', 'English', 'Hindi'];

    const fetchTeachers = async () => {
        try {
            setLoadingTeachers(true);
            const res = await api.get('/api/admin/teachers');
            setTeachers(res.data || []);
        } catch (err) {
            console.error('Failed to fetch teachers:', err);
        } finally {
            setLoadingTeachers(false);
        }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/admin/teachers', formData);
            alert('Teacher created successfully');
            setFormData({ name: '', email: '', password: '', subject: '' });
            fetchTeachers(); // Refresh the list
        } catch (err) {
            alert(err.response?.data?.msg || 'Error creating teacher');
        }
    };

    const handleRevoke = async (teacher) => {
        const teacherId = teacher._id || teacher.id;
        if (!window.confirm(`Are you sure you want to revoke access for ${teacher.name}? This cannot be undone.`)) return;
        try {
            await api.delete(`/api/admin/teachers/${teacherId}`);
            alert(`${teacher.name}'s access has been revoked.`);
            fetchTeachers(); // Refresh the list
        } catch (err) {
            alert(err.response?.data?.msg || 'Error revoking teacher access');
        }
    };

    return (
        <div className="animate-fade-in-up max-w-4xl mx-auto space-y-10 px-4 py-8">
            {/* Header */}
            <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-8 border-navy flex justify-between items-center">
                <div>
                    <h3 className="font-black text-2xl text-navy mb-2 uppercase tracking-tight">Faculty Onboarding</h3>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Academic Staff Credential Management</p>
                </div>
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm">← Back</button>
            </div>

            {/* Create Teacher Form */}
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-100">
                <h3 className="text-sm font-black mb-10 text-navy uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">+</span>
                    New Faculty Credentials
                </h3>
                <form onSubmit={handleCreateSubmit} className="grid grid-cols-2 gap-8">
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Full Identity</label>
                        <input type="text" placeholder="e.g. Prof. Arvind Kumar" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Official Email</label>
                        <input type="email" placeholder="faculty@sapthagiripucollege.edu.in" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Initial Password</label>
                        <input type="password" placeholder="••••••••" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Academic Department</label>
                        <select required value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm cursor-pointer">
                            <option value="">-- Select Subject --</option>
                            {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2 mt-6">
                        <button type="submit" className="w-full bg-gold text-navy py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:shadow-2xl hover:scale-[1.02] transition-all shadow-xl active:scale-95">
                            Authorize &amp; Create Access
                        </button>
                    </div>
                </form>
            </div>

            {/* Existing Faculty List */}
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-gray-100">
                <h3 className="text-sm font-black mb-8 text-navy uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="bg-red-100 text-red-600 w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg">👥</span>
                    Registered Faculty — Revoke Access
                </h3>

                {loadingTeachers ? (
                    <p className="text-center text-gray-400 font-bold text-sm py-8">Loading faculty list...</p>
                ) : teachers.length === 0 ? (
                    <p className="text-center text-gray-400 font-bold text-sm py-8">No faculty registered yet.</p>
                ) : (
                    <div className="space-y-3">
                        {teachers.map(teacher => (
                            <div key={teacher._id || teacher.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 px-6 py-4 rounded-2xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-navy text-gold flex items-center justify-center font-black text-sm">
                                        {(teacher.name || 'T').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-black text-navy text-sm">{teacher.name}</p>
                                        <p className="text-xs text-slate/50 font-bold">{teacher.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black uppercase tracking-widest bg-gold/20 text-navy px-3 py-1 rounded-xl">
                                        {teacher.subject || 'N/A'}
                                    </span>
                                    <button
                                        onClick={() => handleRevoke(teacher)}
                                        className="bg-red-500/10 border border-red-400/30 text-red-500 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
                                    >
                                        Revoke
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreateTeacher;
