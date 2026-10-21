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
    NumberFormat
} = require('docx');

/**
 * Converts LaTeX math notation to clean, genuine Unicode characters for Microsoft Word.
 * Each character is 100% editable in Word. No raw LaTeX commands or $ delimiters appear.
 */
function latexToEditableText(latex) {
    if (!latex) return '';
    let s = String(latex);

    // 0. Remove leaked internal prompt/reference artifacts e.g. "Reference case R_{2}4."
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
 * Clean question text
 */
function cleanQuestionText(text) {
    if (!text || typeof text !== 'string') return '';
    let str = text;
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
 * Convert question text to an array of TextRuns with editable math.
 */
function textToRuns(rawText, options = {}) {
    if (!rawText) return [];
    const cleaned = cleanQuestionText(rawText);
    if (!cleaned) return [];

    // Convert LaTeX math segments into editable unicode text
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
 * Generate full Word document (.docx)
 */
async function generatePaperDoc(paper, template = null) {
    const docChildren = [];
    const questions = Array.isArray(paper.questions) ? paper.questions : [];

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
                borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
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
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
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
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
        })
    );

    docChildren.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [new TableRow({ children: headerCells })]
        })
    );

    // ── 2. METADATA STRIP TABLE (Matching PDF) ──
    const subText = paper.subject || 'All Subjects';
    const classText = Array.isArray(paper.classes) ? paper.classes.join(', ') : (paper.classes || '12');
    const durText = paper.duration || '180 Minutes';
    const maxMarksText = paper.headerConfig?.maxMarks || (paper.exam_type?.includes('JEE') ? '100' : '180');

    docChildren.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `Subject: ${subText}`, bold: true, font: 'Calibri', size: 19 })] })],
                            borders: { top: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, bottom: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        }),
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Class: ${classText}`, bold: true, font: 'Calibri', size: 19 })] })],
                            borders: { top: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, bottom: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        }),
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Time: ${durText}`, bold: true, font: 'Calibri', size: 19 })] })],
                            borders: { top: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, bottom: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        }),
                        new TableCell({
                            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Max Marks: ${maxMarksText}`, bold: true, font: 'Calibri', size: 19, color: '001f6d' })] })],
                            borders: { top: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, bottom: { style: BorderStyle.SINGLE, color: '001f6d', size: 12 }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        })
                    ]
                })
            ]
        })
    );

    // ── 3. GENERAL INSTRUCTIONS ──
    docChildren.push(new Paragraph({ text: '', spacing: { after: 80 } }));
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
                    text: "1. The question paper contains Sections as prescribed by the examination format.  2. For Section A (MCQs), only one option is correct.  3. For Section B (Numericals), the answer is a numerical value without choices.  4. Use of calculators or electronic devices is strictly prohibited.",
                    font: 'Calibri',
                    size: 18,
                    color: '334155'
                })
            ],
            spacing: { after: 180 }
        })
    );

    // ── 4. QUESTIONS WITH SECTIONS, NUMERICALS, AND TABLES ──
    let prevPartKey = null;
    const startQNo = Number(paper.startQNo) || 1;

    for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const displayNum = startQNo + idx;

        const currentPartKey = q.part || (q.sectionName && !q.sectionName.includes('Section 1') ? q.sectionName : null);
        const isNewPart = Boolean(currentPartKey && currentPartKey !== prevPartKey);

        if (isNewPart) {
            prevPartKey = currentPartKey;
            const directiveText = paper?.partDirectives?.[currentPartKey] || q.partDirective || null;

            // Section Header Bar in Word
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: currentPartKey.toUpperCase(),
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

            if (directiveText) {
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

        const qType = (q.type || q.q_type || 'MCQ').toUpperCase();
        const isNumerical = qType.includes('NUMERICAL') || qType.includes('INTEGER') || qType === 'NUM' ||
                            Boolean(q.isNumerical) ||
                            (q.part && q.part.toUpperCase().includes('NUMERICAL')) ||
                            (q.part && q.part.toUpperCase().includes('SECTION-B') && (!q.options || q.options.length === 0));

        const rawQText = q.questionText || q.question || '';

        // Question Statement Paragraph
        const qRuns = textToRuns(rawQText, { bold: false, size: 21 });
        docChildren.push(
            new Paragraph({
                children: [
                    new TextRun({ text: `${displayNum}. `, bold: true, font: 'Calibri', size: 21, color: '001f6d' }),
                    ...qRuns
                ],
                spacing: { before: 120, after: 60 }
            })
        );

        // Handle Question Types
        if (isNumerical) {
            // NUMERICAL QUESTION: NO OPTIONS, CLEAN ANSWER RESPONSE BLANK
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
        } else {
            // MCQ / AR / STATEMENT / MATCH OPTIONS
            const opts = Array.isArray(q.options) ? q.options : [];
            if (opts.length > 0) {
                const labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];

                // Render options in 2x2 table or stacked rows
                const optRunsList = opts.map(o => {
                    const str = typeof o === 'object' ? (o.text || o.optionText || o.option || '') : String(o);
                    return textToRuns(str, { font: 'Calibri', size: 20 });
                });

                if (opts.length === 4) {
                    // 2x2 Grid table for clean alignment
                    docChildren.push(
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            rows: [
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[0]} `, bold: true, size: 20 }), ...optRunsList[0]] })],
                                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                                        }),
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[1]} `, bold: true, size: 20 }), ...optRunsList[1]] })],
                                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                                        })
                                    ]
                                }),
                                new TableRow({
                                    children: [
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[2]} `, bold: true, size: 20 }), ...optRunsList[2]] })],
                                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                                        }),
                                        new TableCell({
                                            width: { size: 50, type: WidthType.PERCENTAGE },
                                            children: [new Paragraph({ children: [new TextRun({ text: `${labels[3]} `, bold: true, size: 20 }), ...optRunsList[3]] })],
                                            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
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
                                spacing: { after: 40 }
                            })
                        );
                    });
                }
            }
        }
    }

    // ── 5. ASSEMBLE DOCUMENT WITH WATERMARK AND PAGE NUMBERS ──
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
