import React, { useEffect, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { setLoadingCallback } from './api';
import UnifiedLogin from './pages/auth/UnifiedLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import CreatePaper from './pages/teacher/CreatePaper';
import ExamInstructions from './pages/exam/ExamInstructions';
import ExamEngine from './pages/exam/ExamEngine';
import Scorecard from './pages/exam/Scorecard';
import Disqualified from './pages/exam/Disqualified';
import LabLogin from './pages/lab/LabLogin';
import LabExamList from './pages/lab/LabExamList';
import BridgeApp from './pages/admin/BridgeApp';

// ── App Loader Linker ────────────────────────────────────────────────────────
const ApiLoaderLinker = ({ children }) => {
    const { showLoader, hideLoader } = useLoading();

    useEffect(() => {
        setLoadingCallback((isLoading) => {
            if (isLoading) showLoader();
            else hideLoader();
        });
        return () => setLoadingCallback(() => {});
    }, [showLoader, hideLoader]);

    return children;
};

const AppLoadingSpinner = () => (
    <div className="min-h-screen bg-[#071328] flex flex-col items-center justify-center p-6 font-sans animate-fade-in relative overflow-hidden">
        {/* Background decorative glow */}
        <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-20 h-20 rounded-3xl bg-white shadow-2xl flex items-center justify-center p-2 mb-5 border-2 border-amber-400/40 relative z-10">
            <img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-2xl" />
        </div>
        <div className="w-9 h-9 border-4 border-slate-700 border-t-amber-400 rounded-full animate-spin mb-4"></div>
        <h3 className="text-base font-black text-white uppercase tracking-widest text-center">Sapthagiri PU College</h3>
        <p className="text-[11px] text-amber-400/90 font-bold uppercase tracking-wider mt-1">Davanagere • The Land of Opportunity</p>
        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">Loading Portal...</p>
    </div>
);

const ProtectedRoute = ({ children, role }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) return <AppLoadingSpinner />;
    if (!user) return <Navigate to="/" />;
    if (role && user.role !== role) return <Navigate to="/" />;
    return children;
};

function App() {
  return (
    <LoadingProvider>
        <AuthProvider>
            <ApiLoaderLinker>
                <Router>
                    <Routes>
                        {/* Unified Public Login */}
                        <Route path="/" element={<UnifiedLogin />} />

                        {/* Admin Routes */}
                        <Route path="/admin/dashboard/*" element={
                            <ProtectedRoute role="admin">
                                <AdminDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/bridge" element={
                            <ProtectedRoute role="admin">
                                <BridgeApp />
                            </ProtectedRoute>
                        } />

                        {/* Teacher Routes */}
                        <Route path="/teacher/dashboard/*" element={
                            <ProtectedRoute role="teacher">
                                <TeacherDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/teacher/create-paper" element={
                            <ProtectedRoute role="teacher">
                                <CreatePaper />
                            </ProtectedRoute>
                        } />
                        <Route path="/teacher/omr" element={<Navigate to="/teacher/dashboard/omr" replace />} />

                        {/* Student CBT Examination Routes */}
                        <Route path="/exam/:examId/instructions" element={<ExamInstructions />} />
                        <Route path="/exam/:examId/scorecard/:sessionId" element={<Scorecard />} />
                        <Route path="/exam/:examId" element={<ExamEngine />} />
                        <Route path="/exam/disqualified" element={<Disqualified />} />

                        {/* Student Lab Engine Routes */}
                        <Route path="/lab" element={<LabLogin />} />
                        <Route path="/lab-login" element={<Navigate to="/lab" replace />} />
                        <Route path="/lab/exams" element={<LabExamList />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </Router>
            </ApiLoaderLinker>
        </AuthProvider>
    </LoadingProvider>
  );
}

export default App;
