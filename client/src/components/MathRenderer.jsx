import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';

/**
 * Renders text that may contain LaTeX math delimiters ($...$, $$...$$, \(...\), \[...\])
 * and {{IMG::...}} image blocks, into properly formatted HTML with KaTeX math rendering.
 *
 * Uses katex.renderToString() synchronously so math is ALWAYS rendered —
 * no race condition with dangerouslySetInnerHTML.
 */

// KaTeX-permissive DOMPurify config — allows all KaTeX output HTML safely
const KATEX_CONFIG = {
    ALLOWED_TAGS: [
        // Standard inline/block
        'b', 'i', 'u', 'em', 'strong', 'sup', 'sub', 'br', 'span', 'div', 'p',
        'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
        // KaTeX uses these
        'annotation', 'semantics', 'math', 'mrow', 'mi', 'mn', 'mo',
        'mfrac', 'msup', 'msub', 'mspace', 'mtext', 'mover', 'munder',
        'munderover', 'msqrt', 'mroot', 'mfenced', 'mtable', 'mtr', 'mtd',
        // Images
        'img',
        // SVG (KaTeX uses SVG for some symbols)
        'svg', 'path', 'g', 'line', 'rect', 'circle', 'use', 'defs', 'mask',
    ],
    ALLOWED_ATTR: [
        'class', 'style', 'colspan', 'rowspan', 'src', 'alt', 'width', 'height',
        'aria-hidden', 'aria-label', 'role', 'tabindex', 'focusable',
        'mathvariant', 'display', 'xmlns',
        // SVG attrs
        'viewBox', 'x', 'y', 'd', 'fill', 'stroke', 'stroke-width',
        'transform', 'clip-path', 'mask', 'id', 'href', 'xlink:href',
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORCE_BODY: false,
};

/**
 * Converts a raw text string (with LaTeX delimiters) into rendered HTML.
 * Processes in order: $$...$$ → $...$ → \[...\] → \(...\) → {{IMG::...}}
 */
function processText(text, inline = false) {
    if (!text || typeof text !== 'string') return '';

    // 0) Strip internal QPV / QBP / DIFFICULTY tags
    let result = text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();

    // 1) Handle {{IMG::...}} image blocks with clean proportional sizing
    result = result.replace(/\{\{IMG::(.*?)\}\}/gi, (_match, src) => {
        if (inline) {
            // Compact sizing for options / inline structures
            return `<img src="${src}" alt="Structure" style="max-height:48px;max-width:110px;width:auto;height:auto;object-fit:contain;display:inline-block;vertical-align:middle;margin:2px 4px;" />`;
        } else {
            // Standard neat question diagram sizing (never oversized or blown up)
            return `<img src="${src}" alt="Question Diagram" style="max-width:240px;max-height:120px;width:auto;height:auto;object-fit:contain;display:block;margin:6px auto;border-radius:4px;" />`;
        }
    });

    // 2) Handle standard markdown ![alt](src) images if present
    result = result.replace(/!\[(.*?)\]\((.*?)\)/gi, (_match, alt, src) => {
        if (inline) {
            return `<img src="${src}" alt="${alt || 'Structure'}" style="max-height:48px;max-width:110px;width:auto;height:auto;object-fit:contain;display:inline-block;vertical-align:middle;margin:2px 4px;" />`;
        } else {
            return `<img src="${src}" alt="${alt || 'Question Diagram'}" style="max-width:240px;max-height:120px;width:auto;height:auto;object-fit:contain;display:block;margin:6px auto;border-radius:4px;" />`;
        }
    });

    // 3) Render display math: $$...$$ (rendered inline-block to preserve sentence flow)
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math; // fallback: show raw content without delimiters
        }
    });

    // 4) Render display math: \[...\]
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 5) Render inline math: $...$  (single dollar — careful not to match $$ again)
    result = result.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 6) Render inline math: \(...\)
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    return result;
}

const MathRenderer = ({ text, className = '', style = {}, inline = false }) => {
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');

    // Pre-render math synchronously — no useEffect race condition
    const renderedHtml = useMemo(() => {
        const processed = processText(safeText, inline);
        return DOMPurify.sanitize(processed, KATEX_CONFIG);
    }, [safeText, inline]);

    return (
        <span
            className={`math-renderer ${inline ? 'inline-math' : ''} ${className}`}
            style={{ display: 'inline', ...style }}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
    );
};

export default MathRenderer;
