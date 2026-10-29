import React, { createContext, useState, useContext } from 'react';

const LoadingContext = createContext();

export const LoadingProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [requestCount, setRequestCount] = useState(0);

    const showLoader = () => {
        setIsLoading(true);
        setRequestCount(prev => prev + 1);
    };

    const hideLoader = () => {
        setRequestCount(prev => {
            const nextCount = Math.max(0, prev - 1);
            if (nextCount === 0) setIsLoading(false);
            return nextCount;
        });
    };

    return (
        <LoadingContext.Provider value={{ showLoader, hideLoader, isLoading }}>
            {/* Centered smooth 3-dot bouncing loader - centered on screen, does not persist once loaded */}
            {isLoading && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255, 255, 255, 0.45)',
                        backdropFilter: 'blur(3px)',
                        pointerEvents: 'none'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px',
                            background: '#ffffff',
                            padding: '24px 36px',
                            borderRadius: '24px',
                            boxShadow: '0 12px 36px rgba(0, 31, 109, 0.18)',
                            border: '2px solid rgba(245, 158, 11, 0.4)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#001f6d', animation: 'sap-bounce 0.6s infinite alternate' }} />
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'sap-bounce 0.6s infinite alternate 0.2s' }} />
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0284c7', animation: 'sap-bounce 0.6s infinite alternate 0.4s' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Loading...
                        </span>
                    </div>
                </div>
            )}
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);
