import React from 'react';
import MathRenderer from '../MathRenderer';
import ResizableDiagram from '../ResizableDiagram';
import { cleanQuestionText, extractDiagramFromText } from './parsing';

export function BodyNumerical({
    q,
    classes = [],
    isTwoCol = false,
    diagramMaxHeight = 120,
    onDiagramResize,
    displayNum,
}) {
    const rawQText = cleanQuestionText(q.questionText || q.question || '');
    const { cleanText: qText, diagramUrl: imageUrl } = extractDiagramFromText(rawQText, q.imageUrl || q.image_url);
    const qId = q._id || q.id || displayNum;
    const currentDiagramHeight = q.customDiagramSizes?.['main'] || q.customDiagramHeight || diagramMaxHeight;
    const isMainManual = Boolean(q.customDiagramSizes?.['main'] || q.customDiagramHeight);

    return (
        <div style={{ width: '100%' }}>
            {/* Question Text */}
            <div style={{ lineHeight: '1.45', marginBottom: '6px' }}>
                <MathRenderer
                    inline
                    text={qText}
                    questionId={qId}
                    customDiagramSizes={q.customDiagramSizes}
                    onSizeChange={onDiagramResize ? (h, key) => onDiagramResize(qId, h, key) : undefined}
                />
            </div>

            {/* Optional Diagram */}
            {imageUrl && (
                <div style={{ textAlign: 'center', margin: '4px auto 6px' }}>
                    <ResizableDiagram
                        src={imageUrl}
                        alt={`Question ${displayNum} diagram`}
                        height={currentDiagramHeight}
                        isManual={isMainManual}
                        onResize={(newH) => onDiagramResize && onDiagramResize(qId, newH, 'main')}
                    />
                </div>
            )}

            {/* Numerical Answer Entry Box (JEE Standard) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    padding: '3px 8px',
                    border: '1px dashed #94a3b8',
                    borderRadius: '4px',
                    width: 'fit-content',
                    backgroundColor: '#f8fafc',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#1e293b'
                }}
            >
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em', color: '#001f6d' }}>
                    Answer:
                </span>
                <span
                    style={{
                        display: 'inline-block',
                        minWidth: '70px',
                        height: '18px',
                        backgroundColor: '#ffffff',
                        borderRadius: '2px',
                        border: '1px solid #cbd5e1',
                        borderBottom: '1.5px solid #001f6d',
                        padding: '0 6px',
                    }}
                />
            </div>
        </div>
    );
}
