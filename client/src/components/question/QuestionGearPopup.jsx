import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const PANEL_WIDTH = 340;

const sectionTitle = { fontSize: '10.5px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' };
const optionButton = (active) => ({
    padding: '7px 2px',
    fontSize: '11px',
    fontWeight: 800,
    borderRadius: '6px',
    border: active ? '1.5px solid #001f6d' : '1px solid #cbd5e1',
    backgroundColor: active ? '#001f6d' : '#ffffff',
    color: active ? '#ffffff' : '#1e293b',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
});
const stepButton = (green) => ({
    padding: '6px 0',
    fontSize: '10.5px',
    fontWeight: 800,
    borderRadius: '6px',
    border: green ? '1px solid #15803d' : '1px solid #b91c1c',
    backgroundColor: green ? '#16a34a' : '#dc2626',
    color: '#ffffff',
    cursor: 'pointer',
});

/**
 * Settings of ONE question (image position and size, options per line).
 *
 * It is a panel fixed to the right edge of the window, drawn through a portal into <body>: inside the paper it used to sit in
 * the zoomed / scaled page area, where "fixed" is not relative to the window, so it overlapped the questions. While it is open
 * the page is pushed left by the panel's width, so the paper stays fully visible and every change shows on it at once.
 */
export function QuestionGearPopup({
    imageAlignment,
    optionsPerLine,
    sizeScale = 100,
    currentDiagramHeight = 180,
    onAlignmentChange,
    onOptionsPerLineChange,
    onSizeScaleChange,
    onDiagramSizeDelta,
    onReset,
    onClose,
    displayNum = 1,
}) {
    // keep the paper visible: make room for the panel, and put it back when the panel closes
    useEffect(() => {
        const previous = document.body.style.paddingRight;
        document.body.style.paddingRight = `${PANEL_WIDTH}px`;
        document.body.style.transition = 'padding-right 0.15s ease';
        return () => { document.body.style.paddingRight = previous; };
    }, []);

    // Esc closes
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const height = parseInt(currentDiagramHeight, 10) || 180;

    const panel = (
        <aside
            className="no-print"
            role="dialog"
            aria-label={`Question display settings, question ${displayNum}`}
            style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: `min(${PANEL_WIDTH}px, 92vw)`,
                zIndex: 2147483000, background: '#ffffff', borderLeft: '2px solid #001f6d',
                boxShadow: '-12px 0 32px rgba(0,0,0,0.18)', overflowY: 'auto', padding: '18px 18px 22px',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#0f172a',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '12px' }}>
                <div>
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#001f6d', letterSpacing: '0.04em', display: 'block', textTransform: 'uppercase' }}>⚙️ Question display settings</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Question #{displayNum} · changes show on the paper straight away</span>
                </div>
                <button type="button" onClick={onClose} aria-label="Close settings"
                    style={{ border: 'none', background: '#f1f5f9', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ marginBottom: '14px' }}>
                <div style={{ ...sectionTitle, marginBottom: '6px' }}>Image alignment</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                    {['Left', 'Right', 'Top', 'Below', 'Center'].map((align) => (
                        <button key={align} type="button" onClick={() => onAlignmentChange && onAlignmentChange(align)}
                            style={optionButton(String(imageAlignment || '').toLowerCase() === align.toLowerCase())}>{align}</button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
                <div style={{ ...sectionTitle, marginBottom: '6px' }}>Options per line</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[1, 2, 4].map((num) => (
                        <button key={num} type="button" onClick={() => onOptionsPerLineChange && onOptionsPerLineChange(num)}
                            style={optionButton(Number(optionsPerLine) === num)}>{num}</button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={sectionTitle}>Image scale</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#001f6d', backgroundColor: '#e0e7ff', padding: '1px 6px', borderRadius: '4px' }}>{sizeScale || 100}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                    {[50, 75, 100, 150, 250].map((scale) => (
                        <button key={scale} type="button" onClick={() => onSizeScaleChange && onSizeScaleChange(scale)}
                            style={{ ...optionButton(Number(sizeScale || 100) === scale), fontSize: '10px' }}>{scale}%</button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={sectionTitle}>Image height (px)</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{height}px</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '5px' }}>
                    {[10, 25, 50, 100, 250].map((val) => (
                        <button key={val} type="button" onClick={() => onDiagramSizeDelta && onDiagramSizeDelta(val)} title={`Make the image ${val}px taller`} style={stepButton(true)}>+{val}</button>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                    {[10, 25, 50, 100, 250].map((val) => (
                        <button key={val} type="button" onClick={() => onDiagramSizeDelta && onDiagramSizeDelta(-val)} title={`Make the image ${val}px shorter`} style={stepButton(false)}>-{val}</button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: onReset ? '1fr 1fr' : '1fr', gap: '8px' }}>
                {onReset && (
                    <button type="button" onClick={onReset}
                        style={{ padding: '9px 0', backgroundColor: '#ffffff', color: '#001f6d', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderRadius: '8px', border: '1.5px solid #001f6d', cursor: 'pointer' }}>
                        Reset
                    </button>
                )}
                <button type="button" onClick={onClose}
                    style={{ padding: '9px 0', backgroundColor: '#001f6d', color: '#ffffff', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                    Done
                </button>
            </div>
        </aside>
    );

    return typeof document !== 'undefined' ? createPortal(panel, document.body) : null;
}
