const { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx');
const { getMathPng } = require('../utils/mathToImage');
async function getLogoBuffer(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err) {
        console.error('Failed to download logo:', err.message);
        return null;
    }
}

function cleanDifficultyTags(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\[(?:QPV_|QBP_)?DIFFICULTY:\s*[^\]]+\]/gi, '')
        .replace(/\[(?:QPV|QBP)_[A-Za-z0-9_]+:[^\]]*\]/gi, '')
        .trim();
}

/**
 * Split a string by mathematical delimiters and return an array of Runs.
 * LaTeX blocks ($$, $, \[, \() are rendered as PNGs using Puppeteer.
 */
async function textToRuns(rawText) {
    if (!rawText) return [];
    const text = cleanDifficultyTags(rawText);
    if (!text) return [];
    
    // Match inline and block LaTeX segments
    const MATH_REGEX = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;
    const parts = text.split(MATH_REGEX);
    const runs = [];
    
    for (const part of parts) {
        if (!part) continue;
        
        const isBlock = part.startsWith('$$') || part.startsWith('\\[');
        const isInline = part.startsWith('$') || part.startsWith('\\(');
        
        if (isBlock || isInline) {
            let mathContent = part;
            if (part.startsWith('$$') && part.endsWith('$$')) {
                mathContent = part.substring(2, part.length - 2);
            } else if (part.startsWith('$') && part.endsWith('$')) {
                mathContent = part.substring(1, part.length - 1);
            } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
                mathContent = part.substring(2, part.length - 2);
            } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
                mathContent = part.substring(2, part.length - 2);
            }
            mathContent = mathContent.trim();
            
            // Try to compile formula to image
            const imgData = await getMathPng(mathContent, isBlock);
            if (imgData) {
                // Scale math expressions nicely
                // docx transformation needs width/height in px
                const scale = isBlock ? 0.65 : 0.75;
                runs.push(new ImageRun({
                    data: imgData.buffer,
                    transformation: {
                        width: imgData.width * scale,
                        height: imgData.height * scale
                    }
                }));
            } else {
                // Fallback to text run
                runs.push(new TextRun({ text: part, font: 'Calibri' }));
            }
        } else {
            // Plain text
            let cleanText = part
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/?[^>]+(>|$)/g, ""); // Strip other html tags
                
            const lines = cleanText.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (i > 0) {
                    runs.push(new TextRun({ text: '', break: 1 }));
                }
                runs.push(new TextRun({
                    text: lines[i],
                    font: 'Calibri'
                }));
            }
        }
    }
    return runs;
}

/**
 * Format options for Word
 */
async function makeOptionsElement(options) {
    if (!options || options.length === 0) return [];
    
    // Estimate clean text length of options (ignoring LaTeX commands for a better text length estimation)
    const cleanLengths = options.map(opt => {
        const cleanText = (opt || '')
            .replace(/\\(text|mathrm|ce|begin|end){[^}]*}/g, '')
            .replace(/\$\$?[^$]+\$\$?/g, '')
            .replace(/[{}$_^[\]]/g, '')
            .trim();
        return cleanText.length;
    });
    
    const maxLength = Math.max(...cleanLengths);
    const totalLength = cleanLengths.reduce((a, b) => a + b, 0);
    const labels = ['A', 'B', 'C', 'D', 'E'];
    
    if (options.length === 4) {
        const cellA = new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'A) ', bold: true }), ...(await textToRuns(options[0]))] })],
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
        });
        const cellB = new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'B) ', bold: true }), ...(await textToRuns(options[1]))] })],
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
        });
        const cellC = new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'C) ', bold: true }), ...(await textToRuns(options[2]))] })],
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
        });
        const cellD = new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'D) ', bold: true }), ...(await textToRuns(options[3]))] })],
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
        });

        // 1. If very short, fit all 4 side-by-side in a single row
        if (maxLength <= 15 && totalLength <= 60) {
            return [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [cellA, cellB, cellC, cellD] })
                    ]
                }),
                new Paragraph({ text: '', spacing: { after: 120 } })
            ];
        }
        
        // 2. If moderately short, fit 2x2 grid (A B / C D)
        if (maxLength <= 35 && totalLength <= 110) {
            return [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [cellA, cellB] }),
                        new TableRow({ children: [cellC, cellD] })
                    ]
                }),
                new Paragraph({ text: '', spacing: { after: 120 } })
            ];
        }
    }

    // 3. Otherwise (or if not exactly 4 options), render one paragraph per option
    const paragraphs = [];
    for (let i = 0; i < options.length; i++) {
        paragraphs.push(new Paragraph({
            children: [
                new TextRun({ text: `${labels[i]}) `, bold: true }),
                ...(await textToRuns(options[i]))
            ],
            spacing: { after: 80 }
        }));
    }
    paragraphs.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    return paragraphs;
}

/**
 * Generate a Word document for a Question Paper
 */
