/**
 * POST /api/exams/merge with a mocked storage layer: subject order, duplicate handling, marks and class union.
 */
process.env.JWT_SECRET = 'unit-test-secret';

const mockStorage = {
    papers: [],
    createExam: jest.fn(async (e) => ({ _id: 'exam-1', ...e })),
    savePaper: jest.fn(async (p) => ({ _id: 'paper-1', ...p })),
    getPapers: jest.fn(async () => mockStorage.papers),
    getPaperById: jest.fn(async (id) => mockStorage.papers.find(p => String(p._id) === String(id)) || null),
};
jest.mock('../services/postgresStorage', () => mockStorage);
jest.mock('../services/supabaseQuestions', () => ({ getQuestionsByIds: jest.fn(async () => []), getQuestions: jest.fn() }));

const router = require('../routes/exams.js');
const layer = router.stack.find(l => l.route && l.route.path === '/merge' && l.route.methods.post);
const handler = layer.route.stack[layer.route.stack.length - 1].handle;

const q = (id, subject, extra = {}) => ({ _id: id, subject, questionText: `Q ${id}`, options: ['a', 'b', 'c', 'd'], answer: 'A', ...extra });
const paper = (id, subject, questions, extra = {}) => ({ _id: id, subject, questions, questionObjects: questions, classes: ['12'], ...extra });

const call = (body) => new Promise((resolve, reject) => {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    Promise.resolve(handler({ body, user: { id: '1', role: 'admin' } }, res)).catch(reject);
});

beforeEach(() => { mockStorage.createExam.mockClear(); mockStorage.savePaper.mockClear(); });

describe('exam merge', () => {
    test('keeps the order the admin selected, and numbers each subject section after removing duplicates', async () => {
        mockStorage.papers = [
            paper('p1', 'Physics', [q('a1', 'Physics'), q('a2', 'Physics'), q('shared', 'Physics')]),
            paper('p2', 'Chemistry', [q('b1', 'Chemistry'), q('shared', 'Chemistry'), q('b2', 'Chemistry')]),
        ];
        const r = await call({ title: 'Grand', examType: 'NEET', paperIds: ['p2', 'p1'] });
        expect(r.code).toBe(201);
        const exam = mockStorage.createExam.mock.calls[0][0];
        expect(exam.questions.map(x => x._id)).toEqual(['b1', 'shared', 'b2', 'a1', 'a2']); // Chemistry first, as selected
        const sec = Object.fromEntries(exam.sections.map(s => [s.sectionName, s.numQuestions]));
        expect(sec).toEqual({ 'Chemistry - Section A': 3, 'Physics - Section A': 2 }); // shared question counted once, in its first section
        expect(r.body.warnings.some(w => /1 duplicate/.test(w))).toBe(true);
    });

    test('REGRESSION: CET merge uses 1 mark and no negative marking everywhere; NEET uses 4 / -1', async () => {
        mockStorage.papers = [paper('p1', 'Physics', [q('a1', 'Physics'), q('a2', 'Physics')])];
        await call({ examType: 'CET', paperIds: ['p1'] });
        let exam = mockStorage.createExam.mock.calls[0][0];
        let saved = mockStorage.savePaper.mock.calls[0][0];
        expect(exam.sections[0].markingRules).toEqual({ correct: 1, incorrect: 0, unattempted: 0 });
        expect(exam.questions.every(x => x.marks === 1)).toBe(true);
        expect(saved.totalMarks).toBe(2);

        mockStorage.createExam.mockClear(); mockStorage.savePaper.mockClear();
        await call({ examType: 'NEET', paperIds: ['p1'] });
        exam = mockStorage.createExam.mock.calls[0][0];
        saved = mockStorage.savePaper.mock.calls[0][0];
        expect(exam.sections[0].markingRules).toEqual({ correct: 4, incorrect: -1, unattempted: 0 });
        expect(saved.totalMarks).toBe(8);
    });

    test('REGRESSION: the merged paper belongs to every class of its source papers, not only the first', async () => {
        mockStorage.papers = [
            paper('p1', 'Physics', [q('a1', 'Physics')], { classes: ['11'] }),
            paper('p2', 'Chemistry', [q('b1', 'Chemistry')], { classes: ['12'] }),
        ];
        await call({ examType: 'NEET', paperIds: ['p1', 'p2'] });
        expect(mockStorage.savePaper.mock.calls[0][0].classes.sort()).toEqual(['11', '12']);
    });

    test('papers that cannot be found are reported, not silently dropped', async () => {
        mockStorage.papers = [paper('p1', 'Physics', [q('a1', 'Physics')])];
        const r = await call({ examType: 'NEET', paperIds: ['p1', 'missing'] });
        expect(r.code).toBe(201);
        expect(r.body.warnings.some(w => /not found/.test(w))).toBe(true);
    });

    test('no papers selected / none found', async () => {
        mockStorage.papers = [];
        expect((await call({ paperIds: [] })).code).toBe(400);
        expect((await call({ paperIds: ['x'] })).code).toBe(404);
    });
});
