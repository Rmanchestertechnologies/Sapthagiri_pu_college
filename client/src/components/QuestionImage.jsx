import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Universal Image URL resolver:
 * - If a URL starts with http://, https://, or data:, render directly as absolute URL without prepending any local directory (/uploads/...).
 * - If a local path accidentally has a full Cloudinary URL embedded (e.g., "/uploads/https://res.cloudinary.com/..."), strip the prefix and extract the absolute URL.
 * - Handles {{IMG::url}} and markdown ![alt](url) wrappers cleanly.
 */
export function resolveImageUrl(src) {
    if (!src || typeof src !== 'string') return '';
    // Some bank rows carry invisible characters inside the address (a copy-and-paste artifact: "...eac<nbsp>-<nbsp>4d20..."), which
    // points at a file that does not exist. A web address never contains them, so they are removed first.
    let trimmed = src.replace(/[\u00a0\s]*-[\u00a0]+\s*/g, '-').replace(/[\u00a0\u200b-\u200d\u2060\ufeff]+/g, '').trim();

    // Strip {{IMG::...}} wrapper if present
    const imgMatch = trimmed.match(/^\{\{IMG::(.*?)\}\}$/i);
    if (imgMatch) {
        trimmed = imgMatch[1].trim();
    }

    // Strip markdown ![...](...) wrapper if present
    const mdMatch = trimmed.match(/^!\[.*?\]\((.*?)\)$/i);
    if (mdMatch) {
        trimmed = mdMatch[1].trim();
    }

    // Check if an absolute URL is embedded anywhere in the string
    const urlMatch = trimmed.match(/(https?:\/\/[^\s"'<>]+)/i);
    if (urlMatch) {
        return urlMatch[1];
    }

    // Data URI
    if (trimmed.startsWith('data:')) {
        return trimmed;
    }

    // Local relative path fallback
    const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    if (trimmed.startsWith('/')) {
        return `${API_BASE}${trimmed}`;
    }
    return `${API_BASE}/${trimmed}`;
}

/**
 * QuestionImage Component:
 * - Verifies image source and ensures Cloudinary and other external URLs are rendered as absolute URLs
 * - Uses crossOrigin="anonymous" for seamless PDF and html2canvas exports without tainting the canvas
 * - Multi-tier resilient fallback: direct CDN -> cache-busted retry -> server proxy fallback
 */
export default function QuestionImage({
    src,
    alt = 'Question Diagram',
    className = '',
    style = {},
    loading = 'eager',
    crossOrigin = null,
    referrerPolicy = 'no-referrer',
    onError,
    onLoad,
    maxWidth,
    maxHeight,
    ...props
}) {
    const rawResolved = resolveImageUrl(src);
    const [currentSrc, setCurrentSrc] = useState(rawResolved);
    const retryAttemptRef = useRef(0);
    const retryTimerRef = useRef(null);

    useEffect(() => {
        const next = resolveImageUrl(src);
        setCurrentSrc(next);
        retryAttemptRef.current = 0;
        return () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
            }
        };
    }, [src]);

    const handleImageError = useCallback((e) => {
        if (!rawResolved) return;
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
                    const sep = rawResolved.includes('?') ? '&' : '?';
                    setCurrentSrc(`${rawResolved}${sep}_cb=${Date.now()}`);
                } else {
                    const proxyUrl = `${API_BASE}/api/papers/proxy-image?url=${encodeURIComponent(rawResolved)}&_cb=${Date.now()}`;
                    setCurrentSrc(proxyUrl);
                }
            }, delay);
        } else if (onError) {
            onError(e);
        }
    }, [rawResolved, onError]);

    if (!currentSrc) return null;

    const mergedStyle = {
        maxWidth: maxWidth || '100%',
        maxHeight: maxHeight || 'auto',
        objectFit: 'contain',
        display: 'block',
        ...style,
    };

    return (
        <img
            src={currentSrc}
            alt={alt}
            loading={loading}
            decoding="async"
            crossOrigin={crossOrigin}
            referrerPolicy={referrerPolicy}
            onLoad={onLoad}
            onError={handleImageError}
            className={className}
            style={mergedStyle}
            {...props}
        />
    );
}