async function generatePaperDoc(paper, template = null) {
    const docChildren = [];
    
    // 1. Logo Asset
    if (template && template.fileUrl) {
        const logoBuffer = await getLogoBuffer(template.fileUrl);
        if (logoBuffer) {
            docChildren.push(
                new Paragraph({
                    children: [
                        new ImageRun({
                            data: logoBuffer,
                            transformation: { width: 100, height: 100 }
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 120 }
                })
            );
        }
    }
    
    // 2. Institution Details
    const instName = template?.institutionName || "MANCHESTER TECHNOLOGIES COLLEGE";
    const instAddr = template?.address || "";
    const headerTitle = template?.headerText || paper.title;
    
    docChildren.push(
        new Paragraph({
            children: [new TextRun({ text: instName, bold: true, size: 32, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 }
        })
    );
    if (instAddr) {
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: instAddr, font: 'Calibri', size: 20, color: '555555' })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 }
            })
        );
    }
    docChildren.push(
        new Paragraph({
            children: [new TextRun({ text: headerTitle, bold: true, size: 24, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
        })
    );
    
    // 3. Metadata Table
    docChildren.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `Subject: ${paper.subject}`, bold: true, font: 'Calibri' })] })],
                            borders: { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `Class: ${paper.classes?.join(', ') || 'General'}`, bold: true, font: 'Calibri' })], alignment: AlignmentType.CENTER })],
                            borders: { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: `Marks: ${paper.pattern?.reduce((s, p) => s + (p.marks || 0), 0) || 'N/A'} Marks`, bold: true, font: 'Calibri' })], alignment: AlignmentType.RIGHT })],
                            borders: { top: { style: BorderStyle.SINGLE }, bottom: { style: BorderStyle.SINGLE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                        })
                    ]
                })
            ]
        })
    );
    docChildren.push(new Paragraph({ text: '', spacing: { after: 200 } }));
    
    // 4. Instructions
    const instructionsList = template?.instructions 
        ? template.instructions.split('\n') 
        : ["1. Read all questions carefully.", "2. Attempt all sections."];
        
    docChildren.push(
        new Paragraph({
            children: [new TextRun({ text: "GENERAL INSTRUCTIONS:", bold: true, size: 20, font: 'Calibri' })],
            spacing: { after: 120 }
        })
    );
    for (const inst of instructionsList) {
        if (!inst.trim()) continue;
        docChildren.push(
            new Paragraph({
                children: [new TextRun({ text: inst.trim(), font: 'Calibri', size: 18 })],
                spacing: { after: 80 }
            })
        );
    }
    docChildren.push(new Paragraph({ text: '', spacing: { after: 300 } }));
    
    // 5. Render Sections & Questions
    let globalQIdx = 1;
    const questions = paper.questions || [];
    
    if (paper.pattern && paper.pattern.length > 0) {
        // Render sections according to pattern
        let currentOffset = 0;
        for (const sec of paper.pattern) {
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${sec.sectionName.toUpperCase()} - ${sec.type || 'MCQ'}`, bold: true, size: 22, font: 'Calibri', underline: {} })
                    ],
                    spacing: { before: 200, after: 120 }
                })
            );
            if (sec.description) {
                docChildren.push(
                    new Paragraph({
                        children: [new TextRun({ text: sec.description, italic: true, font: 'Calibri', size: 18 })],
                        spacing: { after: 120 }
                    })
                );
            }
            
            const numSecQuestions = sec.numQuestions || 0;
            const secQuestions = questions.slice(currentOffset, currentOffset + numSecQuestions);
            currentOffset += numSecQuestions;
            
            for (let sIdx = 0; sIdx < secQuestions.length; sIdx++) {
                const q = secQuestions[sIdx];
                const qNum = globalQIdx++;
                
                // Question Text
                const qRuns = await textToRuns(q.questionText);
                docChildren.push(
                    new Paragraph({
                        children: [
                            new TextRun({ text: `${qNum}. `, bold: true, font: 'Calibri' }),
                            ...qRuns
                        ],
                        spacing: { before: 120, after: 120 }
                    })
                );
                
                // Options (if MCQ)
                if (q.type === 'MCQ' && q.options && q.options.length > 0) {
                    const optElements = await makeOptionsElement(q.options);
                    docChildren.push(...optElements);
                }
            }
        }
    } else {
        // Flat layout
        for (let idx = 0; idx < questions.length; idx++) {
            const q = questions[idx];
            const qNum = idx + 1;
            
            const qRuns = await textToRuns(q.questionText);
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: `${qNum}. `, bold: true, font: 'Calibri' }),
                        ...qRuns
                    ],
                    spacing: { before: 120, after: 120 }
                })
            );
            
            if (q.type === 'MCQ' && q.options && q.options.length > 0) {
                const optElements = await makeOptionsElement(q.options);
                docChildren.push(...optElements);
            }
        }
    }
    
    // 6. Create Document Section
    const doc = new Document({
        sections: [{
            properties: {},
            children: docChildren
        }]
    });
    
    return Packer.toBuffer(doc);
}

module.exports = {
    generatePaperDoc
};
