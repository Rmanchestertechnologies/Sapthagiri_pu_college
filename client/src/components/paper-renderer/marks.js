// ─── Marks helpers ────────────────────────────────────────────────────────────
export function formatMarks(type = '', classes = []) {
    const isNeet = Array.isArray(classes) && classes.some(c => String(c).toUpperCase() === 'NEET');
    const t = (type || '').toUpperCase();
    if (t === 'MCQ' || t === '1M' || t === 'DIAGRAM_BASED' || t === 'IMAGE_BASED' || t === 'ASSERTION_REASON') {
        return isNeet ? '4 Marks' : '1 Mark';
    }
    if (t === '2M') return '2 Marks';
    if (t === '3M') return '3 Marks';
    if (t === '4M' || t === 'NUMERICAL') return '4 Marks';
    if (t === '5M') return '5 Marks';
    if (t === 'MATCH_FOLLOWING') return '4 Marks';
    return '1 Mark';
}

export function calcTotal(questions = [], classes = [], examType = '') {
    const rawType = String(examType || '').toUpperCase();
    if (rawType.includes('CET')) return questions.length * 1;
    if (rawType.includes('NEET') || rawType.includes('JEE')) return questions.length * 4;
    return questions.reduce((s, q) => {
        if (q.marks && !isNaN(parseInt(q.marks, 10))) return s + parseInt(q.marks, 10);
        const t = (q.type || '').toUpperCase();
        const isNeetOrJee = Array.isArray(classes) && classes.some(c => {
            const sc = String(c).toUpperCase();
            return sc.includes('NEET') || sc.includes('JEE');
        });
        if (isNeetOrJee) return s + 4;
        if (t === '2M') return s + 2;
        if (t === '3M') return s + 3;
        if (t === 'NUMERICAL' || t === '4M' || t === 'MATCH_FOLLOWING') return s + 4;
        if (t === '5M') return s + 5;
        return s + 1;
    }, 0);
}

// ─── Default settings ─────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
    fontFamily: '"Times New Roman", Times, Georgia, serif',
    fontSize: '13px',
    lineHeight: '1.42',
    displayMode: '1. Questions', // 7 modes from Image 4
    optionFormat: '(1) (2) (3) (4)', // 3 styles from Image 3
    optionsLayout: 'line', // options 1, 2, 3, 4 in a line
    durationMinutes: 200,
    marksPerQuestion: 4,
    duration: '200 Minutes',
    startQNo: 1,
    optionSpacing: 'Default', // No Spacing, Default, 5, 10, 15 from Image 5
    questionSpacing: 'Default', // No Spacing, Default, 5, 10, 15 from Image 5
    showQuestionNumbers: true, // [x] Show Question Numbers from Image 5
    imageBelowQuestion: false, // [x] Image below Question from Image 5
    paper2Column: false, // [x] Paper 2 Column from Image 5
    paper2ColumnQuestionBreak: true, // [x] Paper 2 Column Question Break from Image 5
    columns: 1,
    columnGap: '18px',
    showMarks: false,
    showAnswerKey: false,
    showDifficulty: false,
    showCoverPage: false,
    includeSchemeOnLastPage: false,
    numberingMode: 'continuous',
    endQNo: null,
    pageSize: 'A4',
    orientation: 'portrait',
    marginTop: '5mm',
    marginBottom: '6mm',
    marginLeft: '8mm',
    marginRight: '8mm',
    diagramMaxHeight: '180px',
    showWatermark: true,
    watermarkOpacity: 8,   // percent, 0-40
    watermarkScale: 100,   // percent of the default 380px emblem, 20-250
};
