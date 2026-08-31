import React, { createContext, useState, useContext } from 'react';
import Loader from '../components/Loader';

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
            {/* Sleek top progress indicator instead of full-screen blocking white overlay */}
            {isLoading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    zIndex: 99999,
                    background: 'linear-gradient(90deg, #001f6d 0%, #ffd700 50%, #001f6d 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'moveGradient 1.2s linear infinite'
                }} />
            )}
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => useContext(LoadingContext);
