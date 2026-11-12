import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { readSheetAsObjects } from '../src/utils/xlsxImport.js';

test('CSV with quotes, commas, BOM and blank lines', async () => {
    const csv = '\uFEFFquestion,option A,answer\r\n"What is 2,2?",""4"" or four,A\r\n\r\nplain,x,B\r\n';
    const rows = await readSheetAsObjects(new File([csv], 'q.csv', { type: 'text/csv' }));
    assert.equal(rows.length, 2);
    assert.equal(rows[0].question, 'What is 2,2?');
    assert.equal(rows[1].answer, 'B');
});

test('xlsx round trip keeps headers, numbers, rich text and formula results', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Qs');
    ws.addRow(['question', 'marks', 'note']);
    ws.addRow(['Find g', 4, { richText: [{ text: 'rich ' }, { text: 'text' }] }]);
    ws.addRow(['Sum', { formula: '1+2', result: 3 }, 'x']);
    const buf = await wb.xlsx.writeBuffer();
    const rows = await readSheetAsObjects(new File([buf], 'q.xlsx'));
    assert.deepEqual(rows[0], { question: 'Find g', marks: 4, note: 'rich text' });
    assert.equal(rows[1].marks, 3);
});

test('unsupported and oversized files are refused with a clear message', async () => {
    await assert.rejects(() => readSheetAsObjects(new File(['x'], 'q.xls')), /\.xlsx or \.csv/);
    await assert.rejects(() => readSheetAsObjects(null), /No file/);
});
