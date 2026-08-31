import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Disqualified() {
    const [searchParams] = useSearchParams();
    const reason = searchParams.get('reason') || 'Window focus lost or tab switched';
    const student = JSON.parse(localStorage.getItem('student_info') || '{}');

    useEffect(() => {
        // Enforce lockout: clean up any exam state except the malpractice lock
        localStorage.removeItem('active_exam_session_id');
        // Prevent student from leaving this page by hitting back button
        window.history.pushState(null, null, window.location.href);
        const preventBack = () => {
            window.history.pushState(null, null, window.location.href);
        };
        window.addEventListener('popstate', preventBack);
        
        // Try exiting fullscreen if it is still active
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        return () => {
            window.removeEventListener('popstate', preventBack);
        };
    }, []);

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.icon}>⚠️</div>
                <h1 style={styles.title}>SESSION LOCKED</h1>
                <h2 style={styles.subtitle}>Malpractice or Overlay Detected</h2>
                
                <div style={styles.details}>
                    <p style={styles.text}>
                        This exam is strictly monitored. The system detected that you attempted to switch tabs, minimize the browser window, or open unauthorized applications.
                    </p>
                    <div style={styles.reasonBox}>
                        <strong>Detection Trigger:</strong> {reason}
                    </div>
                </div>

                <div style={styles.studentInfo}>
                    <div><strong>Candidate:</strong> {student.studentName || 'Unknown Student'}</div>
                    <div><strong>Roll Number:</strong> {student.rollNumber || 'N/A'}</div>
                    {student.studentEmail && <div><strong>Email:</strong> {student.studentEmail}</div>}
                </div>

                <div style={styles.notice}>
                    Your examination session has been immediately terminated and submitted with a score of 0. The college administration and exam controller have been notified with your IP and system logs.
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        background: '#090d16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        padding: '24px'
    },
    card: {
        background: '#111827',
        border: '2px solid #ef4444',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '540px',
        padding: '40px 36px',
        boxShadow: '0 20px 40px rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
        color: '#f9fafb'
    },
    icon: {
        fontSize: '64px',
        marginBottom: '16px',
        animation: 'pulse 2s infinite'
    },
    title: {
        fontSize: '26px',
        fontWeight: '900',
        color: '#ef4444',
        letterSpacing: '0.1em',
        margin: '0 0 8px'
    },
    subtitle: {
        fontSize: '18px',
        fontWeight: '700',
        color: '#9ca3af',
        margin: '0 0 28px'
    },
    details: {
        background: '#1f2937',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        textAlign: 'left'
    },
    text: {
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#d1d5db',
        margin: '0 0 16px'
    },
    reasonBox: {
        background: '#374151',
        borderLeft: '4px solid #ef4444',
        padding: '10px 14px',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#fca5a5'
    },
    studentInfo: {
        background: '#1f2937',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '28px',
        textAlign: 'left',
        fontSize: '14px',
        lineHeight: '1.8',
        color: '#9ca3af',
        border: '1px solid #374151'
    },
    notice: {
        fontSize: '13px',
        color: '#ef4444',
        lineHeight: '1.5',
        fontWeight: '600'
    }
};
