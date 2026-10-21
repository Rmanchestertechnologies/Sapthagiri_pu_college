/**
 * QuestionBlock.jsx
 *
 * Professional question block renderer adhering to standard A4 assessment typography:
 * - Bold question text ONLY.
 * - Options are normal font-weight (never bold unless explicitly part of LaTeX/text).
 * - Intelligent Diagram Placement:
 *     1. Side-by-Side (Left: Question + Options, Right: Diagram) when appropriate
 *     2. Inline (between statement and options)
 *     3. Full-width (for wide graphs / circuits)
 * - Interactive Diagram Resizing via ResizableDiagram (+ / - controls right on the diagram)
 * - Zero overlap, no clipping, proper line spacing, KaTeX math/chem preservation.
 */
import React from 'react';
import MathRenderer from './MathRenderer';
import ResizableDiagram from './ResizableDiagram';
import { optionLabel, getQuestionOptionLabels } from '../utils/sanitize';

/**
 * Dynamic option grid calculator based on length and complexity:
 * - Complex formulas / long equations (e.g. Q33 vector equations): 1 column (vertical stack)
 * - 2-Column paper mode:
 *     - Short scalars / tiny choices (<= 4 chars, no math): 4 columns across
 *     - Medium (<= 18 chars, e.g. "50 minutes", short math): 2x2 grid (1fr 1fr)
 *     - Long or complex formulas: 1 column (vertical stack)
 * - 1-Column paper mode:
 *     - Short scalars (<= 10 chars, no complex math): 4 columns across
 *     - Medium (<= 32 chars): 2x2 grid
 *     - Long or complex formulas: 1 column (vertical stack)
 */
