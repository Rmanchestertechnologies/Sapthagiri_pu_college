import React from 'react';
import { Q } from './layout.js';

export function cleanStatementText(str) {
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
export function parseAssertionReason(q) {
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

export function cleanQuestionText(text, q = null) {
    if (!text) return '';
    let str = String(text);
    // Auto-repair corrupted OCR unit tokens e.g. 1 fracA} -> 1 A, fracHz,} -> Hz,
    str = str.replace(/([0-9\.\s]+)frac([A-Za-z]+)\}/g, '$1 $2');
    str = str.replace(/\\?frac\s*([A-Za-z]+)\}/g, ' $1');
    str = str.replace(/\\?frac\s*([A-Za-z]+),?\}/g, ' $1,');


    // Auto-fix broken OCR expressions like "sin fracx/cos x" -> "\sin \frac{x}{\cos x}"
    str = str.replace(/sin\s*frac\s*([a-zA-Z0-9]+)\s*\/\s*cos\s*([a-zA-Z0-9]+)/gi, '$\\sin \\left(\\frac{$1}{\\cos $2}\\right)$');
    str = str.replace(/\\?sqrt\s*\(\s*1\s*([+-])\s*sin\s*frac\s*([a-zA-Z0-9]+)\s*\/\s*cos\s*([a-zA-Z0-9]+)\s*\)/gi, '$\\sqrt{1 $1 \\sin\\left(\\frac{$2}{\\cos $3}\\right)}$');

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

    // 5. Strip trailing isolated newline numbers like "\n1" or "\n 2"
    str = str.replace(/(?:\r?\n)\s*\d{1,2}\s*$/i, '');

    // 6. Clean first line if it matches topic/concept name
    if (q) {
        const topicName = String(q.topic || q.concept || '').trim();
        if (topicName && topicName.length > 2) {
            const firstLineBreak = str.indexOf('\n');
            const firstLine = firstLineBreak >= 0 ? str.slice(0, firstLineBreak).trim() : str.trim();
            if (firstLine.toLowerCase() === topicName.toLowerCase() || firstLine.toLowerCase() === ('concept: ' + topicName.toLowerCase())) {
                str = firstLineBreak >= 0 ? str.slice(firstLineBreak + 1).trim() : '';
            }
        }
    }

    return str.trim();
}

/**
 * Extracts any embedded diagrams from raw question text (e.g. {{IMG::url}} or ![...](url)),
 * repairs any split words caused by inline image markers (e.g. "plo {{IMG}} s" -> "plots"),
 * and returns clean text plus the extracted diagram URL.
 */
