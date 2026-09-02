/**
 * ResizableDiagram.jsx
 *
 * Professional interactive diagram renderer for assessment papers:
 * - Tap/Click or Hover on any diagram reveals a floating +/- toolbar.
 * - Plus (+) increases diagram size.
 * - Minus (-) decreases diagram size.
 * - Reset (↺) restores default size.
 * - Paper layout reflows immediately as size changes.
 * - Zero print footprint: toolbar is hidden in print / PDF export (no-print).
 */
import React, { useState, useEffect, useRef } from 'react';

function parsePx(val, fallback = 140) {
    if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
    if (typeof val === 'string') {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) return num;
    }
    return fallback;
}

export default function ResizableDiagram({
    src,
    alt = 'Diagram',
    questionId,
    diagramKey = 'main',
    initialHeight,
    onSizeChange,
    isOption = false,
    maxWidth = '100%',
    extraStyle = {},
}) {
    const defaultHeight = isOption ? 70 : 140;
    const initialParsed = parsePx(initialHeight, defaultHeight);
    const [height, setHeight] = useState(initialParsed);
    const [isActive, setIsActive] = useState(false);
    const containerRef = useRef(null);

    // Sync if initialHeight changes externally (e.g. alignment panel global setting)
    useEffect(() => {
        if (initialHeight) {
            setHeight(parsePx(initialHeight, defaultHeight));
        }
    }, [initialHeight, defaultHeight]);

    // Close active toolbar when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsActive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    const step = isOption ? 15 : 20;
    const minHeight = isOption ? 30 : 50;
    const maxHeight = isOption ? 180 : 380;

    const handleIncrease = (e) => {
        e.stopPropagation();
        setHeight((prev) => {
            const next = Math.min(maxHeight, prev + step);
            if (onSizeChange) onSizeChange(next);
            return next;
        });
    };

    const handleDecrease = (e) => {
        e.stopPropagation();
        setHeight((prev) => {
            const next = Math.max(minHeight, prev - step);
            if (onSizeChange) onSizeChange(next);
            return next;
        });
    };

    const handleReset = (e) => {
        e.stopPropagation();
        setHeight(defaultHeight);
        if (onSizeChange) onSizeChange(defaultHeight);
    };

    if (!src) return null;

    return (
        <div
            ref={containerRef}
            className={`resizable-diagram-wrap relative group inline-block max-w-full text-center select-none ${
                isOption ? 'my-0.5 mx-1 align-middle' : 'my-1.5 mx-auto block'
            }`}
            style={{ ...extraStyle }}
            onClick={(e) => {
                // Tapping/clicking diagram toggles active toolbar
                e.stopPropagation();
                setIsActive((prev) => !prev);
            }}
            title="Click or tap to resize diagram"
        >
            {/* ── FLOATING RESIZE TOOLBAR ── */}
            <div
                className={`no-print absolute left-1/2 -translate-x-1/2 z-30 transition-all duration-150 ${
                    isOption ? '-top-7' : '-top-8'
                } ${
                    isActive
                        ? 'opacity-100 pointer-events-auto scale-100'
                        : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto scale-95 group-hover:scale-100'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-1 bg-slate-900/95 hover:bg-slate-900 text-white px-2 py-0.5 rounded-full shadow-xl border border-slate-700 text-xs backdrop-blur-md">
                    <button
                        type="button"
                        onClick={handleDecrease}
                        disabled={height <= minHeight}
                        title="Decrease diagram size"
                        className="w-5 h-5 flex items-center justify-center font-black rounded-full hover:bg-white/20 active:bg-white/30 transition cursor-pointer text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        −
                    </button>
                    <span className="font-mono text-[10px] font-bold text-amber-300 px-1 whitespace-nowrap">
                        {height}px
                    </span>
                    <button
                        type="button"
                        onClick={handleIncrease}
                        disabled={height >= maxHeight}
                        title="Increase diagram size"
                        className="w-5 h-5 flex items-center justify-center font-black rounded-full hover:bg-white/20 active:bg-white/30 transition cursor-pointer text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={handleReset}
                        title="Reset to default size"
                        className="w-4 h-4 ml-0.5 flex items-center justify-center text-[10px] text-slate-300 hover:text-white rounded hover:bg-white/20 transition cursor-pointer"
                    >
                        ↺
                    </button>
                </div>
            </div>

            {/* ── THE DIAGRAM IMAGE ── */}
            <img
                src={src}
                alt={alt}
                style={{
                    maxHeight: `${height}px`,
                    maxWidth: isOption ? '140px' : maxWidth,
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    transition: 'max-height 0.15s ease',
                    boxShadow: isActive ? '0 0 0 2px #001f6d' : 'none',
                }}
                className={`transition-shadow ${
                    isActive ? 'ring-2 ring-navy/60 shadow-md' : 'group-hover:ring-1 group-hover:ring-navy/30'
                }`}
                loading="lazy"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                }}
            />
        </div>
    );
}
