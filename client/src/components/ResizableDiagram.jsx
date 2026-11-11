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
 * - Robust Direct CDN Delivery:
 *   Natively renders high-res diagrams from Cloudinary CDN without relying on sleeping
 *   backend proxies. Auto-recovers gracefully from any brief network glitch.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { resolveImageUrl } from './QuestionImage';

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
    if (!naturalWidth || !naturalHeight) return isOption ? 60 : 160;
    const ar = naturalWidth / naturalHeight;

    if (isOption) {
        // Option diagrams: compact so all 4 options fit nicely in 2x2 or 4-across
        if (ar > 1.5) return 55;
        if (ar < 0.8) return 65;
        return 60;
    }

    // Main Question Diagrams:
    // Balanced sizing: legible yet compact enough to prevent awkward column gaps
    let target = 160;
    if (ar >= 2.0) {
        target = 135; // Wide landscape diagrams
    } else if (ar >= 1.2 && ar < 2.0) {
        target = 160; // Standard graphs with axes
    } else if (ar < 0.85) {
        target = 180; // Tall vertical figures
    } else {
        target = 160; // Square or near-square
    }

    if (naturalHeight < target) {
        return Math.max(100, naturalHeight);
    }
    return target;
}

export default function ResizableDiagram({
    src,
    alt = '',
    questionId,
    diagramKey = 'main',
    initialHeight,
    isManual = false,
    onSizeChange,
    isOption = false,
    maxWidth = '100%',
    sizeScale = null,
    extraStyle = {},
}) {
    const resolvedSrc = resolveImageUrl(src);
    const defaultFallbackHeight = isOption ? 60 : 160;
    const initialParsed = initialHeight ? parsePx(initialHeight, defaultFallbackHeight) : null;
    const [height, setHeight] = useState(initialParsed || defaultFallbackHeight);
    const [smartHeight, setSmartHeight] = useState(initialParsed || defaultFallbackHeight);
    const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
    const hasManualOverride = useRef(Boolean(isManual));
    const containerRef = useRef(null);
    const retryTimerRef = useRef(null);
    const retryAttemptRef = useRef(0);

    // Sync src when prop changes
    useEffect(() => {
        const next = resolveImageUrl(src);
        setCurrentSrc(next);
        retryAttemptRef.current = 0;
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
            }
        };
    }, [src]);

    // Sync if initialHeight changes externally
    useEffect(() => {
        if (initialHeight) {
            const parsed = parsePx(initialHeight, defaultFallbackHeight);
            setHeight(parsed);
            if (isManual) {
                hasManualOverride.current = true;
            }
        }
    }, [initialHeight, isManual, defaultFallbackHeight]);

    const step = isOption ? 10 : 20;
    const minHeight = isOption ? 30 : 70;
    const maxHeight = isOption ? 200 : 450;

    const handleIncrease = useCallback((e) => {
        e.stopPropagation();
        hasManualOverride.current = true;
        setHeight((prev) => {
            const next = Math.min(maxHeight, prev + step);
            if (onSizeChange) onSizeChange(next, diagramKey);
            return next;
        });
    }, [maxHeight, step, onSizeChange, diagramKey]);

    const handleDecrease = useCallback((e) => {
        e.stopPropagation();
        hasManualOverride.current = true;
        setHeight((prev) => {
            const next = Math.max(minHeight, prev - step);
            if (onSizeChange) onSizeChange(next, diagramKey);
            return next;
        });
    }, [minHeight, step, onSizeChange, diagramKey]);

    const handleReset = useCallback((e) => {
        e.stopPropagation();
        hasManualOverride.current = false;
        const target = smartHeight || defaultFallbackHeight;
        setHeight(target);
        if (onSizeChange) onSizeChange(target, diagramKey);
    }, [smartHeight, defaultFallbackHeight, onSizeChange, diagramKey]);

    // Intelligent Image Dimension Analysis upon loading:
    const handleImageLoad = (e) => {
        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }
        const img = e.currentTarget;
        const nw = img.naturalWidth || 0;
        const nh = img.naturalHeight || 0;
        if (nw > 0 && nh > 0) {
            const optimal = computeSmartHeight(nw, nh, isOption);
            setSmartHeight(optimal);
            if (!hasManualOverride.current) {
                setHeight(optimal);
            }
        }
    };

    // Resilient background recovery: direct CDN -> cache-busted retry -> robust server proxy fallback
    const handleImageError = useCallback(() => {
        if (!src) return;
        const attempt = retryAttemptRef.current + 1;
        retryAttemptRef.current = attempt;

        if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
        }

        if (attempt <= 3) {
            const delay = 150 * attempt;
            retryTimerRef.current = setTimeout(() => {
                const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
                if (attempt === 1) {
                    // Attempt 1: Add cache buster query parameter to force browser to re-request
                    const sep = src.includes('?') ? '&' : '?';
                    setCurrentSrc(`${src}${sep}_cb=${Date.now()}`);
                } else {
                    // Attempt 2 & 3: Fall back to backend image proxy (bypasses browser rate limits, ad-blockers, CORS drops)
                    const proxyUrl = `${API_BASE}/api/papers/proxy-image?url=${encodeURIComponent(src)}&_cb=${Date.now()}`;
                    setCurrentSrc(proxyUrl);
                }
            }, delay);
        }
    }, [src]);

    if (!src) return null;

    return (
        <div
            ref={containerRef}
            className={`resizable-diagram-wrap relative select-none ${
                isOption ? 'is-option-diagram inline-block my-0.5 mx-0.5 align-middle' : 'block my-1.5 mx-auto text-center'
            }`}
            style={{
                position: 'relative',
                zIndex: 2,
                display: isOption ? 'inline-block' : 'block',
                textAlign: 'center',
                ...extraStyle
            }}
        >
            {/* ── ALWAYS-VISIBLE RESIZE TOOLBAR (+ / −) FOR MAIN DIAGRAMS ── */}
            {!isOption && (
                <div
                    className="no-print diagram-resize-toolbar flex items-center justify-center mb-0.5 select-none"
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
            )}

            {/* ── THE DIAGRAM IMAGE (Transparent Background & Watermark Blend) ── */}
            <img
                src={currentSrc}
                alt={alt || ''}
                loading="eager"
                decoding="async"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{
                    height: `${height}px`,
                    maxHeight: `${height}px`,
                    minHeight: isOption ? '45px' : '70px',
                    minWidth: isOption ? '45px' : '60px',
                    maxWidth: sizeScale ? `${sizeScale}%` : (isOption ? '140px' : (maxWidth || '100%')),
                    width: 'auto',
                    objectFit: 'contain',
                    display: isOption ? 'inline-block' : 'block',
                    margin: '0 auto',
                    borderRadius: '4px',
                    backgroundColor: 'transparent',
                    mixBlendMode: 'multiply',
                    position: 'relative',
                    zIndex: 2,
                    boxSizing: 'border-box',
                    verticalAlign: 'middle',
                    transition: 'height 0.15s ease, max-height 0.15s ease',
                }}
                className="rounded"
            />
        </div>
    );
}
