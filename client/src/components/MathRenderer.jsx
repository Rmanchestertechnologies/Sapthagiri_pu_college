import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import ResizableDiagram from './ResizableDiagram';
import { normalizeEquation, ensureMathDelimiters } from '../utils/mathNormalize';
import { processMathOnly, smartConvertRaw, tokenizeMarkdown } from '../utils/mathPipeline';

/**
 * KaTeX-permissive DOMPurify config — allows all KaTeX output HTML safely.
 */
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
        // KaTeX draws the radical sign (and long arrows / braces) as SVG that only shows when it is
        // cropped with preserveAspectRatio="xMinYMin slice" - without it the √ scales away to nothing.
        'viewBox', 'preserveAspectRatio', 'x', 'y', 'd', 'fill', 'stroke', 'stroke-width',
        'transform', 'clip-path', 'mask', 'id', 'href', 'xlink:href',
    ],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'iframe', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    FORCE_BODY: false,
};

export { processMathOnly, smartConvertRaw, tokenizeMarkdown, normalizeEquation, ensureMathDelimiters };

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
    sizeScale = null,
}) => {
    const safeText = typeof text === 'string' ? text : (text ? String(text) : '');
    // Stateless test regex without /g flag to avoid lastIndex mutation across re-renders
    const testImgRegex = /(\{\{IMG::.*?\}\}|!\[.*?\]\(.*?\)|\[DIAGRAM:\s*[^\]]+\]|<img[^>]+src=["'][^"']+["'][^>]*>|https?:\/\/res\.cloudinary\.com\/[^\s"')]+|https?:\/\/[^\s"')]+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s"')]+)?)/i;
    const hasImages = testImgRegex.test(safeText);

    const tokens = useMemo(() => {
        if (!hasImages) return null;
        // Split regex with capture groups
        const splitImgRegex = /(\{\{IMG::.*?\}\}|!\[.*?\]\(.*?\)|\[DIAGRAM:\s*[^\]]+\]|<img[^>]+src=["'][^"']+["'][^>]*>|https?:\/\/res\.cloudinary\.com\/[^\s"')]+|https?:\/\/[^\s"')]+\.(?:png|jpg|jpeg|webp|gif|svg)(?:\?[^\s"')]+)?)/gi;
        const parts = safeText.split(splitImgRegex);
        return parts.map((part, index) => {
            if (!part) return null;
            let src = null;
            let alt = '';
            const imgMatch1 = part.match(/^\{\{IMG::(.*?)\}\}$/i);
            const imgMatch2 = part.match(/^!\[(.*?)\]\((.*?)\)$/i);
            const imgMatch3 = part.match(/^\[DIAGRAM:\s*([^\]]+)\]/i);
            const imgMatch4 = part.match(/^<img[^>]+src=["']([^"']+)["']/i);
            const imgMatch5 = part.match(/^(https?:\/\/[^\s]+)$/i);

            if (imgMatch1) {
                src = imgMatch1[1].trim();
            } else if (imgMatch2) {
                src = imgMatch2[2].trim();
                alt = imgMatch2[1].trim();
            } else if (imgMatch3) {
                src = imgMatch3[1].trim();
            } else if (imgMatch4) {
                src = imgMatch4[1].trim();
            } else if (imgMatch5) {
                src = imgMatch5[1].trim();
            }

            if (src) {
                return {
                    type: 'image',
                    src,
                    alt,
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
            className={`math-renderer ${inline && !hasImages ? 'inline-math' : (isOption ? 'inline-math option-math' : 'block-math')} ${className}`}
            style={{ display: (inline && !hasImages) || isOption ? 'inline-block' : 'block', ...style }}
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
                            sizeScale={sizeScale}
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
