const puppeteer = require('puppeteer');
const { preRenderMath, getCss } = require('../utils/latexPreRenderer');

let browserInstance = null;

async function getBrowser() {
    if (browserInstance && browserInstance.process() && browserInstance.process().signalCode === null) {
        return browserInstance;
    }
    browserInstance = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    return browserInstance;
}

/**
 * Generates an institutional A4 Question Paper PDF with pre-rendered KaTeX vector math.
 */
async function generatePaperPdf(paper, options = {}) {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const questions = paper.questions || [];
    const title = paper.title || 'Question Paper';
    const examType = paper.exam_type || paper.examType || 'JEE_PCM';
    const classes = paper.classes || ['12'];
    const duration = paper.duration || '180 Minutes';
    const totalMarks = paper.total_marks || (questions.length * 4);
    const instructions = paper.instructions || 'Read all questions carefully. Each question carries 4 marks. -1 mark for each incorrect response in single-correct MCQs.';
    const katexCss = getCss();

    // Group questions by section / subject
    const sections = Array.isArray(paper.sections) && paper.sections.length > 0 ? paper.sections : null;
    let renderedSectionsHtml = '';

    const isJEE = Boolean(String(examType || title || '').toUpperCase().includes('JEE'));

    if (sections && sections.length > 0) {
        let globalQIndex = 1;
        sections.forEach((sec, sIdx) => {
            let secQs = (sec.questionObjects && sec.questionObjects.length > 0) 
                ? sec.questionObjects 
                : questions.filter(q => (q.sectionSubject || q.subject || '').toLowerCase() === (sec.subject || '').toLowerCase());
            
            if (secQs.length === 0) return;

            if (isJEE) {
                const isNum = (q) => {
                    const t = (q.type || q.q_type || '').toUpperCase();
                    return Boolean(q.isNumerical) || t.includes('NUMERICAL') || t.includes('INTEGER') || t === 'NUM' ||
                           (q.part && q.part.toUpperCase().includes('NUMERICAL')) ||
                           (q.part && q.part.toUpperCase().includes('SECTION B')) ||
                           (q.part && q.part.toUpperCase().includes('SECTION-B'));
                };
                const secA = secQs.filter(q => !isNum(q)).slice(0, 20).map(q => ({ ...q, isNumerical: false }));
                const secB = secQs.filter(q => isNum(q)).slice(0, 5).map(q => ({ ...q, isNumerical: true, options: [] }));
                secQs = [...secA, ...secB];
            }

            renderedSectionsHtml += `
                <div class="paper-section-block">
                    <div class="section-banner">
                        <span class="sec-tag">SECTION ${sIdx + 1}</span>
                        <span class="sec-name">${sec.subject.toUpperCase()}</span>
                        <span class="sec-count">(${secQs.length} Questions)</span>
                    </div>
                    <div class="questions-grid">
            `;

            secQs.forEach((q, qSubIdx) => {
                const qNum = globalQIndex++;
                const isSectionB = isJEE && (qSubIdx >= 20 || q.isNumerical);
                const cleanQText = preRenderMath(q.questionText || q.question || '');
                const opts = (!isSectionB && Array.isArray(q.options) && q.options.length > 0) ? q.options : [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(Boolean);

                if (isJEE && qSubIdx === 20) {
                    renderedSectionsHtml += `
                        <div style="grid-column: 1 / -1; margin: 15px 0 8px 0; padding: 6px 12px; background: #f1f5f9; border-left: 4px solid #001f6d; font-weight: bold; font-size: 11pt; color: #001f6d;">
                            PART B (SECTION B - NUMERICAL VALUE QUESTIONS)
                            <div style="font-size: 9pt; font-weight: normal; color: #475569; font-style: italic;">This section contains 5 Numerical Value Questions. The answer to each question is a NUMERICAL VALUE.</div>
                        </div>
                    `;
                }

                renderedSectionsHtml += `
                    <div class="question-item">
                        <div class="q-header">
                            <span class="q-num">${qNum}.</span>
                            <div class="q-body">${cleanQText}</div>
                        </div>
                `;

                if (q.imageUrl || q.image_url) {
                    renderedSectionsHtml += `
                        <div class="q-img-wrap">
                            <img src="${q.imageUrl || q.image_url}" alt="Question Diagram" class="q-diagram" />
                        </div>
                    `;
                }

                if (isSectionB) {
                    renderedSectionsHtml += `
                        <div style="margin-top: 8px; font-weight: bold; color: #001f6d; font-size: 10pt;">
                            Answer: [ <span style="display: inline-block; width: 140px; border-bottom: 1.5px solid #64748b;"></span> ]
                        </div>
                    `;
                } else if (Array.isArray(opts) && opts.length > 0) {
                    renderedSectionsHtml += `<div class="options-container">`;
                    opts.forEach((opt, optIdx) => {
                        const optLabel = `(${optIdx + 1})`;
                        const cleanOptText = preRenderMath(String(opt));
                        renderedSectionsHtml += `
                            <div class="opt-item">
                                <span class="opt-label">${optLabel}</span>
                                <span class="opt-text">${cleanOptText}</span>
                            </div>
                        `;
                    });
                    renderedSectionsHtml += `</div>`;
                }

                renderedSectionsHtml += `</div>`;
            });

            renderedSectionsHtml += `</div></div>`;
        });
    } else {
        // Flat questions list
        renderedSectionsHtml += `<div class="questions-grid">`;
        questions.forEach((q, idx) => {
            const qNum = idx + (paper.startQNo || 1);
            const cleanQText = preRenderMath(q.questionText || q.question || '');
            const opts = q.options || [q.opt_a, q.opt_b, q.opt_c, q.opt_d].filter(Boolean);

            renderedSectionsHtml += `
                <div class="question-item">
                    <div class="q-header">
                        <span class="q-num">${qNum}.</span>
                        <div class="q-body">${cleanQText}</div>
                    </div>
            `;

            if (q.imageUrl || q.image_url) {
                renderedSectionsHtml += `
                    <div class="q-img-wrap">
                        <img src="${q.imageUrl || q.image_url}" alt="Question Diagram" class="q-diagram" />
                    </div>
                `;
            }

            if (Array.isArray(opts) && opts.length > 0) {
                renderedSectionsHtml += `<div class="options-container">`;
                opts.forEach((opt, optIdx) => {
                    const optLabel = `(${optIdx + 1})`;
                    const cleanOptText = preRenderMath(String(opt));
                    renderedSectionsHtml += `
                        <div class="opt-item">
                            <span class="opt-label">${optLabel}</span>
                            <span class="opt-text">${cleanOptText}</span>
                        </div>
                    `;
                });
                renderedSectionsHtml += `</div>`;
            }

            renderedSectionsHtml += `</div>`;
        });
        renderedSectionsHtml += `</div>`;
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <style>
                ${katexCss}
                
                @page {
                    size: A4 portrait;
                    margin: 12mm 10mm 14mm 10mm;
                    @bottom-right {
                        content: counter(page);
                        font-family: 'Times New Roman', serif;
                        font-size: 10px;
                    }
                }

                * {
                    box-sizing: border-box;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                body {
                    font-family: "Times New Roman", Times, serif;
                    font-size: 11pt;
                    line-height: 1.35;
                    color: #000;
                    margin: 0;
                    padding: 0;
                    background: #fff;
                }

                .header-wrapper {
                    text-align: center;
                    border-bottom: 2px solid #000;
                    padding-bottom: 6px;
                    margin-bottom: 12px;
                }

                .inst-name {
                    font-size: 16pt;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0;
                }

                .inst-sub {
                    font-size: 9.5pt;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin: 2px 0 6px 0;
                }

                .exam-title {
                    font-size: 13pt;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin: 4px 0;
                }

                .meta-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10pt;
                    font-weight: bold;
                    margin-top: 6px;
                    border-top: 1px solid #000;
                    padding-top: 4px;
                }

                .meta-table td {
                    padding: 2px 4px;
                }

                .instructions-box {
                    font-size: 8.5pt;
                    border: 1px solid #ccc;
                    padding: 4px 8px;
                    margin-bottom: 12px;
                    background: #fbfbfb;
                    font-style: italic;
                }

                .section-banner {
                    background: #001f6d;
                    color: #fff;
                    padding: 4px 10px;
                    font-weight: bold;
                    font-size: 10pt;
                    margin: 14px 0 8px 0;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    page-break-after: avoid;
                }

                .sec-tag {
                    background: #c5a059;
                    color: #001f6d;
                    padding: 1px 6px;
                    border-radius: 3px;
                    font-size: 8pt;
                    font-weight: 900;
                }

                .questions-grid {
                    column-count: 2;
                    column-gap: 16px;
                    column-rule: 0.5px solid #ddd;
                }

                .question-item {
                    break-inside: avoid;
                    page-break-inside: avoid;
                    margin-bottom: 12px;
                    padding-bottom: 6px;
                    border-bottom: 0.5px dotted #eee;
                    font-size: 10.5pt;
                }

                .q-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 4px;
                }

                .q-num {
                    font-weight: bold;
                    min-width: 18px;
                }

                .q-body {
                    flex: 1;
                }

                .q-img-wrap {
                    text-align: center;
                    margin: 6px 0;
                }

                .q-diagram {
                    max-width: 90%;
                    max-height: 140px;
                    object-fit: contain;
                }

                .options-container {
                    margin-top: 4px;
                    margin-left: 20px;
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 3px;
                }

                .opt-item {
                    display: flex;
                    align-items: baseline;
                    gap: 5px;
                    font-size: 10pt;
                }

                .opt-label {
                    font-weight: bold;
                    min-width: 18px;
                }

                .katex {
                    font-size: 1em !important;
                    text-rendering: auto !important;
                }

                .katex-display {
                    margin: 4px 0 !important;
                }
            </style>
        </head>
        <body>
            <div class="header-wrapper">
                <div class="inst-name">SAPTHAGIRI PRE-UNIVERSITY COLLEGE</div>
                <div class="inst-sub">DAVANAGERE • DEPARTMENT OF PRE-UNIVERSITY EDUCATION</div>
                <div class="exam-title">${title} (${examType.replace('_', ' ')})</div>
                <table class="meta-table">
                    <tr>
                        <td style="text-align: left;">Class: PUC ${classes.join(' & ')}</td>
                        <td style="text-align: center;">Time: ${duration}</td>
                        <td style="text-align: right;">Max. Marks: ${totalMarks}</td>
                    </tr>
                </table>
            </div>

            ${instructions ? `<div class="instructions-box"><strong>General Instructions:</strong> ${instructions}</div>` : ''}

            <div class="paper-content">
                ${renderedSectionsHtml}
            </div>
        </body>
        </html>
    `;

    await page.setContent(htmlContent, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' }
    });

    await page.close();
    return pdfBuffer;
}

module.exports = {
    generatePaperPdf
};
