const { readPlan, applicableItems, checkAgainstRow, parseCsv } = require('../services/questionFixApply');

const csv = [
    'database,question_id,issue,action,field,current,proposed,confidence,note',
    'phy_12,q1,BAD_CORRECT_OPTION,SET,correct_option,,B,high,"answer text equals exactly one option"',
    'phy_12,q2,BAD_CORRECT_OPTION,REVIEW,correct_option,,,none,"needs a person, with a comma"',
    'phy_12,q3,BAD_CORRECT_OPTION,SET,correct_option,E,Z,high,x',
    'phy_12,q4,DUPLICATE_QUESTION,SET,row,,B,high,wrong field'
].join('\r\n') + '\r\n';

describe('question fix apply helpers', () => {
    test('CSV with quoted commas', () => {
        expect(parseCsv('a,"b,c",d\n1,2,3\n')).toEqual([['a', 'b,c', 'd'], ['1', '2', '3']]);
    });

    test('only SET correct_option items with a letter A-D are applicable', () => {
        const items = applicableItems(readPlan(csv));
        expect(items.map(i => i.question_id)).toEqual(['q1']);
    });

    test('a row is applicable only if it is unchanged and the option exists', () => {
        const item = { current: '', proposed: 'B' };
        const row = { correct_option: null, opt_a: 'x', opt_b: 'y', opt_c: 'z', opt_d: 'w' };
        expect(checkAgainstRow(item, row).ok).toBe(true);
        expect(checkAgainstRow(item, { ...row, correct_option: 'C' }).reason).toMatch(/changed since the plan/);
        expect(checkAgainstRow(item, { ...row, opt_b: '' }).reason).toMatch(/option B is empty/);
        expect(checkAgainstRow(item, undefined).reason).toMatch(/no longer exists/);
    });
});
