import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import katex from 'katex';

// KaTeX draws the square-root sign as an SVG that only shows when cropped by preserveAspectRatio="xMinYMin slice".
// The sanitiser that cleans the rendered HTML must therefore keep that attribute, otherwise every radical disappears.
const source = readFileSync(new URL('../src/components/MathRenderer.jsx', import.meta.url), 'utf8');
const allowedAttrs = (source.match(/ALLOWED_ATTR:\s*\[([\s\S]*?)\]/) || [null, ''])[1];
const R = String.raw;

test('KaTeX output for a root uses preserveAspectRatio', () => {
    const html = katex.renderToString(R`\sqrt{2}`, { output: 'html', throwOnError: false });
    assert.match(html, /preserveAspectRatio=/);
});

test('every SVG attribute KaTeX emits for roots and arrows is allowed by the sanitiser', () => {
    const samples = [R`\sqrt3 P`, R`\sqrt{1-\frac{1}{n^2}}`, R`\xrightarrow{a}`, R`\overbrace{x}`];
    const html = samples.map(m => katex.renderToString(m, { output: 'html' })).join('');
    const used = new Set([...html.matchAll(/<(?:svg|path)\b([^>]*)>/g)].flatMap(m => [...m[1].matchAll(/([A-Za-z:-]+)=/g)].map(a => a[1])));
    assert.ok(used.size > 0);
    for (const attr of used) {
        assert.ok(new RegExp(`'${attr}'`, 'i').test(allowedAttrs), `sanitiser drops the "${attr}" attribute KaTeX needs`);
    }
});