export function extractDiagramFromText(rawText, existingImageUrl) {
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

/** Helper to merge sentence continuation lines in match column lists */
export function mergeContinuationItems(items) {
    if (!Array.isArray(items) || items.length <= 1) return items || [];
    const isColumnSubheader = (s) => /^[\(\[]?\s*(?:elements|properties|compounds|reagents|reactants|quantities|units|column\s*[i|1|2|a|b]|list\s*[i|1|2|a|b])\s*[\)\]]?$/i.test(String(s || '').trim());
    const filtered = items.filter(item => item && !isColumnSubheader(item));
    if (filtered.length <= 1) return filtered;
    const merged = [];
    const contPhrases = ['approximate increase', 'approximate decrease', 'percentage increase', 'percentage decrease', 'rate of increase', 'rate of decrease'];
    for (let i = 0; i < filtered.length; i++) {
        const item = String(filtered[i] || '').trim();
        const lower = item.toLowerCase();
        const isCont = contPhrases.some(p => lower.startsWith(p));
        if (merged.length > 0 && isCont) {
            merged[merged.length - 1] += ' ' + item;
        } else {
            merged.push(item);
        }
    }
    return merged;
}

/** Parse match the following from text when matchPairs array is empty */
export function parseMatchFromText(q) {
    let rawText = q.questionText || q.question || '';
    if (!rawText) return { introText: '', pairs: [] };

    // 0. If matchPairs already provided in question object
    if (Array.isArray(q.matchPairs) && q.matchPairs.length >= 2) {
        let leftItems = q.matchPairs.map(p => p.left || '').filter(Boolean);
        let rightItems = q.matchPairs.map(p => p.right || '').filter(Boolean);
        leftItems = mergeContinuationItems(leftItems);
        rightItems = mergeContinuationItems(rightItems);
        const maxL = Math.max(leftItems.length, rightItems.length);
        const pairs = [];
        for (let i = 0; i < maxL; i++) {
            pairs.push({
                left: leftItems[i] || '',
                right: rightItems[i] || ''
            });
        }
        let intro = cleanQuestionText(rawText)
            .replace(/(?:\*\*|\b)(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[\s\S]*$/i, '')
            .trim();
        return {
            introText: intro || 'Match Column I with Column II:',
            pairs
        };
    }
    if (Array.isArray(q.column_a) && q.column_a.length >= 2 && Array.isArray(q.column_b) && q.column_b.length >= 2) {
        const leftItems = mergeContinuationItems(q.column_a);
        const rightItems = mergeContinuationItems(q.column_b);
        const maxL = Math.max(leftItems.length, rightItems.length);
        const pairs = [];
        for (let i = 0; i < maxL; i++) {
            pairs.push({
                left: leftItems[i] || '',
                right: rightItems[i] || ''
            });
        }
        let intro = cleanQuestionText(rawText)
            .replace(/(?:\*\*|\b)(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[\s\S]*$/i, '')
            .trim();
        return {
            introText: intro || 'Match Column I with Column II:',
            pairs
        };
    }

    let txt = cleanQuestionText(rawText);
    if (!txt) return { introText: '', pairs: [] };

    // 1. Identify and extract introductory sentence BEFORE the actual column tables
    let introText = '';
    // Case A: "Match ... Column I ... with ... Column II."
    const introSentenceMatch = txt.match(/^([\s\S]*?Match\s+[^\n\.\:]*?\b(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[^\n\.\:]*?\bwith\b[^\n\.\:]*?\b(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b[^\n]*?[\.\:\n])/i);
    if (introSentenceMatch) {
        introText = introSentenceMatch[1].trim();
        txt = txt.substring(introSentenceMatch[0].length).trim();
    } else {
        // Case B: "Match the following:" or "Match the work function with its value in joule."
        const genericIntro = txt.match(/^([\s\S]*?Match\s+[^\n\.\:]*?[\.\:\n])/i);
        if (genericIntro && genericIntro[1].length < 150) {
            introText = genericIntro[1].trim();
            txt = txt.substring(genericIntro[0].length).trim();
        }
    }

    // Clean up bold asterisks around headers e.g. **Column I** -> Column I
    txt = txt.replace(/\*\*(Column|List)\s*[-:]?\s*(I|II|1|2|A|B)\*\*/gi, '$1 $2');

    // 2. Locate the Column I and Column II headers
    const col1HeaderRegex = /(?:\b)(?:Column|List)\s*[-:]?\s*(?:I|1|A)\b[:\-\s]*/i;
    const col2HeaderRegex = /(?:\b)(?:Column|List)\s*[-:]?\s*(?:II|2|B)\b[:\-\s]*/i;

    const col1Match = txt.match(col1HeaderRegex);
    const col2Match = txt.match(col2HeaderRegex);

    if (!col1Match || !col2Match || col1Match.index >= col2Match.index) {
        return { introText: introText || txt, pairs: [] };
    }

    if (!introText && col1Match.index > 0) {
        introText = txt.substring(0, col1Match.index).trim();
    }

    let rawCol1 = txt.substring(col1Match.index + col1Match[0].length, col2Match.index).trim();
    let rawCol2 = txt.substring(col2Match.index + col2Match[0].length).trim();

    // Strip trailing options/codes from rawCol2 if present
    const endMatch = rawCol2.match(/(?:Choose\s+the\s+correct|Select\s+the\s+correct|Options:?|\([a-d1-4]\)\s*[A-D]|\([A-D]\)\s*\(?[A-D0-9]|Codes\s*:?)/i);
    if (endMatch) {
        rawCol2 = rawCol2.substring(0, endMatch.index).trim();
    }
    // Also strip trailing leaked single-letter/roman option lists e.g. (iv), (ii)...
    rawCol2 = rawCol2.replace(/(?:\r?\n\s*\([a-d1-4ivx]+\)\s*)+$/gi, '').trim();
    rawCol2 = rawCol2.replace(/(?:\r?\n\s*(?:[a-d1-4ivx]|p|q|r|s)\s*[-–—:->\\]\s*\(?[a-d1-4ivx0-9]+\)?\s*)+$/gi, '').trim();

    // Auto-repair any broken fraction syntax in both columns
    rawCol1 = repairBrokenLatexFraction(rawCol1);
    rawCol2 = repairBrokenLatexFraction(rawCol2);

    const cleanItem = (s) => {
        if (!s) return '';
        return cleanStatementText(s)
            // a bracketed label "(A)" / "[2]" is always a label; a bare one ("A.", "1)", "p-") only when whitespace follows it,
            // otherwise "1.5 eV", "p-nitrophenol", "2-butene" would lose their first characters
            .replace(/^(?:[\(\[](?:[A-Ea-e1-8]|i{1,4}|iv|v|vi{0,3}|ix|x|[p-tP-T])[\)\]]|(?:[A-Ea-e1-8]|i{1,4}|iv|v|vi{0,3}|ix|x|[p-tP-T])[\)\.:\-](?=\s))\s*/, '')
            .replace(/^\*+\s*/, '')
            .replace(/\*+$/, '')
            // only a leftover header ("Column I", "List-II:") is removed: the old pattern also cut the first letter off items
            // such as "Acetic acid" (-> "cetic acid"), "Benzene" and "Iron"
            .replace(/^(?:with\s+)?(?:Column|List)\s*[-:]?\s*(?:II|I|1|2|A|B)\b[:\-\s]*/i, '')
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

        // 2. Newlines or HTML breaks (with smart sentence continuation merging)
        const isSubhead = (s) => /^[\(\[]?\s*(?:elements|properties|compounds|reagents|reactants|quantities|units|column\s*[i|1|2|a|b]|list\s*[i|1|2|a|b])\s*[\)\]]?$/i.test(String(s || '').trim());
        const rawLines = colStr
            .split(/\r?\n+|<br\s*\/?>/i)
            .map(s => cleanItem(s))
            .filter(s => s && !/^(?:with|Column|List|I|II|A|B|1|2)$/i.test(s) && !isSubhead(s));
        if (rawLines.length >= 2) {
            const mergedLines = [];
            const contPhrases = ['approximate increase', 'approximate decrease', 'percentage increase', 'percentage decrease', 'rate of increase', 'rate of decrease'];
            for (let i = 0; i < rawLines.length; i++) {
                const line = rawLines[i];
                const lower = line.toLowerCase();
                const isCont = contPhrases.some(p => lower.startsWith(p));
                if (mergedLines.length > 0 && isCont) {
                    mergedLines[mergedLines.length - 1] += ' ' + line;
                } else {
                    mergedLines.push(line);
                }
            }
            if (mergedLines.length >= 2) return mergedLines;
        }

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

    return { introText: introText || txt, pairs: [] };
}

/** Parse statement-based questions from text */
export function parseStatementsFromText(q) {
    const rawTxt = cleanQuestionText(q.questionText || q.question || '', q);
    const bodyTxt = (rawTxt || '').trim();

    // Check if q already has valid statements
    if (Array.isArray(q.statements) && q.statements.length > 0) {
        // Detect if any statement text in q.statements has internal embedded statements like "Statement-III:"
        const hasEmbeddedSubStatements = q.statements.some(s => {
            const txt = typeof s === 'object' ? (s.text || s.statement || '') : String(s);
            return /(?:^|\r?\n|\s{2,}|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?[IVXLCDM0-9A-D]+\)?)\s*[:.\-)–—]/i.test(txt);
        });

        if (!hasEmbeddedSubStatements) {
            // Intro text should ONLY be non-statement preamble before Statement I / Statement 1
            let introText = cleanQuestionText(q.questionText || q.question || '');
            if (/(?:^|\r?\n|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?I|\(?1|\(?A\)?)\s*[:.\-)–—]?/i.test(introText)) {
                introText = introText.replace(/(?:^|\r?\n|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?I|\(?1|\(?A\)?)\s*[:.\-)–—]?[\s\S]*$/i, '').trim();
            }
            // Outro text
            let outroText = q.outroText || '';
            const stmts = q.statements.map((s, idx) => ({ 
                label: (typeof s === 'object' && s.label) ? s.label : `Statement ${idx + 1}:`, 
                text: cleanStatementText(typeof s === 'object' ? (s.text || s.statement || '') : s) 
            }));
            if (!outroText && stmts.length > 0) {
                const last = stmts[stmts.length - 1];
                const outroLineMatch = last.text.match(/(?:\r?\n|\s{2,})?(?:In the light of|Choose the correct|Select the|Which of the|How many of|The (?:correct|incorrect) statement|From the above|Identify the|The (?:correct|incorrect) combination is)[\s\S]*$/i);
                if (outroLineMatch) {
                    outroText = outroLineMatch[0].trim();
                    last.text = last.text.substring(0, outroLineMatch.index).trim();
                }
            }
            return { introText, statements: stmts, outroText };
        }
    }

    if (!rawTxt) return { introText: '', statements: [], outroText: '' };

    // Pattern A: Statement I: ... Statement II: ... or Statement 1: ... or Statement-III: ...
    const stmtRegex = /(?:^|\r?\n|\s{2,}|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?([IVXLCDM0-9A-D]+)\)?)\s*[:.\-)–—]\s*([\s\S]*?)(?=(?:(?:\r?\n|\s{2,}|\b)\s*@?Statement\s*[-–—]?\s*(?:\(?[IVXLCDM0-9A-D]+\)?)\s*[:.\-)–—])|$)/gi;
    let matches = [];
    let m;
    let firstIdx = -1;
    let lastIdx = -1;
    while ((m = stmtRegex.exec(bodyTxt)) !== null) {
        if (firstIdx === -1) firstIdx = m.index;
        lastIdx = stmtRegex.lastIndex;
        matches.push({
            label: `Statement ${m[1]}:`,
            text: cleanStatementText(m[2])
        });
    }
    if (matches.length >= 2) {
        let outroText = q.outroText || bodyTxt.substring(lastIdx).trim();
        const lastStmt = matches[matches.length - 1];
        const outroLineMatch = lastStmt.text.match(/(?:\r?\n|\s{2,})?(?:In the light of|Choose the correct|Select the|Which of the|How many of|The (?:correct|incorrect) statement|From the above|Identify the|The (?:correct|incorrect) combination is)[\s\S]*$/i);
        if (outroLineMatch) {
            outroText = (outroLineMatch[0] + (outroText ? '\n' + outroText : '')).trim();
            lastStmt.text = lastStmt.text.substring(0, outroLineMatch.index).trim();
        }
        const introText = firstIdx > 0 ? bodyTxt.substring(0, firstIdx).trim() : '';
        return { introText, statements: matches, outroText };
    }

    // Pattern B: Lettered statements: A. ... B. ... or (A) ... (B) ... or A) ... B) ... or [A] ... [B] ...
    const letterRegex = /(?:^|\r?\n)\s*(?:\(([A-Ha-h])\)|\[([A-Ha-h])\]|([A-Ha-h])[\.:\)])\s*([\s\S]*?)(?=(?:\r?\n\s*(?:\([A-Ha-h]\)|\[[A-Ha-h]\]|[A-Ha-h][\.:\)])\s*)|$)/g;
    let letterMatches = [];
    let lMatch;
    let firstLetterIdx = -1;
    let lastLetterIdx = -1;
    while ((lMatch = letterRegex.exec(bodyTxt)) !== null) {
        if (firstLetterIdx === -1) firstLetterIdx = lMatch.index;
        lastLetterIdx = letterRegex.lastIndex;
        const letter = (lMatch[1] || lMatch[2] || lMatch[3] || '').toUpperCase();
        const t = cleanStatementText(lMatch[4]);
        if (t) {
            letterMatches.push({
                label: `(${letter})`,
                text: t
            });
        }
    }
    if (letterMatches.length >= 2) {
        const isSequential = letterMatches[0].label.includes('A') && letterMatches[1].label.includes('B');
        if (isSequential) {
            let outroText = bodyTxt.substring(lastLetterIdx).trim();
            const lastStmt = letterMatches[letterMatches.length - 1];
            const outroLineMatch = lastStmt.text.match(/(?:\r?\n)(?:In the light of|Choose the correct|Select the|Which of the|How many of|The (?:correct|incorrect) statement|From the above|Identify the)[\s\S]*$/i);
            if (outroLineMatch) {
                outroText = (outroLineMatch[0] + (outroText ? '\n' + outroText : '')).trim();
                lastStmt.text = lastStmt.text.substring(0, outroLineMatch.index).trim();
            }
            const introText = bodyTxt.substring(0, firstLetterIdx).trim();
            return { introText, statements: letterMatches, outroText };
        }
    }

    // Pattern C: Roman numerals: (i) ... (ii) ... or I. ... II. ... or i) ... or [i] ...
    const romanRegex = /(?:^|\r?\n)\s*(?:\(([ivx]+)\)|\[([ivx]+)\]|([ivx]+)[\.:\)])\s*([\s\S]*?)(?=(?:\r?\n\s*(?:\([ivx]+\)|\[[ivx]+\]|[ivx]+[\.:\)])\s*)|$)/gi;
    let romanMatches = [];
    let rMatch;
    let firstRomanIdx = -1;
    let lastRomanIdx = -1;
    while ((rMatch = romanRegex.exec(bodyTxt)) !== null) {
        if (firstRomanIdx === -1) firstRomanIdx = rMatch.index;
        lastRomanIdx = romanRegex.lastIndex;
        const roman = (rMatch[1] || rMatch[2] || rMatch[3] || '').toLowerCase();
        const t = cleanStatementText(rMatch[4]);
        if (t) {
            romanMatches.push({
                label: `(${roman})`,
                text: t
            });
        }
    }
    if (romanMatches.length >= 2) {
        let outroText = bodyTxt.substring(lastRomanIdx).trim();
        const lastStmt = romanMatches[romanMatches.length - 1];
        const outroLineMatch = lastStmt.text.match(/(?:\r?\n)(?:In the light of|Choose the correct|Select the|Which of the|How many of|The (?:correct|incorrect) statement|From the above|Identify the)[\s\S]*$/i);
        if (outroLineMatch) {
            outroText = (outroLineMatch[0] + (outroText ? '\n' + outroText : '')).trim();
            lastStmt.text = lastStmt.text.substring(0, outroLineMatch.index).trim();
        }
        const introText = bodyTxt.substring(0, firstRomanIdx).trim();
        return { introText, statements: romanMatches, outroText };
    }

    return { introText: rawTxt, statements: [], outroText: '' };
}
