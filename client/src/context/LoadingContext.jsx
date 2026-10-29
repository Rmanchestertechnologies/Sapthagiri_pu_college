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
            {/* Smooth 3-dot bouncing loader replacing the top yellow progress bar */}
            {isLoading && (
                <div
                    style={{
                        position: 'fixed',
                        top: '18px',
                        right: '24px',
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.96)',
                        padding: '7px 14px',
                        borderRadius: '9999px',
                        boxShadow: '0 4px 16px rgba(0, 31, 109, 0.15)',
                        border: '1px solid #e2e8f0',
                        pointerEvents: 'none'
                    }}
                >
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#001f6d', animation: 'sap-bounce 0.6s infinite alternate' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', animation: 'sap-bounce 0.6s infinite alternate 0.2s' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7', animation: 'sap-bounce 0.6s infinite alternate 0.4s' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#001f6d', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: '4px' }}>Loading</span>
                </div>
            )}
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);
