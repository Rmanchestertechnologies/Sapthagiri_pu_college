import React from 'react';
import MathRenderer from '../MathRenderer';
import { cleanQuestionText } from './parsing';
import { Q } from './layout';

export function BodyTrueFalse({
    q,
    displayNum,
    displayMode = '1. Questions',
}) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '', q);
    const qId = q._id || q.id || displayNum;
    const isAnswersMode = displayMode === '2. Questions with Answers' || displayMode === '3. Questions with Answers & Solutions';
    const isTrue = /^[Aa]$/.test(String(q.correct_option).trim()) || /^true$/i.test(String(q.answer).trim());

    return (
        <div style={{ width: '100%' }}>
            <div style={{ ...Q.qTextBold, marginBottom: '4px', display: 'block' }}>
                <MathRenderer inline text={rawQText} questionId={qId} />
            </div>
            {isAnswersMode && (
                <div style={{
                    marginTop: '4px',
                    display: 'inline-block',
                    padding: '2px 8px',
                    backgroundColor: '#dcfce7',
                    border: '1px solid #86efac',
                    borderRadius: '4px',
                    color: '#15803d',
                    fontWeight: 800,
                    fontSize: '11px',
                }}>
                    ✓ Answer: {isTrue ? 'True' : 'False'}
                </div>
            )}
        </div>
    );
}
