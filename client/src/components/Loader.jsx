import React from 'react';

const Loader = ({ fullPage = false }) => {
    if (fullPage) {
        return (
            <div className="loader-overlay">
                <div className="loader"></div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center p-8">
            <div className="loader"></div>
        </div>
    );
};

export default Loader;
