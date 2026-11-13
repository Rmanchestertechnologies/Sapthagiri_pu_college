import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatementsFromText } from '../src/components/question/parsing.js';

const parse = text => parseStatementsFromText({ questionText: text });

test('"S1:" / "S2:" statements are recognised, with the intro kept', () => {
    const r = parse('Let x be real. Now consider the following statements:\nS1: The least value is -2.\nS2: The greatest value is 2.');
    assert.equal(r.statements.length, 2);
    assert.match(r.statements[0].text, /least value is -2/);
    assert.match(r.statements[1].text, /greatest value is 2/);
    assert.match(r.introText, /consider the following statements/);
});

test('three short statements and roman labels', () => {
    assert.equal(parse('Read:\nS1: first claim here.\nS2: second claim here.\nS3: third claim here.').statements.length, 3);
    assert.equal(parse('Read:\nS-I. first claim here.\nS-II. second claim here.').statements.length, 2);
});

test('the long form still works', () => {
    const r = parse('Consider:\nStatement I: Light is a wave.\nStatement II: Light is a particle.');
    assert.equal(r.statements.length, 2);
    assert.match(r.statements[0].label, /Statement I/);
});

test('ordinary text that merely contains the letter S is not turned into statements', () => {
    assert.equal(parse('The SI unit of force is the newton. S. Chandra wrote the text.').statements.length, 0);
    assert.equal(parse('Find the value of x in S2O3 solution.').statements.length, 0);
});

test('the outro question stays outside the last statement', () => {
    const r = parse('S1: Heat flows from hot to cold.\nS2: Heat is a form of energy.\nIn the light of the above statements, choose the correct answer.');
    assert.equal(r.statements.length, 2);
    assert.match(r.outroText, /In the light of/);
    assert.doesNotMatch(r.statements[1].text, /In the light of/);
});
