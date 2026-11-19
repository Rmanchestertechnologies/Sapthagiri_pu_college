/**
 * Decides, on the server, whether a question's printed parts can be typeset: every maths snippet must parse in KaTeX and no
 * "$" may be left unpaired. A question that fails is kept out of papers (see keyProblem 'PRINT_BROKEN' in supabaseQuestions).
 *
 * The server is deployed without the client folder, so this is a compact port of the client's own steps
 * (client/src/utils/mathNormalize.js `normalizeEquation`, mathPipeline.js). `npm run check:bank` compares the two verdicts
 * on the whole bank and reports any disagreement, so the copies cannot drift unnoticed.
 */
const katex = require('katex');

/** Port of the client's normalizeEquation (keep in step with client/src/utils/mathNormalize.js). */
function normalizeEquation(rawMath) {
    if (!rawMath) return '';
    let eq = String(rawMath).trim();
    eq = eq.replace(/^[$'"`,;:]+/, '').replace(/[$'"`,;:]+$/, '').trim();
    eq = eq.replace(/\^([0-9]+[+-])/g, '^{$1}');
    eq = eq.replace(/\\tag\*?\s*\{([^{}]*)\}/g, '\\quad(\\text{$1})');
    eq = eq.replace(/\\text\{([^{}]*)\}/g, (whole, inner) => {
        if (!/\\[a-zA-Z]+/.test(inner)) return whole;
        return inner.split(/(\\[a-zA-Z]+)/).map(part => (/^\\[a-zA-Z]+$/.test(part) ? `${part} ` : (part ? `\\text{${part}}` : ''))).join('');
    });
    eq = eq.replace(/√/g, '\\surd ').replace(/×/g, '\\times ').replace(/°/g, '^{\\circ}');
    const openB = (eq.match(/\{/g) || []).length;
    const closeB = (eq.match(/\}/g) || []).length;
    if (closeB > openB) {
        eq = eq.replace(/([0-9a-zA-Z\s.,\\_]+)\}\s*$/, '$1');
        if ((eq.match(/\}/g) || []).length > openB) eq = eq.replace(/\}\s*$/, '');
    }
    return eq;
}

const parses = new Map(); // snippet -> boolean (maths repeats a lot across questions)
function snippetParses(math, display) {
    const key = (display ? 'D' : 'I') + math;
    if (parses.has(key)) return parses.get(key);
    let ok = true;
    try { katex.renderToString(normalizeEquation(math), { displayMode: display, throwOnError: true, strict: 'ignore', output: 'html' }); } catch { ok = false; }
    if (parses.size > 50000) parses.clear();
    parses.set(key, ok);
    return ok;
}

/** true when this text cannot be typeset cleanly */
function textIsBroken(raw) {
    if (raw == null) return false;
    let text = String(raw);
    if (!text.includes('$') && !text.includes('\\(') && !text.includes('\\[')) return false;
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
    let broken = false;
    // display maths first, as the paper does
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_m, math) => { if (!snippetParses(math, true)) broken = true; return ' '; });
    if (broken) return true;
    if (text.includes('$$')) return true;        // a lone "$$" with no partner
    // a single unpaired $ is repaired by the paper only when what follows looks like maths
    const chunks = text.split(/\n{2,}/);
    for (const chunk of chunks) {
        if (((chunk.match(/\$/g) || []).length % 2) === 1) {
            const tail = chunk.slice(chunk.lastIndexOf('$') + 1);
            if (!/[\\^_=]/.test(tail)) return true;
        }
    }
    text.replace(/\$((?:[^$])+?)\$/g, (_m, math) => { if (!snippetParses(math, false)) broken = true; return ' '; });
    return broken;
}

/** true when any printed part of a mapped question cannot be typeset (the solution is not part of the printed paper) */
function questionPrintIsBroken(q) {
    if (textIsBroken(q.questionText)) return true;
    if ((q.options || []).some(o => textIsBroken(typeof o === 'object' ? (o.text || o.option || '') : o))) return true;
    if (q.type === 'STATEMENT_BASED' && (q.statements || []).some(s => textIsBroken(typeof s === 'object' ? s.text : s))) return true;
    if (q.type === 'ASSERTION_REASON' && (textIsBroken(q.assertion) || textIsBroken(q.reason))) return true;
    if (q.type === 'MATCH_FOLLOWING' && ([...(q.columnA || []), ...(q.columnB || [])].some(textIsBroken))) return true;
    return false;
}

module.exports = { textIsBroken, questionPrintIsBroken, normalizeEquation };
