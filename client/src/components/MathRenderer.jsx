import React, { useMemo } from 'react';
import katex from 'katex';
import DOMPurify from 'dompurify';
import ResizableDiagram from './ResizableDiagram';

/**
 * Renders text that may contain LaTeX math delimiters ($...$, $$...$$, \(...\), \[...\])
 * and {{IMG::...}} image blocks, into properly formatted HTML with KaTeX math rendering
 * and interactive resizable diagrams.
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
 * Converts a raw text string with LaTeX math delimiters into rendered HTML.
 */
function processMathOnly(text) {
    if (!text || typeof text !== 'string') return '';

    // 0) Strip internal QPV / QBP / DIFFICULTY tags
    let result = text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();

    // 1) Render display math: $$...$$ (rendered inline-block to preserve sentence flow)
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 2) Render display math: \[...\]
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 3) Render inline math: $...$ (single dollar)
    result = result.replace(/\$([^$\n]+?)\$/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    // 4) Render inline math: \(...\)
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
        try {
            return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, output: 'html' });
        } catch {
            return math;
        }
    });

    return result;
}

const MathRenderer = ({
    text,
    className = '',
    style = {},
    inline = false,
    questionId,
    initialHeight,
    customDiagramSizes = {},
    onSizeChange,
    isOption = false,
    optionIndex,
}) => {
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');
    const hasImages = /\{\{IMG::.*?\}\}|!\[.*?\]\(.*?\)/i.test(safeText);

    const tokens = useMemo(() => {
        if (!hasImages) return null;
        const regex = /(\{\{IMG::.*?\}\}|!\[.*?\]\(.*?\))/gi;
        const parts = safeText.split(regex);
        return parts.map((part, index) => {
            if (!part) return null;
            const imgMatch1 = part.match(/^\{\{IMG::(.*?)\}\}$/i);
            if (imgMatch1) {
                return {
                    type: 'image',
                    src: imgMatch1[1].trim(),
                    alt: 'Question Diagram',
                    key: index,
                };
            }
            const imgMatch2 = part.match(/^!\[(.*?)\]\((.*?)\)$/i);
            if (imgMatch2) {
                return {
                    type: 'image',
                    src: imgMatch2[2].trim(),
                    alt: imgMatch2[1] || 'Question Diagram',
                    key: index,
                };
            }
            return {
                type: 'text',
                html: DOMPurify.sanitize(processMathOnly(part), KATEX_CONFIG),
                key: index,
            };
        }).filter(Boolean);
    }, [safeText, hasImages]);

    if (!hasImages) {
        const renderedHtml = DOMPurify.sanitize(processMathOnly(safeText), KATEX_CONFIG);
        return (
            <span
                className={`math-renderer ${inline ? 'inline-math' : ''} ${className}`}
                style={{ display: 'inline', ...style }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
        );
    }

    return (
        <span
            className={`math-renderer ${inline && !hasImages ? 'inline-math' : 'block-math'} ${className}`}
            style={{ display: inline && !hasImages ? 'inline' : 'block', ...style }}
        >
            {tokens.map((token) => {
                if (token.type === 'text') {
                    return (
                        <span
                            key={token.key}
                            dangerouslySetInnerHTML={{ __html: token.html }}
                        />
                    );
                }
                const tokenKey = isOption
                    ? (optionIndex !== undefined ? `opt_${optionIndex}` : `opt_${token.key}`)
                    : `inline_${token.key}`;
                const resolvedHeight = customDiagramSizes?.[tokenKey] || initialHeight;

                return (
                    <div
                        key={token.key}
                        style={{
                            display: isOption ? 'inline-block' : 'block',
                            textAlign: 'center',
                            margin: isOption ? '2px auto' : '4px auto',
                            clear: isOption ? 'none' : 'both'
                        }}
                    >
                        <ResizableDiagram
                            src={token.src}
                            alt={token.alt}
                            isOption={isOption}
                            questionId={questionId}
                            diagramKey={tokenKey}
                            initialHeight={resolvedHeight}
                            isManual={Boolean(customDiagramSizes?.[tokenKey])}
                            onSizeChange={(h) => onSizeChange && onSizeChange(h, tokenKey)}
                        />
                    </div>
                );
            })}
        </span>
    );
};

export default MathRenderer;
