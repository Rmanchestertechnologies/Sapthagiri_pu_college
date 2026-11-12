/**
 * Reads the first sheet of an uploaded .xlsx or .csv into an array of objects keyed by the header row (what
 * `sheet_to_json` of the old `xlsx` package returned). Used by the bulk question import.
 *
 * Limits protect the browser: files over 10 MB and sheets over 5 000 data rows are refused with a clear message.
 */
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 5000;

function cellText(value) {
    if (value == null) return '';
    if (typeof value === 'object') {
        if (value instanceof Date) return value.toISOString();
        if (Array.isArray(value.richText)) return value.richText.map(r => r.text).join('');
        if ('result' in value) return cellText(value.result);        // formula
        if ('text' in value) return cellText(value.text);            // hyperlink
        if ('error' in value) return '';
        return String(value);
    }
    return value;
}

function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
}

function rowsToObjects(matrix) {
    if (matrix.length === 0) return [];
    const headers = matrix[0].map(h => String(cellText(h)).trim());
    const out = [];
    for (let r = 1; r < matrix.length; r++) {
        const obj = {};
        let any = false;
        headers.forEach((h, i) => {
            if (!h) return;
            const v = cellText(matrix[r][i]);
            if (v !== '' && v != null) any = true;
            obj[h] = v;
        });
        if (any) out.push(obj);
        if (out.length > MAX_ROWS) throw new Error(`The sheet has more than ${MAX_ROWS} rows. Split it into smaller files.`);
    }
    return out;
}

export async function readSheetAsObjects(file) {
    if (!file) throw new Error('No file selected.');
    if (file.size > MAX_BYTES) throw new Error('The file is larger than 10 MB.');
    const name = String(file.name || '').toLowerCase();

    if (name.endsWith('.csv') || file.type === 'text/csv') {
        const text = await file.text();
        return rowsToObjects(parseCsv(text.replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '')));
    }
    if (!name.endsWith('.xlsx')) throw new Error('Please choose an .xlsx or .csv file (old .xls files are not supported).');

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const matrix = [];
    sheet.eachRow({ includeEmpty: false }, row => {
        // row.values is 1-based (index 0 unused)
        matrix.push(row.values.slice(1));
    });
    return rowsToObjects(matrix);
}