function getDynamicOptGrid(options = [], isTwoColMode = false) {
    if (!options || options.length === 0) return { display: 'none' };

    let hasComplexFormula = false;
    let hasAnyMath = false;

    const parsedOptions = options.map((opt) => {
        if (!opt) return { text: '', len: 0, hasMath: false, isComplex: false, hasImage: false };
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : opt).trim();
        const hasImage = /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        const clean = str.replace(/<[^>]+>/g, '').trim();

        // Detect math / LaTeX commands / symbols
        const mathMatch = /(\$|\\\(|\\\[|\\|\^|_)/i.test(clean);
        if (mathMatch) hasAnyMath = true;

        // Complex formula detection:
        // - Fractions (\frac, \dfrac)
        // - Vectors or hats (\vec, \hat)
        // - Integrals, square roots, matrices, summations (\sqrt, \int, \sum, \matrix, \begin)
        // - Long formulas with mathematical operators (+, -, =)
        const complexMatch =
            /(\\frac|\\dfrac|\\vec|\\hat|\\sqrt|\\int|\\sum|\\prod|\\matrix|\\begin|\\rightarrow|\|)/i.test(clean) ||
            (mathMatch && (clean.length > 14 || /(=|\+.*\-|\-.*\+|\^\{?\d+\}?.*_)/.test(clean)));

        if (complexMatch) {
            hasComplexFormula = true;
        }

        return {
            text: str,
            len: clean.length,
            hasMath: mathMatch,
            isComplex: complexMatch,
            hasImage,
        };
    });

    // ── HORIZONTAL GRID FOR OPTIONS WITH DIAGRAMS (Q40, Q52) ──
    const hasAnyOptionImage = parsedOptions.some((o) => o.hasImage);
    if (hasAnyOptionImage) {
        if (isTwoColMode) {
            // In 2-column mode: 2x2 grid
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '3px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }
        // In 1-column mode: All 4 options laid out horizontally side-by-side!
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(4, options.length)}, minmax(0, 1fr))`,
            gap: '3px 10px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    const maxLen = Math.max(...parsedOptions.map((o) => o.len), 0);

    // ── TWO-COLUMN PAPER MODE (each column is ~350px wide) ──
    if (isTwoColMode) {
        if (hasComplexFormula) {
            return {
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: '2px 6px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Short scalar choices (e.g. 0, 1, 2, 3 or A, B, C, D)
        if (maxLen <= 5 && !hasAnyMath && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Medium options (e.g. up to 22 chars): 2x2 grid
        if (maxLen <= 22 && options.length <= 4) {
            return {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '2px 8px',
                marginTop: '3px',
                alignItems: 'start',
            };
        }

        // Long text or formulas: 1 column vertical stack
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '2px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    // ── SINGLE-COLUMN PAPER MODE (full A4 width ~730px) ──
    if (hasComplexFormula && maxLen > 28) {
        return {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: '3px 6px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 16 && !hasComplexFormula && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
            gap: '2px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    if (maxLen <= 36 && options.length <= 4) {
        return {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '3px 14px',
            marginTop: '3px',
            alignItems: 'start',
        };
    }

    return {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '3px 6px',
        marginTop: '3px',
        alignItems: 'start',
    };
}

const Q = {
    wrap: {
        display: 'inline-block',
        width: '100%',
        breakInside: 'avoid',
        WebkitColumnBreakInside: 'avoid',
        pageBreakInside: 'avoid',
        marginBottom: '0px',
        color: '#111',
        fontSize: 'inherit',
        fontFamily: 'inherit',
        fontStyle: 'normal',
        lineHeight: '1.42',
        boxSizing: 'border-box',
        verticalAlign: 'top',
    },
    row: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '6px',
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    num: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '24px',
        fontSize: '1em',
        lineHeight: '1.42',
        color: '#000',
    },
    body: {
        flex: 1,
        minWidth: 0,
        fontFamily: 'inherit',
        fontStyle: 'normal',
    },
    qTextBold: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#000',
        display: 'inline',
        lineHeight: '1.42',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    marks: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        fontSize: '1em',
        alignSelf: 'flex-start',
        marginLeft: '6px',
        color: '#444',
    },
    optRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        wordBreak: 'normal',
        overflowWrap: 'break-word',
        minWidth: 0,
        maxWidth: '100%',
        fontSize: '1em',
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        color: '#111',
    },
    optLbl: {
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        minWidth: '22px',
        flexShrink: 0,
        lineHeight: '1.42',
        color: '#222',
        fontSize: '1em',
    },
    sideBySideContainer: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '3px',
    },
    sideLeftContent: {
        flex: '1 1 58%',
        minWidth: 0,
    },
    sideRightDiagram: {
        flex: '0 0 40%',
        maxWidth: '270px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2px',
    },
    matchTable: {
        width: '100%',
        borderCollapse: 'collapse',
        margin: '4px 0 6px',
        fontSize: '0.94em',
        tableLayout: 'fixed',
        fontWeight: 400,
    },
    matchTh: {
        border: '1px solid #cbd5e1',
        padding: '3px 6px',
        background: '#f8fafc',
        fontWeight: 700,
        textAlign: 'left',
        width: '50%',
        color: '#001f6d',
        fontSize: '0.94em',
    },
    matchTd: {
        border: '1px solid #cbd5e1',
        padding: '3px 6px',
        verticalAlign: 'top',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        width: '50%',
        fontWeight: 400,
        color: '#1e293b',
        fontSize: '0.94em',
        lineHeight: '1.35',
    },
    assertRow: {
        display: 'flex',
        gap: '6px',
        marginBottom: '3px',
        alignItems: 'baseline',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        fontSize: '1em',
        fontWeight: 400,
        lineHeight: '1.46',
    },
    assertLabel: {
        fontWeight: 600,
        whiteSpace: 'nowrap',
        color: '#000',
        fontSize: '1em',
        minWidth: '105px',
        flexShrink: 0,
        lineHeight: '1.46',
    },
    assertText: {
        flex: 1,
        fontWeight: 400,
        color: '#111',
        fontSize: '1em',
        lineHeight: '1.46',
    },
};

/**
 * Intelligent Layout Decision:
 * Decides whether diagram should be rendered side-by-side on the right, or inline/full-width
 */
function shouldRenderSideBySide(q, isTwoCol = false, resolvedImageUrl = null) {
    const img = resolvedImageUrl || q.imageUrl || q.image_url;
    if (!img) return false;
    // In 2-column paper mode, column width is narrower, so inline/balanced is cleaner
    if (isTwoCol) return false;

    // Check options: if 2 to 4 options and options don't have images themselves
    const options = Array.isArray(q.options) ? q.options : [];
    if (options.length >= 2 && options.length <= 4) {
        const hasOptImg = options.some(opt => {
            const str = String(typeof opt === 'object' ? (opt.text || opt.option || '') : (opt || ''));
            return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
        });
        if (hasOptImg) return false; // Options with diagrams use horizontal grid

        const totalOptLength = options.reduce((sum, opt) => sum + String(typeof opt === 'object' ? (opt.text || opt.option || '') : (opt || '')).length, 0);
        return totalOptLength < 280; // Side-by-side works cleanly when options fit neatly on the left
    }
    return false;
}

/** Standard 4 assertion-reason options (NEET/CET format) */
const AR_OPTIONS = [
    'Both Assertion and Reason are correct and Reason is the correct explanation of Assertion.',
    'Both Assertion and Reason are correct but Reason is not the correct explanation of Assertion.',
    'Assertion is correct but Reason is incorrect.',
    'Assertion is incorrect but Reason is correct.',
];

function cleanStatementText(str) {
    if (!str) return '';
    return String(str)
        .replace(/^[:\-]\s*/, '')
        .replace(/\s*Reference\s+case\s+R_?\{?[0-9a-zA-Z_\s]+\}?[0-9a-zA-Z_\s]*\.?/gi, '')
        .replace(/\s*Reference\s+case\b[^\.\n]*\.?/gi, '')
        .replace(/```/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/** Parse assertion/reason from question text */
function parseAssertionReason(q) {
    if (q.assertion) {
        return {
            assertion: cleanStatementText(q.assertion),
            reason: cleanStatementText(q.reason || '')
        };
    }
    let txt = q.questionText || q.question || '';

    // 1. Remove markdown code fences e.g. ```
    txt = txt.replace(/```[\s\S]*?```/g, '').replace(/```/g, '');

    // 2. Remove leaked solution explanations
    txt = txt.replace(/(?:Therefore|Hence|Thus),?\s*option\s*[\(\[]?[a-d1-4][\)\]]?\s*is\s*correct[\s\S]*?(?=Reason|$)/gi, '');
    txt = txt.replace(/(?:Therefore|Hence|Thus),?\s*option\s*[\(\[]?[a-d1-4][\)\]]?\s*is\s*correct[\s\S]*/gi, '');

    // 3. Match Assertion (A) and Reason (R)
    const aMatch = txt.match(/Assertion\s*(?:\(A\))?\s*[:\-]?\s*([\s\S]*?)(?=Reason\s*(?:\(R\))?[:\-]|$)/i);
    const rMatch = txt.match(/Reason\s*(?:\(R\))?\s*[:\-]?\s*([\s\S]*)$/i);

    let assertion = aMatch ? aMatch[1].trim() : txt;
    let reason = rMatch ? rMatch[1].trim() : '';

    // 4. Remove duplicate keywords or leaked solution sentences
    assertion = assertion.replace(/^[:\-]\s*/, '').replace(/\s*(?:Assertion|Reason)\s*(?:\([AR]\))?.*$/i, '').trim();
    reason = reason.replace(/^[:\-]\s*/, '').replace(/\s*Assertion\s*(?:\(A\))?.*$/i, '').trim();

    // Specific fix for polluted questions like the one in Image 3:
    assertion = assertion.replace(/\s*The\s*Reason\s*is\s*true[\s\S]*/i, '').replace(/\s*Reference\s+case[\s\S]*$/i, '').trim();
    reason = reason.replace(/\s*The\s*two\s*statements\s*are\s*therefore[\s\S]*/i, '').replace(/\s*Reference\s+case[\s\S]*$/i, '').trim();

    return {
        assertion: cleanStatementText(assertion),
        reason: cleanStatementText(reason)
    };
}

export function cleanOptionText(text) {
    if (!text) return '';
    let str = String(text)
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim();
    // Strip leading duplicate option indicators like (A), (1), A., 1., (a), (i), etc.
    // ONLY if followed by actual option content (don't strip if option itself is just "1" or "A")
    str = str.replace(/^(\s*[\(\[]?(?:[A-Da-d]|[1-4])[\)\]\.:\-]\s+)(?=\S)/i, '');
    return str.trim();
}

export function cleanQuestionText(text) {
    if (!text) return '';
    let str = String(text);

    // 0. Clean HTML entities & strip any leaked raw katex-error spans
    str = str
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/<span\s+class=["']katex-error["'][^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/style=["']color:#cc0000["'][^>]*>[\s\S]*?(?:<\/span>|$)/gi, '');

    // 1. Strip leading question numbers e.g. "1.", "Q.1.", "Q 1:"
    str = str.replace(/^(\s*(?:Q\.?\s*)?\d+[\.\)\-:]\s*)+/i, '');

    // 2. Strip internal metadata tags
    str = str.replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '');
    str = str.replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '');

    // 3. Strip trailing leaked exam/year tags like "[JEE Advanced 2020]", "JEE Advanced 2023", "[NEET 2021]", "[MHT-CET 2023]"
    str = str.replace(/\s*\[\s*(?:JEE|NEET|CET|AIPMT|CBSE|KCET|BITSAT|AIIMS|MHT-?CET|IIT|ADVANCED|MAIN)[\s\w\-,\(\)]*\d{4}\s*\]\s*$/i, '');
    str = str.replace(/\s*(?:JEE\s*(?:\(Advanced\)|\(Main\)|Advanced|Main)?|NEET|KCET|MHT-?CET|AIPMT|AIIMS)\s*\(?\d{4}\)?\s*$/i, '');
    str = str.replace(/\s*\[\s*\d{4}\s*\]\s*$/i, '');
    str = str.replace(/\s*\(\s*\d{4}\s*\)\s*$/i, '');

    // 4. Strip trailing marks indicators like "[1 Mark]", "[4 Marks]", "[1]"
    str = str.replace(/\s*\[\s*\d+\s*(?:Marks?|M)?\s*\]\s*$/i, '');

    // Strip leaked internal prompt/reference artifacts e.g. "Reference case R_{2}4."
    str = str.replace(/\s*Reference\s+case\s+R_?\{?[0-9a-zA-Z_\s]+\}?[0-9a-zA-Z_\s]*\.?/gi, '');
    str = str.replace(/\s*Reference\s+case\b[^\.\n]*\.?/gi, '');

    // 4b. Strip trailing reference codes like "[P28]", "[C65]", "[C21]", "[G13]", "[G12]", "[W8]", "[P-10]"
    str = str.replace(/\s*\[\s*[A-Za-z]{1,5}\s*[-.]?\s*\d{1,5}\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*[A-Za-z0-9_\-]{2,8}\s*\]\s*$/i, '');

    // 5. Strip trailing leaked options like "\n(A) 2/3\n(B) 1/3\n(C) 1/2\n(D) 3/2"
    str = str.replace(/(?:\r?\n|\s{2,})\(?[A-Da-d1-4]\)[\s\S]*$/i, '');

    // 6. Strip trailing isolated newline numbers like "\n1" or "\n 2"
    str = str.replace(/(?:\r?\n)\s*\d{1,2}\s*$/i, '');

    return str.trim();
}

/**
 * Extracts any embedded diagrams from raw question text (e.g. {{IMG::url}} or ![...](url)),
 * repairs any split words caused by inline image markers (e.g. "plo {{IMG}} s" -> "plots"),
 * and returns clean text plus the extracted diagram URL.
 */
function extractDiagramFromText(rawText, existingImageUrl) {
    if (!rawText) return { cleanText: '', diagramUrl: existingImageUrl || null };

    let cleanText = String(rawText);
    let extractedUrl = existingImageUrl || null;

    // Pattern 1: {{IMG::url}}
    const imgMatch1 = cleanText.match(/\{\{IMG::(.*?)\}\}/i);
    if (imgMatch1) {
        if (!extractedUrl) extractedUrl = imgMatch1[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*\{\{IMG::.*?\}\}\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/\{\{IMG::.*?\}\}/gi, ' ');
    }

    // Pattern 2: ![alt](url)
    const imgMatch2 = cleanText.match(/!\[(.*?)\]\((.*?)\)/i);
    if (imgMatch2) {
        if (!extractedUrl) extractedUrl = imgMatch2[2].trim();
        cleanText = cleanText.replace(/(\w+)\s*!\[.*?\]\(.*?\)\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/!\[.*?\]\(.*?\)/gi, ' ');
    }

    // Pattern 3: <img ... src="..." />
    const imgMatch3 = cleanText.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch3) {
        if (!extractedUrl) extractedUrl = imgMatch3[1].trim();
        cleanText = cleanText.replace(/(\w+)\s*<img[^>]*>\s*(\w+)/gi, (m, p1, p2) => p1 + p2);
        cleanText = cleanText.replace(/<img[^>]*>/gi, ' ');
    }

    // Clean up excessive whitespace
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();

    return { cleanText, diagramUrl: extractedUrl };
}

/**
 * MCQ Body with Intelligent Diagram Placement & Resizing
 */
function BodyMCQ({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const options = Array.isArray(q.options) ? q.options : [];
    const isSideBySide = shouldRenderSideBySide(q, isTwoCol, imageUrl);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const hasAnyOptionImage = options.some(opt => {
        const str = String(typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : (opt || ''));
        return /\{\{IMG::|!\[|\[DIAGRAM:|<img|https?:\/\/.*?\.(png|jpg|jpeg|webp|svg|gif)|data:image\//i.test(str);
    });

    // Render Options List
    const renderOptions = (forceSingle = false) => {
        if (options.length === 0) return null;
        return (
            <div
                style={
                    forceSingle
                        ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2px 6px', marginTop: '2px' }
                        : getDynamicOptGrid(options, isTwoCol)
                }
            >
                {options.map((opt, i) => {
                    const rawOpt = typeof opt === 'object' ? (opt.text || opt.optionText || opt.value || opt.option || '') : String(opt || '');
                    const optText = cleanOptionText(rawOpt);
                    const optHeight = q.customDiagramSizes?.[`opt_${i}`] || q.customOptionDiagramHeight || '60px';

                    return (
                        <div
                            key={i}
                            style={{
                                ...Q.optRow,
                                flexDirection: 'row',
                                alignItems: hasAnyOptionImage ? 'center' : 'baseline',
                                textAlign: 'left',
                                gap: '4px',
                            }}
                        >
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer
                                    inline
                                    text={optText}
                                    questionId={qId}
                                    initialHeight={optHeight}
                                    customDiagramSizes={q.customDiagramSizes}
                                    isOption={true}
                                    optionIndex={i}
                                    onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || `opt_${i}`) : undefined}
                                />
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (imageUrl && isSideBySide) {
        // SIDE-BY-SIDE:
        // Top: Question statement (full width)
        // Bottom: Left = Options (stacked vertically), Right = Diagram
        return (
            <>
                {qText && (
                    <div style={{ ...Q.qTextBold, marginBottom: '3px' }}>
                        <MathRenderer
                            inline
                            text={qText}
                            questionId={qId}
                            customDiagramSizes={q.customDiagramSizes}
                            onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                        />
                    </div>
                )}
                <div style={Q.sideBySideContainer}>
                    <div style={Q.sideLeftContent}>
                        {renderOptions(true)}
                    </div>
                    <div style={Q.sideRightDiagram}>
                        <ResizableDiagram
                            src={imageUrl}
                            alt="Diagram"
                            questionId={qId}
                            diagramKey="main"
                            initialHeight={currentDiagramHeight}
                            isManual={isMainManual}
                            onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                            maxWidth="100%"
                        />
                    </div>
                </div>
            </>
        );
    }

    // INLINE / STANDARD LAYOUT
    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: imageUrl ? '3px' : '2px' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {renderOptions(false)}
        </>
    );
}

/**
 * Assertion & Reason Body
 */
/**
 * Assertion & Reason Body
 */
function BodyAssertionReason({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { assertion, reason } = parseAssertionReason(q);
    const opts = q.options && q.options.length > 0 ? q.options : AR_OPTIONS;
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    // Check if there is introductory directions text BEFORE the word "Assertion"
    let introText = '';
    const introMatch = qText.match(/^([\s\S]*?)(?=Assertion\s*(?:\(A\))?[:\-])/i);
    if (introMatch && introMatch[1].trim().length > 0) {
        const candidate = introMatch[1].trim();
        if (!/Amniocentesis|is one of the/i.test(candidate)) {
            introText = candidate;
        }
    }

    return (
        <>
            {introText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={introText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            <div style={{ marginBottom: '3px' }}>
                <div style={{ marginBottom: '2px', lineHeight: '1.42' }}>
                    <strong style={{ color: '#000', marginRight: '6px' }}>Assertion (A):</strong>
                    <MathRenderer inline text={assertion} />
                </div>
                {reason && (
                    <div style={{ marginBottom: '2px', lineHeight: '1.42' }}>
                        <strong style={{ color: '#000', marginRight: '6px' }}>Reason (R):</strong>
                        <MathRenderer inline text={reason} />
                    </div>
                )}
            </div>
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '3px auto 5px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            <div style={{ marginTop: '3px', ...getDynamicOptGrid(opts, isTwoCol) }}>
                {opts.map((opt, i) => (
                    <div key={i} style={Q.optRow}>
                        <span style={Q.optLbl}>({optionLabel(i, classes)})</span>
                        <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                            <MathRenderer inline text={cleanOptionText(typeof opt === 'object' ? (opt.text || opt.option || '') : opt)} />
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Match the Following Body
 */
/**
 * Auto-repair broken LaTeX fractions missing \frac{ prefix (e.g. \sigma}2\epsilon_0 -> \frac{\sigma}{2\epsilon_0})
 */
export function repairBrokenLatexFraction(str) {
    if (!str) return '';
    return str.replace(/(?:^|\s)(?:\\([a-zA-Z]+)|([a-zA-Z0-9]+))\}(?:\{([^}]+)\}|([^\s}]+))/g, (m, sym, plain, denomBrace, denomPlain) => {
        const num = sym ? `\\${sym}` : plain;
        const den = denomBrace || denomPlain;
        return ` \\frac{${num}}{${den}}`;
    });
}

/** Parse match the following from text when matchPairs array is empty */
function parseMatchFromText(q) {
    if (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) {
        return { introText: cleanQuestionText(q.questionText || q.question || ''), pairs: q.matchPairs };
    }
    if (Array.isArray(q.column_a) && q.column_a.length > 0 && Array.isArray(q.column_b) && q.column_b.length > 0) {
        const maxL = Math.max(q.column_a.length, q.column_b.length);
        const pairs = [];
        for (let i = 0; i < maxL; i++) {
            pairs.push({
                left: q.column_a[i] || '',
                right: q.column_b[i] || ''
            });
        }
        return { introText: cleanQuestionText(q.questionText || q.question || ''), pairs };
    }
    let txt = cleanQuestionText(q.questionText || q.question || '');
    if (!txt) return { introText: '', pairs: [] };

    // Clean up bold asterisks around headers e.g. **Column I** -> Column I
    txt = txt.replace(/\*\*(Column|List)\s*[-:]?\s*(I|II|1|2|A|B)\*\*/gi, '$1 $2');

    // 1. Strip and preserve introductory sentence like "Match Column-I with Column-II" or "Match the items in Column I with Column II:"
    const introSentenceRegex = /^([\s\S]*?Match\s+[a-zA-Z\s\-']*\b(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[a-zA-Z\s\-']*?\bwith\b[a-zA-Z\s\-']*?\b(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b[\.:\-]?)(\s+|$)/i;
    let introText = '';
    let remainder = txt;

    const introMatch = txt.match(introSentenceRegex);
    if (introMatch) {
        introText = introMatch[1].trim();
        remainder = txt.substring(introMatch[0].length).trim();
    } else {
        const genIntroMatch = txt.match(/^([\s\S]*?Match\s+(?:the\s+following(?:\s+columns|\s+items)?)?[\.:\-]?)(\s+|$)/i);
        if (genIntroMatch && genIntroMatch[1].length < 120) {
            introText = genIntroMatch[1].trim();
            remainder = txt.substring(genIntroMatch[0].length).trim();
        }
    }

    let rawCol1 = '';
    let rawCol2 = '';

    const col1HeaderRegex = /^(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[:\-\s]*/i;
    const col2SplitRegex = /(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b[:\-\s]*([\s\S]*?)(?=(?:Choose\s+the\s+correct|Select\s+the\s+correct|Options:?|\([a-d1-4]\)\s*[A-D]|\([A-D]\)\s*\(?[A-D0-9]|Codes\s*:?|$))/i;

    if (col1HeaderRegex.test(remainder)) {
        const withoutCol1 = remainder.replace(col1HeaderRegex, '').trim();
        const splitMatch = withoutCol1.match(col2SplitRegex);
        if (splitMatch) {
            rawCol1 = withoutCol1.substring(0, splitMatch.index).trim();
            rawCol2 = splitMatch[1].trim();
        }
    } else {
        const splitMatch = remainder.match(col2SplitRegex);
        if (splitMatch) {
            rawCol1 = remainder.substring(0, splitMatch.index).trim();
            rawCol2 = splitMatch[1].trim();
        } else {
            // Fallback: search in full txt if intro was not stripped
            const fallbackRegex = /(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b([\s\S]*?)(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b([\s\S]*?)(?=(?:Choose\s+the\s+correct|Select\s+the\s+correct|Options:?|\([a-d1-4]\)\s*[A-D]|\([A-D]\)\s*\(?[A-D0-9]|Codes\s*:?|$))/i;
            const fbMatch = txt.match(fallbackRegex);
            if (fbMatch) {
                introText = txt.substring(0, fbMatch.index).trim();
                rawCol1 = fbMatch[1].trim();
                rawCol2 = fbMatch[2].trim();
            }
        }
    }

    if (!rawCol1 || !rawCol2) {
        return { introText: txt, pairs: [] };
    }

    // Auto-repair any broken fraction syntax in both columns
    rawCol1 = repairBrokenLatexFraction(rawCol1);
    rawCol2 = repairBrokenLatexFraction(rawCol2);

    const cleanItem = (s) => {
        if (!s) return '';
        return cleanStatementText(s)
            .replace(/^[\(\[]?(?:[A-Ea-e1-8]|i{1,4}|iv|v|vi{0,3}|ix|x|[p-tP-T])[\)\]\.:\-]\s*/, '')
            .replace(/^\*+\s*/, '')
            .replace(/\*+$/, '')
            .replace(/^(?:with|Column|List|I|II|A|B|1|2)\s*/i, '')
            .replace(/[:\-]$/, '')
            .trim();
    };

    const extractItems = (colStr, isLeft = true, targetCount = 0) => {
        if (!colStr) return [];

        // 1. Explicit markers: (A), (B), (i), (ii), 1., 2., (p), (q), etc.
        const markerTokenRegex = /(?:^|\s)(?:\(([A-Ea-e1-9]|i{1,4}|iv|v|vi{0,3}|ix|x|[p-tP-T])\)|([A-Ea-e1-9]|i{1,4}|iv|v|vi{0,3}|ix|x|[p-tP-T])[\.:\-\)])\s+/g;
        const markers = [];
        let im;
        while ((im = markerTokenRegex.exec(colStr)) !== null) {
            markers.push({
                index: im.index,
                matchLength: im[0].length,
                label: im[1] || im[2]
            });
        }
        if (markers.length >= 2) {
            const markerItems = [];
            for (let i = 0; i < markers.length; i++) {
                const start = markers[i].index + markers[i].matchLength;
                const end = (i + 1 < markers.length) ? markers[i + 1].index : colStr.length;
                const itemText = cleanItem(colStr.substring(start, end));
                if (itemText && !/^(?:with|Column|List|I|II|A|B|1|2)$/i.test(itemText)) {
                    markerItems.push(itemText);
                }
            }
            if (markerItems.length >= 2) return markerItems;
        }

        // 2. Newlines or HTML breaks
        const lines = colStr
            .split(/\r?\n+|<br\s*\/?>/i)
            .map(s => cleanItem(s))
            .filter(s => s && !/^(?:with|Column|List|I|II|A|B|1|2)$/i.test(s));
        if (lines.length >= 2) return lines;

        // 3. Semicolons or bullet points
        if (/[;•]/.test(colStr)) {
            const semiItems = colStr
                .split(/[;•]+/)
                .map(s => cleanItem(s))
                .filter(s => s && !/^(?:with|Column|List|I|II|A|B|1|2)$/i.test(s));
            if (semiItems.length >= 2) return semiItems;
        }

        // 4. Repeating prefix split (e.g. "Electric field due to an ...")
        const words = colStr.trim().split(/\s+/);
        if (words.length >= 8) {
            for (let plen = 4; plen >= 2; plen--) {
                const candidatePrefix = words.slice(0, plen).join(' ');
                const escaped = candidatePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp(`(?:^|\\s)(?=${escaped})`, 'gi');
                const parts = colStr.split(re).map(s => cleanItem(s)).filter(Boolean);
                if (parts.length >= 2 && parts.length <= 6) {
                    return parts;
                }
            }
        }

        // 5. Short math tokens / space-separated values for Column II
        const mathTokens = colStr.trim().split(/\s+(?=[\\0-9a-zA-Z\-])/).map(s => cleanItem(s)).filter(Boolean);
        if (mathTokens.length >= 2 && (targetCount === 0 || mathTokens.length === targetCount || Math.abs(mathTokens.length - targetCount) <= 1)) {
            return mathTokens;
        }

        // 6. Fallback split by capital letter boundaries
        const capitalizedPhrases = colStr
            .split(/(?<=[a-z0-9\)])\s+(?=[A-Z])/g)
            .map(s => cleanItem(s))
            .filter(s => s && !/^(?:with|Column|List|I|II|A|B|1|2)$/i.test(s));
        if (capitalizedPhrases.length >= 2) return capitalizedPhrases;

        return [];
    };

    const leftItems = extractItems(rawCol1, true);
    const rightItems = extractItems(rawCol2, false, leftItems.length);

    if (leftItems.length >= 2 && rightItems.length >= 2) {
        const maxLen = Math.max(leftItems.length, rightItems.length);
        const pairs = [];
        for (let i = 0; i < maxLen; i++) {
            pairs.push({
                left: leftItems[i] || '',
                right: rightItems[i] || ''
            });
        }
        return {
            introText: introText || 'Match Column I with Column II:',
            pairs
        };
    }

    return { introText: txt, pairs: [] };
}

/** Parse statement-based questions from text */
function parseStatementsFromText(q) {
    if (Array.isArray(q.statements) && q.statements.length > 0) {
        return { 
            introText: cleanQuestionText(q.questionText || q.question || ''), 
            statements: q.statements.map((s, idx) => ({ label: `Statement ${idx + 1}`, text: cleanStatementText(typeof s === 'object' ? (s.text || s.statement || '') : s) })),
            outroText: '' 
        };
    }
    const rawTxt = cleanQuestionText(q.questionText || q.question || '');
    if (!rawTxt) return { introText: '', statements: [], outroText: '' };

    // Common outro phrases at the end of statement questions
    const outroPattern = /(?:In the light of the above statements|Choose the correct (?:answer|option|statement)|Select the (?:correct|incorrect) (?:statement|statements|option)|Which of the (?:above )?statements? (?:is|are) (?:correct|incorrect|true|false)|How many (?:of the above )?statements? are (?:correct|incorrect|true|false))\??[\s\S]*$/i;
    let outroText = '';
    let bodyTxt = rawTxt;
    const outroMatch = rawTxt.match(outroPattern);
    if (outroMatch && outroMatch.index > 15) {
        outroText = outroMatch[0].trim();
        bodyTxt = rawTxt.substring(0, outroMatch.index).trim();
    }

    // Pattern A: Statement I: ... Statement II: ... or Statement 1: ... Statement 2: ...
    const stmtRegex = /Statement\s*([I|V|X|0-9|A-D]+)\s*[:\-]?\s*([\s\S]*?)(?=Statement\s*[I|V|X|0-9|A-D]+\s*[:\-]|$)/gi;
    let matches = [];
    let m;
    let firstIdx = -1;
    while ((m = stmtRegex.exec(bodyTxt)) !== null) {
        if (firstIdx === -1) firstIdx = m.index;
        matches.push({
            label: `Statement ${m[1]}:`,
            text: cleanStatementText(m[2])
        });
    }
    if (matches.length >= 2) {
        const introText = bodyTxt.substring(0, firstIdx).trim();
        return { introText, statements: matches, outroText };
    }

    // Pattern B: Lettered statements: A. ... B. ... C. ... D. ... or (A) ... (B) ... (C) ... (D) ...
    // e.g. "Consider an ideal transformer. A. It operates... B. Vs/Vp=... C. ... D. ... E. ... F. ..."
    const letterRegex = /(?:^|\s)(?:\(([A-Ha-h])\)|([A-Ha-h])[\.:])\s+([\s\S]*?)(?=(?:\s(?:\([A-Ha-h]\)|[A-Ha-h][\.:])\s+)|$)/g;
    let letterMatches = [];
    let lMatch;
    let firstLetterIdx = -1;
    while ((lMatch = letterRegex.exec(bodyTxt)) !== null) {
        if (firstLetterIdx === -1) firstLetterIdx = lMatch.index;
        const letter = (lMatch[1] || lMatch[2] || '').toUpperCase();
        const text = cleanStatementText(lMatch[3]);
        if (text) {
            letterMatches.push({
                label: `(${letter})`,
                text
            });
        }
    }
    if (letterMatches.length >= 2) {
        const isSequential = letterMatches[0].label.includes('A') && letterMatches[1].label.includes('B');
        if (isSequential) {
            const introText = bodyTxt.substring(0, firstLetterIdx).trim();
            return { introText, statements: letterMatches, outroText };
        }
    }

    // Pattern C: Roman numerals: (i) ... (ii) ... (iii) ... (iv) ... or I. ... II. ... III. ...
    const romanRegex = /(?:^|\s)(?:\(([ivx]+)\)|([ivx]+)[\.:])\s+([\s\S]*?)(?=(?:\s(?:\([ivx]+\)|[ivx]+[\.:])\s+)|$)/gi;
    let romanMatches = [];
    let rMatch;
    let firstRomanIdx = -1;
    while ((rMatch = romanRegex.exec(bodyTxt)) !== null) {
        if (firstRomanIdx === -1) firstRomanIdx = rMatch.index;
        const roman = (rMatch[1] || rMatch[2] || '').toLowerCase();
        const text = cleanStatementText(rMatch[3]);
        if (text) {
            romanMatches.push({
                label: `(${roman})`,
                text
            });
        }
    }
    if (romanMatches.length >= 2) {
        const introText = bodyTxt.substring(0, firstRomanIdx).trim();
        return { introText, statements: romanMatches, outroText };
    }

    return { introText: rawTxt, statements: [], outroText: '' };
}

/**
 * Match the Following Body
 */
function BodyMatchFollowing({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { introText, pairs: parsedPairs } = parseMatchFromText(q);
    const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) ? q.matchPairs : parsedPairs;
    const opts = q.options || [];
    const rawQText = cleanQuestionText(pairs.length > 0 ? (introText || '') : (q.questionText || q.question || ''));
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    const romanLabels = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
    const hasRomanOpts = opts.some(o => /[\-\s\(](?:i|ii|iii|iv|v|vi)\b/i.test(typeof o === 'object' ? (o.text || '') : String(o)));

    const avgLeftLen = pairs.reduce((acc, p) => acc + (p.left || '').length, 0) / (pairs.length || 1);
    const avgRightLen = pairs.reduce((acc, p) => acc + (p.right || '').length, 0) / (pairs.length || 1);
    const leftWidth = avgLeftLen > avgRightLen * 1.8 ? '62%' : (avgRightLen > avgLeftLen * 1.8 ? '38%' : '50%');
    const rightWidth = leftWidth === '62%' ? '38%' : (leftWidth === '38%' ? '62%' : '50%');

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '4px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={qText.endsWith(':') || qText.endsWith('.') ? qText : `${qText}:`}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {pairs.length > 0 && (
                <table style={Q.matchTable}>
                    <thead>
                        <tr>
                            <th style={{ ...Q.matchTh, width: leftWidth }}>Column I</th>
                            <th style={{ ...Q.matchTh, width: rightWidth }}>Column II</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pairs.map((pair, pi) => (
                            <tr key={pi}>
                                <td style={{ ...Q.matchTd, width: leftWidth }}>
                                    <strong style={{ marginRight: '6px', color: '#001f6d' }}>({String.fromCharCode(65 + pi)})</strong>
                                    <MathRenderer inline text={pair.left || ''} />
                                </td>
                                <td style={{ ...Q.matchTd, width: rightWidth }}>
                                    <strong style={{ marginRight: '6px', color: '#001f6d' }}>({hasRomanOpts ? (romanLabels[pi] || (pi + 1)) : (pi + 1)})</strong>
                                    <MathRenderer inline text={pair.right || ''} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, isTwoCol)}>
                    {opts.map((opt, i) => {
                        const labels = getQuestionOptionLabels(q);
                        return (
                            <div key={i} style={Q.optRow}>
                                <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                                <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                    <MathRenderer inline text={cleanOptionText(typeof opt === 'object' ? (opt.text || opt.option || '') : opt)} />
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

/**
 * Statement-Based Body
 */
function BodyStatementBased({ q, classes, isTwoCol, diagramMaxHeight = '180px', onDiagramResize, displayNum }) {
    const { introText, statements: parsedStmts, outroText } = parseStatementsFromText(q);
    const statements = (Array.isArray(q.statements) && q.statements.length > 0) 
        ? q.statements.map((s, idx) => ({ label: `Statement ${idx + 1}:`, text: typeof s === 'object' ? (s.text || '') : String(s) }))
        : parsedStmts;
    const opts = q.options || [];
    const rawQText = cleanQuestionText(statements.length > 0 ? (introText || '') : (q.questionText || q.question || ''));
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const labels = getQuestionOptionLabels(q);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <>
            {qText && (
                <div style={{ ...Q.qTextBold, marginBottom: '2px', display: 'block' }}>
                    <MathRenderer
                        inline
                        text={qText}
                        questionId={qId}
                        customDiagramSizes={q.customDiagramSizes}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                    />
                </div>
            )}
            {statements.length > 0 && (
                <div style={{ margin: '3px 0 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {statements.map((stmt, si) => (
                        <div key={si} style={{ lineHeight: '1.42', fontWeight: 400, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <strong style={{ color: '#000', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {stmt.label || `(${String.fromCharCode(65 + si)})`}
                            </strong>
                            <span style={{ flex: 1, minWidth: 0 }}>
                                <MathRenderer inline text={stmt.text || (typeof stmt === 'string' ? stmt : '')} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {outroText && (
                <div style={{ ...Q.qTextBold, marginTop: '2px', marginBottom: '3px', display: 'block' }}>
                    <MathRenderer inline text={outroText} />
                </div>
            )}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '2px auto 4px', clear: 'both' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt="Diagram"
                        questionId={qId}
                        diagramKey="main"
                        initialHeight={currentDiagramHeight}
                        isManual={isMainManual}
                        onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key || 'main') : undefined}
                        maxWidth="100%"
                    />
                </div>
            )}
            {opts.length > 0 && (
                <div style={getDynamicOptGrid(opts, isTwoCol)}>
                    {opts.map((opt, i) => (
                        <div key={i} style={Q.optRow}>
                            <span style={Q.optLbl}>({labels[i] || optionLabel(i, classes)})</span>
                            <span style={{ flex: 1, minWidth: 0, maxWidth: '100%', fontWeight: 400 }}>
                                <MathRenderer inline text={cleanOptionText(typeof opt === 'object' ? (opt.text || opt.option || '') : opt)} />
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

/**
 * Main QuestionBlock Component
 */
/**
 * SECTION B / NUMERICAL / INTEGER VALUE QUESTION RENDERER
 * Strictly adheres to JEE Main / Advanced standards:
 * - NO (A), (B), (C), (D) choices rendered.
 * - Renders question text, LaTeX equations, diagrams.
 * - Renders a clean standardized numerical answer blank / box.
 */
function BodyNumerical({
    q,
    classes = [],
    isTwoCol = false,
    diagramMaxHeight = 120,
    onDiagramResize,
    displayNum,
}) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <div style={{ width: '100%' }}>
            {/* Question Text */}
            <div style={{ lineHeight: '1.45', marginBottom: '6px' }}>
                <MathRenderer
                    inline
                    text={qText}
                    questionId={qId}
                    customDiagramSizes={q.customDiagramSizes}
                    onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                />
            </div>

            {/* Optional Diagram */}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '4px auto 6px' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt={`Question ${displayNum} diagram`}
                        height={currentDiagramHeight}
                        isManual={isMainManual}
                        onResize={(newH) => onDiagramResize && onDiagramResize(qId, newH, 'main')}
                    />
                </div>
            )}

            {/* Numerical Answer Entry Box (JEE Standard) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    padding: '3px 8px',
                    border: '1px dashed #94a3b8',
                    borderRadius: '4px',
                    width: 'fit-content',
                    backgroundColor: '#f8fafc',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#1e293b'
                }}
            >
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: '#001f6d' }}>
                    Answer:
                </span>
                <span
                    style={{
                        display: 'inline-block',
                        minWidth: '70px',
                        height: '18px',
                        backgroundColor: '#ffffff',
                        borderRadius: '2px',
                        border: '1px solid #cbd5e1',
                        borderBottom: '1.5px solid #001f6d',
                        padding: '0 6px',
                    }}
                />
            </div>
        </div>
    );
}

export default function QuestionBlock({
    q,
    displayNum = 1,
    classes = [],
    showMarks = false,
    singleColMode = false,
    isTwoCol = false,
    fontSize = '13px',
    lineHeight = '1.45',
    formatMarks,
    extraStyle = {},
    diagramMaxHeight = '180px',
    onDiagramResize,
}) {
    if (!q) return null;

    const activeFontSize = q.fontSize || fontSize;
    const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
    const qTextRaw = q.questionText || q.question || '';
    const effectiveIsTwoCol = Boolean(isTwoCol);

    const matchData = parseMatchFromText(q);
    const hasMatchPairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) || (matchData.pairs && matchData.pairs.length >= 2);
    const isMatch = qType.includes('MATCH') || hasMatchPairs;

    const isAssertion = qType.includes('ASSERTION') || (/Assertion\s*(?:\(A\))?/i.test(qTextRaw) && /Reason\s*(?:\(R\))?/i.test(qTextRaw));

    const stmtData = parseStatementsFromText(q);
    const hasStatements = (Array.isArray(q.statements) && q.statements.length > 0) || (stmtData.statements && stmtData.statements.length >= 2);
    const isStatement = qType.includes('STATEMENT') || hasStatements;

    const isNumerical = qType.includes('NUMERICAL') ||
                        qType.includes('INTEGER') ||
                        qType === 'NUM' ||
                        Boolean(q.isNumerical) ||
                        (q.part && q.part.toUpperCase().includes('NUMERICAL')) ||
                        (q.part && q.part.toUpperCase().includes('SECTION-B') && (!q.options || q.options.length === 0)) ||
                        (q.sectionName && q.sectionName.toUpperCase().includes('SECTION B') && (!q.options || q.options.length === 0)) ||
                        (q.num_answer !== undefined && q.num_answer !== null && q.num_answer !== '');

    const renderBody = () => {
        if (isAssertion) {
            return (
                <BodyAssertionReason
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isMatch && hasMatchPairs) {
            return (
                <BodyMatchFollowing
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isStatement && hasStatements) {
            return (
                <BodyStatementBased
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        if (isNumerical) {
            return (
                <BodyNumerical
                    q={q}
                    classes={classes}
                    isTwoCol={effectiveIsTwoCol}
                    diagramMaxHeight={diagramMaxHeight}
                    onDiagramResize={onDiagramResize}
                    displayNum={displayNum}
                />
            );
        }
        // Default MCQ & Diagram-Based
        return (
            <BodyMCQ
                q={q}
                classes={classes}
                isTwoCol={effectiveIsTwoCol}
                diagramMaxHeight={diagramMaxHeight}
                onDiagramResize={onDiagramResize}
                displayNum={displayNum}
            />
        );
    };

    return (
        <div style={{ ...Q.wrap, fontSize: activeFontSize, lineHeight, ...extraStyle }} className="question-block">
            <div style={Q.row}>
                <span style={Q.num}>{displayNum}.</span>
                <div style={Q.body}>{renderBody()}</div>
                {showMarks && formatMarks && (
                    <span style={Q.marks}>[{formatMarks(q.type, classes)}]</span>
                )}
            </div>
        </div>
    );
}
