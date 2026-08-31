const puppeteer = require('puppeteer');

let browser = null;

async function getBrowser() {
    if (browser && browser.process() && browser.process().signalCode === null) {
        return browser;
    }
    browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    return browser;
}

/**
 * Generate a PDF scorecard buffer for a student exam session using Puppeteer
 * @param {Object} session - The ExamSession document
 * @param {Object} exam - The OnlineExam document
 * @returns {Promise<Buffer>}
 */
async function generateReportPdf(session, exam) {
    const b = await getBrowser();
    const page = await b.newPage();
    
    // Process weak areas
    let weakAreasRows = '';
    if (session.weakAreas && session.weakAreas.length > 0) {
        session.weakAreas.forEach(w => {
            weakAreasRows += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px;">${w.chapter || 'N/A'}</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 12px; color: #ef4444; font-weight: bold;">${w.incorrect} Incorrect Answers</td>
                </tr>
            `;
        });
    } else {
        weakAreasRows = `
            <tr>
                <td colspan="2" style="padding: 15px; border: 1px solid #e2e8f0; font-size: 12px; text-align: center; color: #64748b; font-style: italic;">
                    No weak areas identified. 100% Concept Mastery!
                </td>
            </tr>
        `;
    }
    
    const correctCount = session.correctAnswers || 0;
    const incorrectCount = session.wrongAnswers || 0;
    const totalQuestions = exam.questions?.length || 0;
    const totalMarks = totalQuestions * 4;
    const score = session.score;
    const submittedAt = session.submittedAt ? new Date(session.submittedAt).toLocaleString('en-IN') : 'N/A';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body {
                  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  color: #1e293b;
                  background-color: white;
              }
              .header {
                  background-color: #0f172a;
                  color: #d4af37;
                  padding: 25px;
                  text-align: center;
                  border-radius: 12px;
                  margin-bottom: 25px;
              }
              .header h1 {
                  margin: 0;
                  font-size: 24px;
                  font-weight: 800;
                  letter-spacing: -0.5px;
                  text-transform: uppercase;
              }
              .header p {
                  margin: 8px 0 0;
                  font-size: 11px;
                  color: #ffffff;
                  font-weight: 500;
                  letter-spacing: 1px;
              }
              .section-title {
                  font-size: 13px;
                  font-weight: 800;
                  color: #0f172a;
                  border-bottom: 2px solid #d4af37;
                  padding-bottom: 5px;
                  margin-top: 25px;
                  margin-bottom: 12px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
              }
              .info-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
              }
              .info-table td {
                  padding: 8px 12px;
                  font-size: 12px;
              }
              .info-table td.label {
                  font-weight: 700;
                  color: #475569;
                  width: 25%;
              }
              .info-table td.value {
                  color: #0f172a;
                  width: 25%;
              }
              .metric-row {
                  margin-top: 15px;
                  margin-bottom: 25px;
                  width: 100%;
                  display: table;
              }
              .metric-card {
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  border-radius: 12px;
                  padding: 15px;
                  text-align: center;
                  display: table-cell;
                  width: 30%;
              }
              .metric-spacer {
                  display: table-cell;
                  width: 5%;
              }
              .metric-val {
                  font-size: 22px;
                  font-weight: 800;
                  color: #0f172a;
              }
              .metric-lbl {
                  font-size: 10px;
                  font-weight: 700;
                  color: #64748b;
                  text-transform: uppercase;
                  margin-top: 5px;
              }
              .weak-table {
                  width: 100%;
                  border-collapse: collapse;
              }
              .weak-table th {
                  background-color: #0f172a;
                  color: #d4af37;
                  font-weight: 700;
                  font-size: 11px;
                  text-transform: uppercase;
                  padding: 10px;
                  text-align: left;
              }
              .footer {
                  margin-top: 60px;
                  text-align: center;
                  font-size: 10px;
                  color: #94a3b8;
                  font-style: italic;
                  border-top: 1px solid #e2e8f0;
                  padding-top: 15px;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>${exam.title}</h1>
              <p>EXAM SCORECARD | DURATION: ${exam.duration_minutes || 180} MINS</p>
          </div>
          
          <div class="section-title">Student Details</div>
          <table class="info-table">
              <tr>
                  <td class="label">Student Name:</td>
                  <td class="value">${session.studentName || 'N/A'}</td>
                  <td class="label">Exam Type:</td>
                  <td class="value">${exam.examType || 'N/A'}</td>
              </tr>
              <tr>
                  <td class="label">Email:</td>
                  <td class="value">${session.studentEmail || 'N/A'}</td>
                  <td class="label">Submission:</td>
                  <td class="value">${submittedAt}</td>
              </tr>
          </table>
          
          <div class="metric-row">
              <div class="metric-card">
                  <div class="metric-val">${correctCount}</div>
                  <div class="metric-lbl">Correct Answers</div>
              </div>
              <div class="metric-spacer"></div>
              <div class="metric-card">
                  <div class="metric-val">${incorrectCount}</div>
                  <div class="metric-lbl">Incorrect Answers</div>
              </div>
              <div class="metric-spacer"></div>
              <div class="metric-card">
                  <div class="metric-val">${score} / ${totalMarks}</div>
                  <div class="metric-lbl">Total Score</div>
              </div>
          </div>
          
          <div class="section-title">Weak Areas Analysis (Item Analysis)</div>
          <table class="weak-table">
              <thead>
                  <tr>
                      <th style="width: 60%; padding: 10px;">Chapter / Topic</th>
                      <th style="width: 40%; padding: 10px;">Analysis Details</th>
                  </tr>
              </thead>
              <tbody>
                  ${weakAreasRows}
              </tbody>
          </table>
          
          <div class="footer">
              This is an official assessment scorecard generated by the Coaching Exam Portal.
          </div>
      </body>
      </html>
    `;
    
    await page.setContent(htmlContent);
    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });
    
    await page.close();
    return pdfBuffer;
}

module.exports = {
    generateReportPdf
};
