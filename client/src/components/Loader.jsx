import React from 'react';

const Loader = ({ fullPage = false, text = 'Loading...' }) => {
    const dots = (
        <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-2">
                <span
                    style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#001f6d',
                        animation: 'sap-bounce 0.6s infinite alternate'
                    }}
                />
                <span
                    style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b',
                        animation: 'sap-bounce 0.6s infinite alternate 0.2s'
                    }}
                />
                <span
                    style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#0284c7',
                        animation: 'sap-bounce 0.6s infinite alternate 0.4s'
                    }}
                />
            </div>
            {text && (
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {text}
                </span>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="loader-overlay">
                <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', padding: '24px 32px', borderRadius: '24px', boxShadow: '0 8px 30px rgba(0, 31, 109, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    {dots}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8">
            {dots}
        </div>
    );
};

export default Loader;
