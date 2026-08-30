import React, { useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const user = await login(email, password);
            if (user.role === 'admin') {
                navigate('/admin/dashboard');
            } else {
                setError('Not authorized as admin');
            }
        } catch (err) {
            setError(err.msg || 'Login failed');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                <h2 className="text-2xl font-bold mb-6 text-center text-blue-600">Admin Login</h2>
                {error && <div className="bg-red-100 text-red-600 p-2 mb-4 rounded">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
                        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2">Password</label>
                        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:border-blue-500" />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition">
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
