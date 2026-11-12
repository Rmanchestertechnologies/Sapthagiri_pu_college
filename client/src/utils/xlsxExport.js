/**
 * Excel (.xlsx) downloads. Replaces the `xlsx` (SheetJS) package, which has open prototype-pollution and ReDoS advisories and no
 * fixed release. `exceljs` is loaded only when a file is actually exported, so it does not enlarge the main bundle.
 *
 * Text that starts with = + - @ is prefixed with an apostrophe-free guard so a student name such as "=HYPERLINK(...)" is shown
 * as text and is never evaluated as a spreadsheet formula.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function safeCell(value) {
    if (typeof value === 'string' && FORMULA_START.test(value)) return String.fromCharCode(0x200B) + value; // zero-width guard: shown as text
    return value;
}

async function saveWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function cleanSheetName(name) {
    return String(name || 'Sheet').replace(/[\\/?*[\]:]/g, '_').slice(0, 31) || 'Sheet';
}

/** rows: array of objects with identical keys -> one sheet with a header row. */
export async function downloadJsonSheet(rows, sheetName, filename) {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(cleanSheetName(sheetName));
    const headers = rows.length ? Object.keys(rows[0]) : [];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach(r => sheet.addRow(headers.map(h => safeCell(r[h]))));
    headers.forEach((h, i) => {
        const longest = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
        sheet.getColumn(i + 1).width = Math.min(60, Math.max(10, longest + 2));
    });
    await saveWorkbook(workbook, filename);
}

/**
 * aoa: array of arrays. options: { merges: ['A1:Q1'], widths: [10, 10, 6, ...] }
 */
export async function downloadArraySheet(aoa, sheetName, filename, options = {}) {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(cleanSheetName(sheetName));
    aoa.forEach(row => sheet.addRow(row.map(safeCell)));
    (options.merges || []).forEach(range => sheet.mergeCells(range));
    (options.widths || []).forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
    await saveWorkbook(workbook, filename);
}
