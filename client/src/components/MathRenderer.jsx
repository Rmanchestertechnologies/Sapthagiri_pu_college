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
 * Fallback to clean Unicode math if KaTeX encounters an unrecoverable syntax issue
 */
function formatCleanUnicodeMath(str) {
    if (!str) return '';
    return str
        .replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '$1/$2')
        .replace(/\\frac\s+([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '$1/$2')
        .replace(/\\times/g, '×')
        .replace(/\\pm/g, '±')
        .replace(/\\mp/g, '∓')
        .replace(/\\div/g, '÷')
        .replace(/\\cdot/g, '·')
        .replace(/\\sqrt\s*\{([^}]+)\}/g, '√($1)')
        .replace(/\\mathrm\s*\{([^}]+)\}/g, '$1')
        .replace(/\\text\s*\{([^}]+)\}/g, '$1')
        .replace(/\\mathbf\s*\{([^}]+)\}/g, '$1')
        .replace(/\\([a-zA-Z]+)/g, '')
        .replace(/[{}]/g, '')
        .trim();
}

/**
 * Safely render math with KaTeX, intercepting any errors so red katex-error spans never leak onto papers
 */
function safeRenderKatex(rawMath, displayMode = false) {
    if (!rawMath) return '';
    let math = String(rawMath)
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim();

    // Strip leading / trailing quotes or stray punctuation that break math mode
    math = math.replace(/^['"`:,;]+/, '').replace(/['"`:,;]+$/, '').trim();

    // Auto-fix broken missing \frac syntax e.g. \sigma}2\epsilon_0 -> \frac{\sigma}{2\epsilon_0}
    math = math.replace(/(?:^|\s)(?:\\([a-zA-Z]+)|([a-zA-Z0-9]+))\}(?:\{([^}]+)\}|([^\s}]+))/g, (m, sym, plain, denomBrace, denomPlain) => {
        const num = sym ? `\\${sym}` : plain;
        const den = denomBrace || denomPlain;
        return ` \\frac{${num}}{${den}}`;
    });

    // Auto-fix unbraced fractions e.g. \frac em -> \frac{e}{m}
    math = math.replace(/\\frac\s+([a-zA-Z0-9])\s+([a-zA-Z0-9])\b/g, '\\frac{$1}{$2}');
    math = math.replace(/\\frac\s+([a-zA-Z0-9])([a-zA-Z0-9])\b/g, '\\frac{$1}{$2}');

    try {
        const rendered = katex.renderToString(math, {
            displayMode,
            throwOnError: false,
            output: 'htmlAndMathml'
        });
        // If KaTeX produced a parse error span, suppress it and return clean fallback text
        if (rendered.includes('class="katex-error"') || rendered.includes('color:#cc0000')) {
            return `<span class="inline-math font-medium">${formatCleanUnicodeMath(math)}</span>`;
        }
        return rendered;
    } catch {
        return `<span class="inline-math font-medium">${formatCleanUnicodeMath(math)}</span>`;
    }
}

/**
 * Converts a raw text string with LaTeX math delimiters into rendered HTML.
 */
function processMathOnly(text) {
    if (!text || typeof text !== 'string') return '';

    // 0) Strip HTML entities and internal metadata tags
    let result = text
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/<span\s+class=["']katex-error["'][^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .replace(/\s*\[\s*(?:JEE|NEET|CET|AIPMT|CBSE|KCET|BITSAT|AIIMS|MHT-?CET|IIT|ADVANCED|MAIN)[\s\w\-,\(\)]*\d{4}\s*\]\s*$/i, '')
        .replace(/\s*\[\s*\d+\s*(?:Marks?|M)?\s*\]\s*$/i, '')
        .replace(/\s*\[\s*[A-Za-z]{1,5}\s*[-.]?\s*\d{1,5}\s*\]\s*$/i, '')
        .replace(/\s*\[\s*[A-Za-z0-9_\-]{2,8}\s*\]\s*$/i, '')
        .replace(/\s*Reference\s+case\s+R_?\{?[0-9a-zA-Z_\s]+\}?[0-9a-zA-Z_\s]*\.?/gi, '')
        .replace(/\s*Reference\s+case\b[^\.\n]*\.?/gi, '')
        .trim();

    // 0.5) Auto-fix broken missing \frac syntax e.g. \sigma}2\epsilon_0 -> \frac{\sigma}{2\epsilon_0}
    result = result.replace(/(?:^|\s)(?:\\([a-zA-Z]+)|([a-zA-Z0-9]+))\}(?:\{([^}]+)\}|([^\s}]+))/g, (m, sym, plain, denomBrace, denomPlain) => {
        const num = sym ? `\\${sym}` : plain;
        const den = denomBrace || denomPlain;
        return ` \\frac{${num}}{${den}}`;
    });

    // 1) Auto-wrap naked LaTeX math commands if not surrounded by $
    const nakedLatexRegex = /(?<!\$)\\(?:frac|sqrt|pm|times|div|leq|geq|neq|approx|rightarrow|infty|sum|int|partial|theta|alpha|beta|gamma|lambda|omega|Delta|mu|sigma|epsilon|rho|phi|pi|tau|psi|eta|nu|xi|cdot|circ|text)\b[^{$\n]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*(?!\$)/g;
    result = result.replace(nakedLatexRegex, (match) => `$${match}$`);

    // 2) Render display math: $$...$$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => safeRenderKatex(math, false));

    // 3) Render display math: \[...\]
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => safeRenderKatex(math, false));

    // 4) Render inline math: $...$ (handles multiline inline math cleanly)
    result = result.replace(/\$([\s\S]+?)\$/g, (_match, math) => safeRenderKatex(math, false));

    // 5) Render inline math: \(...\)
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => safeRenderKatex(math, false));

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
