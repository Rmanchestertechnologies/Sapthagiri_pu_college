import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, showDetails: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[CRITICAL ERROR CAUGHT BY BOUNDARY]', error, errorInfo);
    }

    handleGoHome = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/teacher/dashboard';
    };

    handleReset = () => {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            sessionStorage.clear();
        } catch {}
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6 font-sans">
                    <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl w-full max-w-lg border-b-8 border-gold text-center">
                        <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-inner">
                            <span>⚠️</span>
                        </div>
                        <h2 className="text-2xl font-black text-[#081B3B] mb-2 uppercase tracking-tight">Sapthagiri PU College</h2>
                        <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed">
                            A display or state sync error occurred in this view. You can return to your dashboard or refresh the page.
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center mb-4">
                            <button 
                                onClick={this.handleGoHome} 
                                className="bg-navy text-gold px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition shadow-lg cursor-pointer"
                            >
                                🏠 Back to Dashboard
                            </button>
                            <button 
                                onClick={() => window.location.reload()} 
                                className="bg-gray-100 text-slate-700 px-6 py-3 rounded-2xl font-bold text-xs hover:bg-gray-200 transition border border-gray-200 cursor-pointer"
                            >
                                🔄 Refresh Page
                            </button>
                        </div>

                        {/* Error info toggle */}
                        {this.state.error && (
                            <div className="text-left mt-4 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => this.setState(s => ({ showDetails: !s.showDetails }))}
                                    className="text-[11px] font-bold text-gray-400 hover:text-navy underline cursor-pointer"
                                >
                                    {this.state.showDetails ? 'Hide details' : 'Show error details'}
                                </button>
                                {this.state.showDetails && (
                                    <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-[10px] text-red-600 font-mono overflow-x-auto whitespace-pre-wrap">
                                        {this.state.error.toString()}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
