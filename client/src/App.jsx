import { useEffect, useContext, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { LoadingProvider, useLoading } from './context/LoadingContext';
import { setLoadingCallback } from './api';
import MaintenanceGate from './maintenance/MaintenanceGate';

// Each page is its own chunk: the app used to ship as one ~2 MB script that every lab terminal had to download
// before the first screen could appear.
const UnifiedLogin = lazy(() => import('./pages/auth/UnifiedLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const CommissionedExam = lazy(() => import('./pages/teacher/CommissionedExam'));
const ExamInstructions = lazy(() => import('./pages/exam/ExamInstructions'));
const ExamEngine = lazy(() => import('./pages/exam/ExamEngine'));
const Scorecard = lazy(() => import('./pages/exam/Scorecard'));
const Disqualified = lazy(() => import('./pages/exam/Disqualified'));
const LabLogin = lazy(() => import('./pages/lab/LabLogin'));
const LabExamList = lazy(() => import('./pages/lab/LabExamList'));
const StudentLabPortal = lazy(() => import('./pages/exam/StudentLabPortal'));
const BridgeApp = lazy(() => import('./pages/admin/BridgeApp'));

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
        <div className="absolute w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-20 h-20 rounded-3xl bg-white shadow-2xl flex items-center justify-center p-2 mb-5 border-2 border-indigo-400/40 relative z-10">
            <img src="/SapthagiriLogo.jpg" alt="Sapthagiri PU College" className="w-full h-full object-contain rounded-2xl" />
        </div>
        <div className="w-9 h-9 border-4 border-slate-700 border-t-indigo-400 rounded-full animate-spin mb-4"></div>
        <h3 className="text-base font-black text-white uppercase tracking-widest text-center">Sapthagiri PU College</h3>
        <p className="text-[11px] text-indigo-400/90 font-bold uppercase tracking-wider mt-1">Davanagere • The Land of Opportunity</p>
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
                <MaintenanceGate>
                <Router>
                    <Suspense fallback={<AppLoadingSpinner />}>
                    <Routes>
                        {/* Unified Public Login */}
                        <Route path="/" element={<UnifiedLogin />} />

                        {/* Admin Routes */}
                        <Route path="/admin/dashboard/*" element={
                            <ProtectedRoute role="admin">
                                <AdminDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/create-paper" element={
                            <ProtectedRoute role="admin">
                                <CommissionedExam />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/commissioned-exam" element={
                            <ProtectedRoute role="admin">
                                <CommissionedExam />
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
                                <CommissionedExam />
                            </ProtectedRoute>
                        } />
                        <Route path="/teacher/commissioned-exam" element={
                            <ProtectedRoute role="teacher">
                                <CommissionedExam />
                            </ProtectedRoute>
                        } />
                        <Route path="/teacher/omr" element={<Navigate to="/teacher/dashboard/omr" replace />} />

                        {/* Student CBT Examination Routes */}
                        <Route path="/exam/:examId/instructions" element={<ExamInstructions />} />
                        <Route path="/exam/:examId/scorecard/:sessionId" element={<Scorecard />} />
                        <Route path="/exam/:examId" element={<ExamEngine />} />
                        <Route path="/exam/disqualified" element={<Disqualified />} />

                        {/* Dedicated Student Lab Examination Portal */}
                        <Route path="/lab-exam" element={<StudentLabPortal />} />
                        <Route path="/student-exam" element={<Navigate to="/lab-exam" replace />} />
                        <Route path="/student/exam" element={<Navigate to="/lab-exam" replace />} />

                        {/* Student Lab Engine Routes */}
                        <Route path="/lab" element={<StudentLabPortal />} />
                        <Route path="/lab-login" element={<LabLogin />} />
                        <Route path="/lab/exams" element={<LabExamList />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                    </Suspense>
                </Router>
                </MaintenanceGate>
            </ApiLoaderLinker>
        </AuthProvider>
    </LoadingProvider>
  );
}

export default App;
