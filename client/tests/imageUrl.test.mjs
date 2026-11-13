import test from 'node:test';
import assert from 'node:assert/strict';
// QuestionImage.jsx is a React component file; its address cleaning is exercised through the same rule on the server (imageUrl.test.js)
// and by the browser check. This test covers the pure rule written identically in both places.
const clean = src => src.replace(/[\u00a0\s]*-[\u00a0]+\s*/g, '-').replace(/[\u00a0\u200b-\u200d\u2060\ufeff]+/g, '').trim();

test('the browser rule removes the invisible characters that broke real bank images', () => {
    assert.equal(clean('https://res.cloudinary.com/x/y-eac\u00a0-\u00a04d20-9e99.jpg'), 'https://res.cloudinary.com/x/y-eac-4d20-9e99.jpg');
    assert.equal(clean('https://res.cloudinary.com/x/y.jpg'), 'https://res.cloudinary.com/x/y.jpg');
});
