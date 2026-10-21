const fs = require('fs');
const path = require('path');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    Header,
    Footer,
    PageNumber,
    NumberFormat,
    HorizontalPositionRelativeFrom,
    HorizontalPositionAlign,
    VerticalPositionRelativeFrom,
    VerticalPositionAlign,
    TextWrappingType
} = require('docx');

const NO_BORDERS = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const NO_CELL_BORDERS = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const MATCH_TABLE_BORDERS = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '001F6D' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
};

const MATCH_CELL_BORDERS = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' }
};

/**
 * Converts LaTeX math notation to clean, genuine Unicode characters for Microsoft Word.
 * Each character is 100% editable in Word. No raw LaTeX commands or $ delimiters appear.
 */
function latexToEditableText(latex) {
    if (!latex) return '';
    let s = String(latex);

    // 0. Auto-repair broken LaTeX fractions e.g. \sigma}2\epsilon_0 -> \frac{\sigma}{2\epsilon_0}
    s = repairBrokenLatexFraction(s);

    // 0b. Remove leaked internal prompt/reference artifacts e.g. "Reference case R_{2}4."
    s = s.replace(/\s*Reference\s+case\s+R_?\{?[0-9a-zA-Z_\s]+\}?[0-9a-zA-Z_\s]*\.?/gi, '')
         .replace(/\s*Reference\s+case\b[^\.\n]*\.?/gi, '');

    // 1. Text inside math first
    s = s.replace(/\\text\{([^{}]+)\}/g, '$1')
         .replace(/\\mathrm\{([^{}]+)\}/g, '$1')
         .replace(/\\mathbf\{([^{}]+)\}/g, '$1')
         .replace(/\\mathit\{([^{}]+)\}/g, '$1')
         .replace(/\\ce\{([^{}]+)\}/g, '$1');

    // 2. Fractions: \frac{a}{b} -> (a / b)
    while (/\\frac\{([^{}]+)\}\{([^{}]+)\}/.test(s)) {
        s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1 / $2)');
    }
    s = s.replace(/\\frac\s+([a-zA-Z0-9])\s+([a-zA-Z0-9])/g, '($1 / $2)');

    // 3. Square roots
    s = s.replace(/\\sqrt\[(.*?)\]\{(.*?)\}/g, '√[$1]($2)')
         .replace(/\\sqrt\{(.*?)\}/g, '√($1)')
         .replace(/\\sqrt\s*([a-zA-Z0-9])/g, '√$1');

    // 4. Greek letters
    const greek = {
        alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
        theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
        pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ',
        psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ',
        Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
    };
    for (const [cmd, sym] of Object.entries(greek)) {
        s = s.replace(new RegExp('\\\\' + cmd + '\\b', 'g'), sym);
    }

    // 5. Common math symbols & operators
    s = s.replace(/\\times\b/g, '×')
         .replace(/\\pm\b/g, '±')
         .replace(/\\mp\b/g, '∓')
         .replace(/\\div\b/g, '÷')
         .replace(/\\cdot\b/g, '·')
         .replace(/\\leq\b/g, '≤')
         .replace(/\\geq\b/g, '≥')
         .replace(/\\neq\b/g, '≠')
         .replace(/\\approx\b/g, '≈')
         .replace(/\\equiv\b/g, '≡')
         .replace(/\\infty\b/g, '∞')
         .replace(/\\propto\b/g, '∝')
         .replace(/\\rightarrow\b|\\to\b/g, '→')
         .replace(/\\leftarrow\b/g, '←')
         .replace(/\\Rightarrow\b/g, '⇒')
         .replace(/\\leftrightarrow\b/g, '↔')
         .replace(/\\in\b/g, '∈')
         .replace(/\\notin\b/g, '∉')
         .replace(/\\subset\b/g, '⊂')
         .replace(/\\supset\b/g, '⊃')
         .replace(/\\cap\b/g, '∩')
         .replace(/\\cup\b/g, '∪')
         .replace(/\\int\b/g, '∫')
         .replace(/\\sum\b/g, '∑')
         .replace(/\\angle\b/g, '∠')
         .replace(/\\circ\b|\^\\circ\b|\^\{\\circ\}/g, '°')
         .replace(/\\degree\b/g, '°');

    // 6. Trigonometric and functions (remove backslash)
    s = s.replace(/\\(sin|cos|tan|cot|sec|cosec|csc|log|ln|lim|exp|det)\b/g, '$1');

    // 7. Superscripts
    const superMap = { '0':'⁰', '1':'¹', '2':'²', '3':'³', '4':'⁴', '5':'⁵', '6':'⁶', '7':'⁷', '8':'⁸', '9':'⁹', '+':'⁺', '-':'⁻', '=':'⁼', '(':'⁽', ')':'⁾', 'n':'ⁿ', 'i':'ⁱ', 'x':'ˣ' };
    s = s.replace(/\^\{([0-9\+\-nix]+)\}/g, (_, p1) => p1.split('').map(c => superMap[c] || c).join(''));
    s = s.replace(/\^([0-9])/g, (_, p1) => superMap[p1] || p1);

    // 8. Subscripts
    const subMap = { '0':'₀', '1':'₁', '2':'₂', '3':'₃', '4':'₄', '5':'₅', '6':'₆', '7':'₇', '8':'₈', '9':'₉', '+':'₊', '-':'₋', '=':'₌', '(':'₍', ')':'₎', 'a':'ₐ', 'e':'ₑ', 'o':'ₒ', 'x':'ₓ', 'i':'ᵢ', 'j':'ⱼ', 'k':'ₖ', 'm':'ₘ', 'n':'ₙ', 'p':'ₚ', 'r':'ᵣ', 's':'ₛ', 't':'ₜ', 'u':'ᵤ', 'v':'ᵥ' };
    s = s.replace(/_\{([0-9\+\-aeoxijkmnprstuv]+)\}/g, (_, p1) => p1.split('').map(c => subMap[c] || c).join(''));
    s = s.replace(/_([0-9a-zA-Z])/g, (_, p1) => subMap[p1] || p1);

    // 9. Clean spacing and leftover braces/delimiters
    s = s.replace(/\\,/g, ' ')
         .replace(/\\;/g, ' ')
         .replace(/\\:/g, ' ')
         .replace(/\\!/g, '')
         .replace(/\\quad/g, '   ')
         .replace(/\\qquad/g, '      ')
         .replace(/\\left|\\right/g, '')
         .replace(/[\{\}]/g, '')
         .replace(/\$/g, '')
         .replace(/\\\(|\\\)|\\\[|\\\]/g, '');

    return s.trim();
}

