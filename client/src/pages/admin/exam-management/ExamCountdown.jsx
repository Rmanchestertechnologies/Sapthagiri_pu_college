import { useState, useEffect, useRef } from 'react';

// ─── Exam Live Countdown Component ───
export function ExamCountdown({ startTime, endTime, status, onZero }) {
    const [timeLeft, setTimeLeft] = useState('');
    const hasTriggered = useRef(false);

    useEffect(() => {
        hasTriggered.current = false;
    }, [startTime, endTime, status]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date().getTime();
            if (status === 'scheduled' && startTime) {
                const start = new Date(startTime).getTime();
                const diff = start - now;
                if (diff <= 0) {
                    setTimeLeft('00:00:00');
                    if (onZero && !hasTriggered.current) {
                        hasTriggered.current = true;
                        onZero();
                    }
                } else {
                    setTimeLeft(formatDuration(diff));
                }
            } else if (status === 'live' && endTime) {
                const end = new Date(endTime).getTime();
                const diff = end - now;
                if (diff <= 0) {
                    setTimeLeft('00:00:00');
                    if (onZero && !hasTriggered.current) {
                        hasTriggered.current = true;
                        onZero();
                    }
                } else {
                    setTimeLeft(formatDuration(diff));
                }
            }
        };

        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, [startTime, endTime, status, onZero]);

    const formatDuration = (ms) => {
        const totalSecs = Math.floor(ms / 1000);
        const secs = totalSecs % 60;
        const totalMins = Math.floor(totalSecs / 60);
        const mins = totalMins % 60;
        const totalHours = Math.floor(totalMins / 60);
        const hours = totalHours % 24;
        const days = Math.floor(totalHours / 24);

        let str = '';
        if (days > 0) str += `${days}d `;
        str += `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return str;
    };

    if (status === 'scheduled') {
        return <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginTop: 6 }}>⏳ Starts in: {timeLeft}</div>;
    }
    if (status === 'live') {
        return <div style={{ color: '#10b981', fontSize: 13, fontWeight: 600, marginTop: 6 }}>🟢 Live (Ends in: {timeLeft})</div>;
    }
    return null;
}
