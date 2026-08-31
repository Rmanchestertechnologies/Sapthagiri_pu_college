import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

const CreateTeacher = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '', subject: '' });
    const navigate = useNavigate();
    const subjects = ['Physics', 'Chemistry', 'Biology', 'Maths', 'Computer Science', 'Kannada', 'English', 'Hindi'];

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/api/admin/teachers', formData);
            alert('Teacher created successfully');
            setFormData({ name: '', email: '', password: '', subject: '' });
            navigate('/admin/dashboard');
        } catch (err) {
            alert(err.response?.data?.msg || 'Error creating teacher');
        }
    };

    return (
        <div className="animate-fade-in-up max-w-4xl mx-auto space-y-10 px-4 py-8">
            <div className="bg-surface p-10 rounded-[2.5rem] shadow-sm border border-gray-100 border-l-8 border-navy flex justify-between items-center">
                <div>
                    <h3 className="font-black text-2xl text-navy mb-2 uppercase tracking-tight">Faculty Onboarding</h3>
                    <p className="text-[10px] font-black text-slate/40 uppercase tracking-[0.2em] ml-1">Academic Staff Credential Management</p>
                </div>
                <button onClick={() => navigate('/admin/dashboard')} className="bg-white border-2 border-gray-100 text-slate/40 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-navy hover:text-navy transition shadow-sm">← Back</button>
            </div>

            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-100">
                <h3 className="text-sm font-black mb-10 text-navy uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="bg-gold text-navy w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg rotate-3">+</span>
                    New Faculty Credentials
                </h3>
                <form onSubmit={handleCreateSubmit} className="grid grid-cols-2 gap-8">
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Full Identity</label>
                        <input type="text" placeholder="e.g. Prof. Arvind Kumar" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Official Email</label>
                        <input type="email" placeholder="faculty@sapthagiripucollege.edu.in" required value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Initial Password</label>
                        <input type="password" placeholder="••••••••" required value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm" />
                    </div>
                    <div className="col-span-2 md:col-span-1">
                        <label className="block text-[10px] font-black text-navy/40 uppercase tracking-widest mb-3 ml-1">Academic Department</label>
                        <select required value={formData.subject} onChange={e=>setFormData({...formData, subject: e.target.value})} className="w-full border-2 border-gray-100 p-4 rounded-2xl focus:border-navy bg-white font-bold text-navy outline-none transition-all shadow-sm cursor-pointer">
                            <option value="">-- Select Subject --</option>
                            {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                        </select>
                    </div>
                    <div className="col-span-2 mt-6">
                        <button type="submit" className="w-full bg-gold text-navy py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:shadow-2xl hover:scale-[1.02] transition-all shadow-xl active:scale-95">
                            Authorize & Create Access
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTeacher;