/**
 * Clean question text - strips metadata, leaked codes, and raw image URLs
 */
function cleanQuestionText(text) {
    if (!text || typeof text !== 'string') return '';
    let str = text;

    // Decode HTML entities
    str = str.replace(/&#x27;/g, "'")
             .replace(/&#39;/g, "'")
             .replace(/&quot;/g, '"')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&nbsp;/g, ' ');

    // Strip raw diagram markers (since diagrams are extracted and rendered as images)
    str = str.replace(/(?:IMG::|{{IMG::)\s*https?:\/\/[^\s}]+(?:\}\})?/gi, '');
    str = str.replace(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi, '');
    str = str.replace(/<img[^>]+>/gi, '');
    str = str.replace(/<span\s+class=["']katex-error["'][^>]*>[\s\S]*?<\/span>/gi, '');

    str = str.replace(/^(\s*(?:Q\.?\s*)?\d+[\.\)\-:]\s*)+/i, '');
    str = str.replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '');
    str = str.replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '');
    str = str.replace(/\s*Reference\s+case\s+R_?\{?[0-9a-zA-Z_\s]+\}?[0-9a-zA-Z_\s]*\.?/gi, '');
    str = str.replace(/\s*Reference\s+case\b[^\.\n]*\.?/gi, '');
    str = str.replace(/\s*\[\s*(?:JEE|NEET|CET|AIPMT|CBSE|KCET|BITSAT|AIIMS|MHT-?CET|IIT|ADVANCED|MAIN)[\s\w\-,\(\)]*\d{4}\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*\d+\s*(?:Marks?|M)?\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*[A-Za-z]{1,5}\s*[-.]?\s*\d{1,5}\s*\]\s*$/i, '');
    str = str.replace(/\s*\[\s*[A-Za-z0-9_\-]{2,8}\s*\]\s*$/i, '');

    return str.trim();
}

