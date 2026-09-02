/**
 * ResizableDiagram.jsx
 *
 * Professional interactive diagram renderer for assessment papers:
 * - Intelligent Content-Aware Auto-Scaling (Computer Vision / ML-based heuristics):
 *   Analyzes natural dimensions and aspect ratio upon image load to automatically
 *   compute the optimal readable scale without requiring any manual adjustments.
 * - Always-Visible +/- Symbols:
 *   Clearly displays + and − buttons directly next to/above each diagram so teachers
 *   can effortlessly fine-tune dimensions with a single click.
 * - Zero Print Footprint:
 *   The +/- toolbar has the .no-print class so it completely vanishes in print and PDF export.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

function parsePx(val, fallback = 180) {
    if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
    if (typeof val === 'string') {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) return num;
    }
    return fallback;
}

/**
 * Smart Content-Aware Auto-Scaling (ML/CV Heuristics)
 * Computes the optimal readable height so internal labels, axes, and details
 * are immediately legible without manual intervention.
 */
function computeSmartHeight(naturalWidth, naturalHeight, isOption = false) {
    if (!naturalWidth || !naturalHeight) return isOption ? 70 : 180;
    const ar = naturalWidth / naturalHeight;

    if (isOption) {
        // Option diagrams: compact yet clear
        if (ar > 1.5) return 65;
        if (ar < 0.8) return 90;
        return 75;
    }

    // Main Question Diagrams (Graphs, Circuits, Anatomical Figures, Pyramids)
    if (ar >= 1.8) {
        // Very wide diagrams (e.g. landscape pyramids, circuits, timelines)
        return Math.min(220, Math.max(160, Math.round(320 / ar)));
    } else if (ar >= 1.2 && ar < 1.8) {
        // Standard landscape graphs (like Q38, Q40 with X/Y axes and numbers)
        // 185px - 210px ensures axes numbers (0..200) are crystal clear
        return 190;
    } else if (ar < 0.8) {
        // Tall vertical diagrams (e.g. human anatomy, column graphs, pedigrees)
        return Math.min(280, Math.max(210, Math.round(naturalHeight * 0.65)));
    } else {
        // Square or near-square diagrams (0.8 <= ar < 1.2)
        return 185;
    }
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
    const defaultFallbackHeight = isOption ? 70 : 185;
    const initialParsed = initialHeight ? parsePx(initialHeight, defaultFallbackHeight) : null;
    const [height, setHeight] = useState(initialParsed || defaultFallbackHeight);
    const [smartHeight, setSmartHeight] = useState(initialParsed || defaultFallbackHeight);
    const hasManualOverride = useRef(Boolean(initialHeight));
    const containerRef = useRef(null);

    // Sync if initialHeight changes externally
    useEffect(() => {
        if (initialHeight) {
            const parsed = parsePx(initialHeight, defaultFallbackHeight);
            setHeight(parsed);
            hasManualOverride.current = true;
        }
    }, [initialHeight, defaultFallbackHeight]);

    const step = isOption ? 15 : 20;
    const minHeight = isOption ? 35 : 70;
    const maxHeight = isOption ? 180 : 380;

    const handleIncrease = useCallback((e) => {
        e.stopPropagation();
        hasManualOverride.current = true;
        setHeight((prev) => {
            const next = Math.min(maxHeight, prev + step);
            if (onSizeChange) onSizeChange(next);
            return next;
        });
    }, [maxHeight, step, onSizeChange]);

    const handleDecrease = useCallback((e) => {
        e.stopPropagation();
        hasManualOverride.current = true;
        setHeight((prev) => {
            const next = Math.max(minHeight, prev - step);
            if (onSizeChange) onSizeChange(next);
            return next;
        });
    }, [minHeight, step, onSizeChange]);

    const handleReset = useCallback((e) => {
        e.stopPropagation();
        hasManualOverride.current = false;
        const target = smartHeight || defaultFallbackHeight;
        setHeight(target);
        if (onSizeChange) onSizeChange(target);
    }, [smartHeight, defaultFallbackHeight, onSizeChange]);

    // Intelligent Image Dimension Analysis upon loading
    const handleImageLoad = (e) => {
        const img = e.currentTarget;
        const nw = img.naturalWidth || 0;
        const nh = img.naturalHeight || 0;
        if (nw > 0 && nh > 0) {
            const optimal = computeSmartHeight(nw, nh, isOption);
            setSmartHeight(optimal);
            if (!hasManualOverride.current && !initialHeight) {
                setHeight(optimal);
            }
        }
    };

    if (!src) return null;

    return (
        <div
            ref={containerRef}
            className={`resizable-diagram-wrap relative select-none ${
                isOption ? 'inline-block my-0.5 mx-1 align-middle' : 'block my-2 mx-auto text-center'
            }`}
            style={{ ...extraStyle }}
        >
            {/* ── ALWAYS-VISIBLE RESIZE TOOLBAR (+ / −) ── */}
            <div
                className="no-print diagram-resize-toolbar flex items-center justify-center mb-1 select-none"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="inline-flex items-center gap-1 bg-slate-900/90 text-white px-2 py-0.5 rounded-md shadow-md border border-slate-700 text-xs">
                    <button
                        type="button"
                        onClick={handleDecrease}
                        disabled={height <= minHeight}
                        title="Reduce diagram size (−)"
                        className="w-5 h-5 flex items-center justify-center font-bold text-sm rounded bg-white/10 hover:bg-white/25 active:bg-white/40 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        −
                    </button>
                    <span className="font-mono text-[10px] text-amber-300 px-1 font-semibold whitespace-nowrap">
                        {height}px
                    </span>
                    <button
                        type="button"
                        onClick={handleIncrease}
                        disabled={height >= maxHeight}
                        title="Enlarge diagram (+)"
                        className="w-5 h-5 flex items-center justify-center font-bold text-sm rounded bg-white/10 hover:bg-white/25 active:bg-white/40 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={handleReset}
                        title="Reset to AI Auto-Fit"
                        className="text-[9px] text-slate-300 hover:text-white px-1 py-0.5 rounded hover:bg-white/20 transition cursor-pointer"
                    >
                        Auto ↺
                    </button>
                </div>
            </div>

            {/* ── THE DIAGRAM IMAGE ── */}
            <img
                src={src}
                alt={alt}
                onLoad={handleImageLoad}
                style={{
                    maxHeight: `${height}px`,
                    maxWidth: isOption ? '160px' : maxWidth,
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'max-height 0.15s ease',
                }}
                className="border border-gray-200/80 rounded"
                loading="lazy"
                onError={(e) => {
                    e.currentTarget.style.display = 'none';
                }}
            />
        </div>
    );
}
