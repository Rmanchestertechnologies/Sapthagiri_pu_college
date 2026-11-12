/**
 * Pure helpers for scripts/question_bank_apply_fixes.js: reading the reviewed plan CSV and deciding which rows may be applied.
 * Only one kind of change is ever allowed: setting `correct_option` to A-D, and only when the row still looks exactly as it
 * did when the plan was made (so a plan that is weeks old cannot overwrite someone's later correction).
 */
const { optionsOf } = require('./questionQuality');

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

/** CSV text -> array of objects (header row = keys). */
function readPlan(text) {
    const matrix = parseCsv(text.replace(/^﻿/, ''));
    if (matrix.length < 2) return [];
    const head = matrix[0];
    return matrix.slice(1).filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

/** Plan items that propose a concrete correct_option (everything else needs a person and is never applied). */
function applicableItems(plan) {
    return plan.filter(p => p.action === 'SET' && p.field === 'correct_option' && /^[A-D]$/.test(String(p.proposed).trim()));
}

/**
 * @returns {{ok: boolean, reason?: string}} whether `item` may be applied to the current database row.
 */
function checkAgainstRow(item, row) {
    if (!row) return { ok: false, reason: 'row no longer exists' };
    const current = String(row.correct_option ?? '').trim();
    if (current !== String(item.current ?? '').trim()) return { ok: false, reason: `row changed since the plan (now "${current}")` };
    const letter = String(item.proposed).trim();
    if (!optionsOf(row).some(o => o.letter === letter && o.text)) return { ok: false, reason: `option ${letter} is empty or missing` };
    return { ok: true };
}

module.exports = { parseCsv, readPlan, applicableItems, checkAgainstRow };