/**
 * Extract diagram URL from question object
 */
function extractDiagramFromQuestion(q) {
    if (!q) return null;
    let diagramUrl = q.imageUrl || q.image_url || q.diagramUrl || q.diagram || null;
    const rawText = q.questionText || q.question || q.text || '';

    const prefixMatch = rawText.match(/(?:IMG::|{{IMG::)\s*(https?:\/\/[^\s}]+)/i);
    if (prefixMatch && !diagramUrl) diagramUrl = prefixMatch[1];

    const mdMatch = rawText.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
    if (mdMatch && !diagramUrl) diagramUrl = mdMatch[1];

    const htmlMatch = rawText.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/i);
    if (htmlMatch && !diagramUrl) diagramUrl = htmlMatch[1];

    return diagramUrl;
}

/**
 * Extract image URL from an individual option string
 */
function extractOptionImageUrl(opt) {
    const str = typeof opt === 'object' ? (opt.text || opt.optionText || opt.option || '') : String(opt || '');
    const prefixMatch = str.match(/(?:IMG::|{{IMG::)\s*(https?:\/\/[^\s}]+)/i);
    if (prefixMatch) return prefixMatch[1];
    const mdMatch = str.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
    if (mdMatch) return mdMatch[1];
    const urlMatch = str.match(/(https?:\/\/[^\s]+(?:\.jpg|\.png|\.jpeg|\.webp))/i);
    if (urlMatch) return urlMatch[1];
    return null;
}

/**
 * Auto-repair broken LaTeX fractions missing \frac{ prefix (e.g. \sigma}2\epsilon_0 -> \frac{\sigma}{2\epsilon_0})
 */
function repairBrokenLatexFraction(str) {
    if (!str) return '';
    return str.replace(/(?:^|\s)(?:\\([a-zA-Z]+)|([a-zA-Z0-9]+))\}(?:\{([^}]+)\}|([^\s}]+))/g, (m, sym, plain, denomBrace, denomPlain) => {
        const num = sym ? `\\${sym}` : plain;
        const den = denomBrace || denomPlain;
        return ` \\frac{${num}}{${den}}`;
    });
}

/**
 * Robust Match the Following parser
 */
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
        return String(s)
            .replace(/^[:\-]\s*/, '')
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

// In-memory cache for fetched image buffers
const imageBufferCache = new Map();

/**
 * Fetch image buffer from URL or local file
 */
async function fetchImageBuffer(url) {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim().replace(/^['"]|['"]$/g, '');
    if (imageBufferCache.has(cleanUrl)) return imageBufferCache.get(cleanUrl);

    try {
        if (cleanUrl.startsWith('data:')) {
            const base64Data = cleanUrl.split(',')[1];
            if (base64Data) {
                const buf = Buffer.from(base64Data, 'base64');
                imageBufferCache.set(cleanUrl, buf);
                return buf;
            }
        }
        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
            const res = await fetch(cleanUrl);
            if (res.ok) {
                const arrayBuf = await res.arrayBuffer();
                const buf = Buffer.from(arrayBuf);
                imageBufferCache.set(cleanUrl, buf);
                return buf;
            }
        }
        if (fs.existsSync(cleanUrl)) {
            const buf = fs.readFileSync(cleanUrl);
            imageBufferCache.set(cleanUrl, buf);
            return buf;
        }
    } catch (e) {
        console.warn('Could not fetch image for Word export:', cleanUrl, e.message);
    }
    return null;
}

/**
 * Convert text into array of TextRuns with editable math
 */
function textToRuns(rawText, options = {}) {
    if (!rawText) return [];
    const cleaned = cleanQuestionText(rawText);
    if (!cleaned) return [];

    const converted = latexToEditableText(cleaned);
    const lines = converted.split(/\r?\n|<br\s*\/?>/i);
    const runs = [];

    lines.forEach((line, lIdx) => {
        if (lIdx > 0) {
            runs.push(new TextRun({ text: '', break: 1 }));
        }
        runs.push(new TextRun({
            text: line,
            font: options.font || 'Calibri',
            size: options.size || 21, // 10.5pt
            bold: Boolean(options.bold),
            italics: Boolean(options.italics),
            color: options.color || '1e293b'
        }));
    });

    return runs;
}

/**
 * Read local logo file buffer
 */
function getLocalLogoBuffer() {
    const candidates = [
        path.resolve('server/public/SapthagiriLogo.jpg'),
        path.resolve('client/public/SapthagiriLogo.jpg'),
        path.resolve('../client/public/SapthagiriLogo.jpg'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                return fs.readFileSync(p);
            } catch (e) {
                console.warn('Error reading logo from', p, e.message);
            }
        }
    }
    return null;
}

/**
 * Read washed-out watermark file buffer (7% opacity grayscale PNG)
 */
function getLocalWatermarkBuffer() {
    const candidates = [
        path.resolve('server/public/watermark_faded.png'),
        path.resolve('client/public/watermark_faded.png'),
        path.resolve('../server/public/watermark_faded.png'),
        path.resolve('../client/public/watermark_faded.png'),
        path.resolve('server/public/SapthagiriLogo.jpg'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            try {
                return fs.readFileSync(p);
            } catch (e) {
                console.warn('Error reading watermark from', p, e.message);
            }
        }
    }
    return null;
}

/**
 * Generate full Word document (.docx)
 */
async function generatePaperDoc(paper, template = null) {
    const docChildren = [];
    let questions = Array.isArray(paper.questions) ? paper.questions : [];
    if (questions.length === 0 && Array.isArray(paper.sections)) {
        questions = paper.sections.flatMap(sec => {
            const secName = sec.name || sec.title || '';
            const secSub = sec.subject || '';
            return (sec.questions || []).map(q => ({
                ...q,
                sectionName: q.sectionName || secName,
                sectionSubject: q.sectionSubject || secSub || q.subject
            }));
        });
    }

    // ── 1. HEADER SECTION MATCHING PDF ──
    const logoBuf = getLocalLogoBuffer();
    const instName = "SAPTHAGIRI PRE-UNIVERSITY COLLEGE";
    const instAddr = "DAVANAGERE • THE LAND OF OPPORTUNITY";
    const examTitle = paper.title || `${paper.exam_type || paper.examType || 'EXAMINATION'}`;

    const headerCells = [];
    if (logoBuf) {
        headerCells.push(
            new TableCell({
                width: { size: 15, type: WidthType.PERCENTAGE },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new ImageRun({
                                data: logoBuf,
                                transformation: { width: 55, height: 55 }
                            })
                        ]
                    })
                ],
                borders: NO_CELL_BORDERS
            })
        );
    }

    headerCells.push(
        new TableCell({
            width: { size: logoBuf ? 70 : 85, type: WidthType.PERCENTAGE },
            children: [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: instName, bold: true, size: 28, font: 'Calibri', color: '001f6d' })],
                    spacing: { after: 40 }
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: instAddr, bold: true, size: 18, font: 'Calibri', color: '475569' })],
                    spacing: { after: 60 }
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: examTitle.toUpperCase(), bold: true, size: 22, font: 'Calibri', color: '001f6d' })],
                    spacing: { after: 40 }
                })
            ],
            borders: NO_CELL_BORDERS
        })
    );

    headerCells.push(
        new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [
                new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                        new TextRun({
                            text: `SET ${paper.setName || 'P'}`,
                            bold: true,
                            size: 24,
                            font: 'Calibri',
                            color: '001f6d'
                        })
                    ]
                })
            ],
            borders: NO_CELL_BORDERS
        })
    );

    docChildren.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            rows: [new TableRow({ children: headerCells })]
        })
    );

    // ── 2. METADATA STRIP TABLE (Matching PDF) ──
    const subText = paper.subject || 'All Subjects';
    const classText = Array.isArray(paper.classes) ? paper.classes.join(', ') : (paper.classes || '12');
    const durText = paper.duration || '180 Minutes';
    const maxMarksText = paper.headerConfig?.maxMarks || (paper.exam_type?.includes('JEE') ? '100' : '180');

    const metaBorders = {
        top: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 },
        bottom: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    };

    docChildren.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `Subject: ${subText}`, bold: true, font: 'Calibri', size: 19 })] })],
                            borders: metaBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Class: ${classText}`, bold: true, font: 'Calibri', size: 19 })] })],
                            borders: metaBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Time: ${durText}`, bold: true, font: 'Calibri', size: 19 })] })],
                            borders: metaBorders
                        }),
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Max Marks: ${maxMarksText}`, bold: true, font: 'Calibri', size: 19, color: '001f6d' })] })],
                            borders: metaBorders
                        })
                    ]
                })
            ]
        })
    );

    // ── 3. GENERAL INSTRUCTIONS ──
    const examTypeStr = String(paper.examType || paper.exam_type || '').toUpperCase();
    const isJEE = examTypeStr.includes('JEE');

    const instructionText = isJEE
        ? "1. All questions are compulsory. Total 25 questions (100 Marks).  2. Section A contains 20 Multiple Choice Questions (+4 for correct, -1 for incorrect).  3. Section B contains 5 Numerical Value Questions (+4 for correct, 0 for unattempted). No options are provided.  4. Use of calculators or electronic devices is strictly prohibited."
        : "1. All questions are compulsory.  2. Each question carries marks as indicated.  3. For multiple choice questions, only one option is correct.  4. Use of calculators or electronic devices is strictly prohibited.";

    docChildren.push(new Paragraph({ text: '', spacing: { after: 60 } }));
    docChildren.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: "GENERAL INSTRUCTIONS: ",
                    bold: true,
                    size: 18,
                    font: 'Calibri',
                    color: '001f6d'
                }),
                new TextRun({
                    text: instructionText,
                    font: 'Calibri',
                    size: 18,
                    color: '334155'
                })
            ],
            spacing: { after: 140 }
        })
    );

    // ── 4. QUESTIONS WITH SECTIONS, NUMERICALS, AND TABLES ──
    let prevPartKey = null;
    let prevSubject = null;
    const startQNo = Number(paper.startQNo) || 1;

    for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const displayNum = startQNo + idx;

        const curSubject = q.sectionSubject || q.subject || '';
        const isSubjectChange = Boolean(curSubject && prevSubject && curSubject.toLowerCase() !== prevSubject.toLowerCase());

        if (isSubjectChange) {
            prevSubject = curSubject;
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `SUBJECT: ${curSubject.toUpperCase()}`,
                            bold: true,
                            size: 24,
                            font: 'Calibri',
                            color: '001f6d',
                            underline: {}
                        })
                    ],
                    spacing: { before: 240, after: 80 }
                })
            );
        } else if (idx === 0) {
            prevSubject = curSubject;
        }

        const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
        const isNumerical = qType.includes('NUMERICAL') || qType.includes('INTEGER') || qType === 'NUM' ||
                            Boolean(q.isNumerical) ||
                            (q.part && q.part.toUpperCase().includes('NUMERICAL')) ||
                            (q.part && q.part.toUpperCase().includes('SECTION-B') && (!q.options || q.options.length === 0));

        // In JEE: Show SECTION A (20 Qs) and SECTION B (5 Numericals)
        if (isJEE) {
            const currentPartKey = isNumerical ? 'SECTION B (NUMERICAL VALUE QUESTIONS)' : 'SECTION A (MULTIPLE CHOICE QUESTIONS)';
            const isNewPart = Boolean(currentPartKey !== prevPartKey);
            if (isNewPart) {
                prevPartKey = currentPartKey;
                const directiveText = isNumerical
                    ? 'This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE. No options are provided.'
                    : 'This section contains 20 Multiple Choice Questions. Each question has four choices (A), (B), (C), (D). Only one choice is correct.';

                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: currentPartKey,
                                bold: true,
                                size: 22,
                                font: 'Calibri',
                                color: '001f6d',
                                underline: {}
                            })
                        ],
                        spacing: { before: 200, after: 60 }
                    })
                );
                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: directiveText,
                                italics: true,
                                font: 'Calibri',
                                size: 19,
                                color: '475569'
                            })
                        ],
                        spacing: { after: 120 }
                    })
                );
            }
        }
        // Note: For non-JEE, NO artificial section headers! Questions flow continuously.

        const rawQText = q.questionText || q.question || q.text || '';
        const diagramUrl = extractDiagramFromQuestion(q);
        const diagramBuf = diagramUrl ? await fetchImageBuffer(diagramUrl) : null;

        // Check if options are images
        const opts = Array.isArray(q.options) ? q.options : [];
        const optionImageUrls = opts.map(o => extractOptionImageUrl(o));
        const hasOptionImages = optionImageUrls.some(Boolean);
        const optionImageBuffers = hasOptionImages ? await Promise.all(optionImageUrls.map(u => fetchImageBuffer(u))) : [];

        const labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];

        // ── Detect Match the Following Questions ──
        const matchData = parseMatchFromText(q);
        const hasMatchPairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) || (matchData.pairs && matchData.pairs.length >= 2);

        // When question is Match the Following, only use the clean intro statement for the title
        let statementText = rawQText;
        if (hasMatchPairs) {
            const introStr = (matchData.introText || 'Match Column I with Column II').trim();
            statementText = (introStr.endsWith(':') || introStr.endsWith('.')) ? introStr : `${introStr}:`;
        }

        const qRuns = textToRuns(statementText, { bold: false, size: 21 });

        // Build question statement paragraph
        const questionStatementParagraph = new Paragraph({
            children: [
                new TextRun({ text: `${displayNum}. `, bold: true, font: 'Calibri', size: 21, color: '001f6d' }),
                ...qRuns
            ],
            spacing: { before: 100, after: 50 }
        });

        // Build Match Table if applicable
        let matchDocxTable = null;
        if (hasMatchPairs) {
            const pairs = (Array.isArray(q.matchPairs) && q.matchPairs.length > 0) ? q.matchPairs : matchData.pairs;
            const avgLeft = pairs.reduce((acc, p) => acc + (p.left || '').length, 0) / (pairs.length || 1);
            const avgRight = pairs.reduce((acc, p) => acc + (p.right || '').length, 0) / (pairs.length || 1);
            const leftPct = avgLeft > avgRight * 1.8 ? 62 : (avgRight > avgLeft * 1.8 ? 38 : 50);
            const rightPct = 100 - leftPct;

            const romanLabels = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'];
            const hasRomanOpts = opts.some(o => /[\-\s\(](?:i|ii|iii|iv|v|vi)\b/i.test(typeof o === 'object' ? (o.text || '') : String(o)));

            const tableRows = [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: leftPct, type: WidthType.PERCENTAGE },
                            borders: MATCH_CELL_BORDERS,
                            children: [new Paragraph({ children: [new TextRun({ text: "Column I", bold: true, font: 'Calibri', size: 20, color: '001f6d' })] })]
                        }),
                        new TableCell({
                            width: { size: rightPct, type: WidthType.PERCENTAGE },
                            borders: MATCH_CELL_BORDERS,
                            children: [new Paragraph({ children: [new TextRun({ text: "Column II", bold: true, font: 'Calibri', size: 20, color: '001f6d' })] })]
                        })
                    ]
                })
            ];

            pairs.forEach((pair, pi) => {
                const rightLbl = hasRomanOpts ? (romanLabels[pi] || `${pi + 1}`) : `${pi + 1}`;
                tableRows.push(
                    new TableRow({
                        children: [
                            new TableCell({
                                width: { size: leftPct, type: WidthType.PERCENTAGE },
                                borders: MATCH_CELL_BORDERS,
                                children: [
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: `(${String.fromCharCode(65 + pi)}) `, bold: true, font: 'Calibri', size: 20, color: '001f6d' }),
                                            ...textToRuns(pair.left || '', { font: 'Calibri', size: 20 })
                                        ],
                                        spacing: { before: 20, after: 20 }
                                    })
                                ]
                            }),
                            new TableCell({
                                width: { size: rightPct, type: WidthType.PERCENTAGE },
                                borders: MATCH_CELL_BORDERS,
                                children: [
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: `(${rightLbl}) `, bold: true, font: 'Calibri', size: 20, color: '001f6d' }),
                                            ...textToRuns(pair.right || '', { font: 'Calibri', size: 20 })
                                        ],
                                        spacing: { before: 20, after: 20 }
                                    })
                                ]
                            })
                        ]
                    })
                );
            });

            matchDocxTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: MATCH_TABLE_BORDERS,
                rows: tableRows
            });
        }

        if (diagramBuf) {
            // SIDE-BY-SIDE LAYOUT (Matching PDF Question 1 & 2):
            // Left Cell: Question text + (Match Table) + Options
            // Right Cell: Centered diagram
            const leftChildren = [questionStatementParagraph];
            if (matchDocxTable) {
                leftChildren.push(matchDocxTable);
            }

            if (isNumerical) {
                leftChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Answer: [ ", bold: true, font: 'Calibri', size: 20, color: '001f6d' }),
                            new TextRun({ text: "____________________", bold: true, font: 'Calibri', size: 20, color: '64748b' }),
                            new TextRun({ text: " ]", bold: true, font: 'Calibri', size: 20, color: '001f6d' }),
                        ],
                        spacing: { before: 60, after: 100 }
                    })
                );
            } else if (opts.length > 0) {
                const optRunsList = opts.map(o => {
                    const str = typeof o === 'object' ? (o.text || o.optionText || o.option || '') : String(o || '');
                    return textToRuns(str, { font: 'Calibri', size: 20 });
                });

                opts.forEach((_, optIdx) => {
                    leftChildren.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: `${labels[optIdx] || `(${optIdx + 1})`} `, bold: true, size: 20 }),
                                ...optRunsList[optIdx]
                            ],
                            spacing: { after: 30 }
                        })
                    );
                });
            }

            docChildren.push(
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: NO_BORDERS,
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 62, type: WidthType.PERCENTAGE },
                                    children: leftChildren,
                                    borders: NO_CELL_BORDERS
                                }),
                                new TableCell({
                                    width: { size: 38, type: WidthType.PERCENTAGE },
                                    children: [
                                        new Paragraph({
                                            alignment: AlignmentType.CENTER,
                                            children: [
                                                new ImageRun({
                                                    data: diagramBuf,
                                                    transformation: { width: 195, height: 135 }
                                                })
                                            ]
                                        })
                                    ],
                                    borders: NO_CELL_BORDERS
                                })
                            ]
                        })
                    ]
                })
            );
        } else {
            // STANDARD LAYOUT (No main diagram):
            docChildren.push(questionStatementParagraph);
            if (matchDocxTable) {
                docChildren.push(matchDocxTable);
            }

            if (isNumerical) {
                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: "Answer: [ ", bold: true, font: 'Calibri', size: 20, color: '001f6d' }),
                            new TextRun({ text: "____________________", bold: true, font: 'Calibri', size: 20, color: '64748b' }),
                            new TextRun({ text: " ]", bold: true, font: 'Calibri', size: 20, color: '001f6d' }),
                        ],
                        spacing: { before: 60, after: 120 }
                    })
                );
            } else if (hasOptionImages && opts.length === 4) {
                // 4 OPTION DIAGRAMS IN A ROW (Matching PDF Question 3):
                const optCells = opts.map((_, optIdx) => {
                    const buf = optionImageBuffers[optIdx];
                    return new TableCell({
                        width: { size: 25, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [
                                    new TextRun({ text: `${labels[optIdx]} `, bold: true, size: 20 }),
                                    ...(buf ? [
                                        new ImageRun({
                                            data: buf,
                                            transformation: { width: 95, height: 60 }
                                        })
                                    ] : textToRuns(String(opts[optIdx] || ''), { font: 'Calibri', size: 20 }))
                                ]
                            })
                        ],
                        borders: NO_CELL_BORDERS
                    });
                });

                docChildren.push(
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: NO_BORDERS,
                        rows: [new TableRow({ children: optCells })]
                    })
                );
            } else if (opts.length > 0) {
                const optRunsList = opts.map(o => {
                    const str = typeof o === 'object' ? (o.text || o.optionText || o.option || '') : String(o || '');
                    return textToRuns(str, { font: 'Calibri', size: 20 });
                });

                // Short text options or match options: 2x2 borderless grid
                const totalTextLength = opts.reduce((acc, o) => acc + String(typeof o === 'object' ? (o.text || '') : o).length, 0);
                if (opts.length === 4 && totalTextLength <= 110) {
                    docChildren.push(
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            borders: NO_BORDERS,
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[0]} `, bold: true, size: 20 }), ...optRunsList[0]] })],
                                            borders: NO_CELL_BORDERS
                                        }),
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[1]} `, bold: true, size: 20 }), ...optRunsList[1]] })],
                                            borders: NO_CELL_BORDERS
                                        })
                                    ]
                                }),
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[2]} `, bold: true, size: 20 }), ...optRunsList[2]] })],
                                            borders: NO_CELL_BORDERS
                                        }),
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[3]} `, bold: true, size: 20 }), ...optRunsList[3]] })],
                                            borders: NO_CELL_BORDERS
                                        })
                                    ]
                                })
                            ]
                        })
                    );
                } else {
                    opts.forEach((_, optIdx) => {
                        docChildren.push(
                            new Paragraph({
                                children: [
                                    new TextRun({ text: `${labels[optIdx] || `(${optIdx + 1})`} `, bold: true, size: 20 }),
                                    ...optRunsList[optIdx]
                                ],
                                spacing: { after: 30 }
                            })
                        );
                    });
                }
            }
        }
    }

    // ── 5. ASSEMBLE DOCUMENT WITH FAINT WATERMARK AND PAGE NUMBERS ──
    const watermarkBuf = getLocalWatermarkBuffer();

    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 720,    // 0.5 in
                        right: 720,
                        bottom: 720,
                        left: 720
                    }
                }
            },
            headers: {
                default: new Header({
                    children: [
                        ...(watermarkBuf ? [
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: watermarkBuf,
                                        transformation: { width: 340, height: 340 },
                                        floating: {
                                            horizontalPosition: {
                                                relative: HorizontalPositionRelativeFrom.PAGE,
                                                align: HorizontalPositionAlign.CENTER,
                                            },
                                            verticalPosition: {
                                                relative: VerticalPositionRelativeFrom.PAGE,
                                                align: VerticalPositionAlign.CENTER,
                                            },
                                            wrap: {
                                                type: TextWrappingType.NONE,
                                            }
                                        }
                                    })
                                ]
                            })
                        ] : []),
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({
                                    text: "SAPTHAGIRI PU COLLEGE • DAVANAGERE",
                                    size: 16,
                                    font: 'Calibri',
                                    color: '94a3b8',
                                    italics: true
                                })
                            ]
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "Page ", size: 16, font: 'Calibri', color: '94a3b8' }),
                                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Calibri', color: '94a3b8' }),
                                new TextRun({ text: " of ", size: 16, font: 'Calibri', color: '94a3b8' }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Calibri', color: '94a3b8' })
                            ]
                        })
                    ]
                })
            },
            children: docChildren
        }]
    });

    return await Packer.toBuffer(doc);
}

module.exports = {
    generatePaperDoc,
    latexToEditableText,
    cleanQuestionText
};
