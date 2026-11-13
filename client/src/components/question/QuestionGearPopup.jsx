import React from 'react';

export function QuestionGearPopup({
    imageAlignment,
    optionsPerLine,
    sizeScale = 100,
    currentDiagramHeight = 180,
    onAlignmentChange,
    onOptionsPerLineChange,
    onSizeScaleChange,
    onDiagramSizeDelta,
    onClose,
    displayNum = 1,
}) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/50 backdrop-blur-xs animate-fade-in no-print"
            onClick={onClose}
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 31, 109, 0.45)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl border-2 border-navy w-full max-w-sm p-5 animate-scale-in"
                style={{
                    backgroundColor: '#ffffff',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    color: '#0f172a',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
                    border: '2px solid #001f6d',
                    borderRadius: '16px',
                    padding: '20px',
                    maxWidth: '360px',
                    width: '100%',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header matching Image 1 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>⚙️</span>
                        <div>
                            <span style={{ fontSize: '11px', fontWeight: 900, color: '#001f6d', letterSpacing: '0.04em', display: 'block', textTransform: 'uppercase' }}>
                                QUESTION DISPLAY SETTINGS
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>
                                Question #{displayNum}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ border: 'none', background: '#f1f5f9', borderRadius: '6px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', fontWeight: 900, color: '#475569' }}
                    >
                        ✕
                    </button>
                </div>

                {/* 1. IMAGE ALIGNMENT matching Image 1 */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.04em' }}>
                        IMAGE ALIGNMENT
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                        {['Left', 'Right', 'Top', 'Below', 'Center'].map((align) => {
                            const isActive = String(imageAlignment || '').toLowerCase() === align.toLowerCase();
                            return (
                                <button
                                    key={align}
                                    type="button"
                                    onClick={() => onAlignmentChange(align)}
                                    style={{
                                        padding: '6px 2px',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        borderRadius: '6px',
                                        border: isActive ? '1.5px solid #001f6d' : '1px solid #cbd5e1',
                                        backgroundColor: isActive ? '#001f6d' : '#ffffff',
                                        color: isActive ? '#ffffff' : '#1e293b',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {align}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. OPTIONS PER LINE matching Image 1 */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '0.04em' }}>
                        OPTIONS PER LINE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[1, 2, 4].map((num) => {
                            const isActive = Number(optionsPerLine) === num;
                            return (
                                <button
                                    key={num}
                                    type="button"
                                    onClick={() => onOptionsPerLineChange(num)}
                                    style={{
                                        padding: '6px 0',
                                        fontSize: '11.5px',
                                        fontWeight: 800,
                                        borderRadius: '6px',
                                        border: isActive ? '1.5px solid #001f6d' : '1px solid #cbd5e1',
                                        backgroundColor: isActive ? '#001f6d' : '#ffffff',
                                        color: isActive ? '#ffffff' : '#1e293b',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {num}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. IMAGE SCALE (% SCALING) */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            IMAGE SCALE
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#001f6d', backgroundColor: '#e0e7ff', padding: '1px 6px', borderRadius: '4px' }}>
                            {sizeScale || 100}%
                        </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                        {[50, 75, 100, 150, 250].map((scale) => {
                            const isActive = Number(sizeScale || 100) === scale;
                            return (
                                <button
                                    key={scale}
                                    type="button"
                                    onClick={() => onSizeScaleChange && onSizeScaleChange(scale)}
                                    style={{
                                        padding: '5px 0',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        borderRadius: '6px',
                                        border: isActive ? '1.5px solid #001f6d' : '1px solid #cbd5e1',
                                        backgroundColor: isActive ? '#001f6d' : '#ffffff',
                                        color: isActive ? '#ffffff' : '#1e293b',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    {scale}%
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 4. IMAGE SIZE (HEIGHT FINE-TUNING) */}
                <div style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            IMAGE HEIGHT (PX)
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#475569', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                            {parseInt(currentDiagramHeight, 10) || 180}px
                        </span>
                    </div>
                    {/* Green increase buttons row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '5px' }}>
                        {[10, 25, 50, 100, 250].map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => onDiagramSizeDelta(val)}
                                style={{
                                    padding: '5px 0',
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    borderRadius: '6px',
                                    border: '1px solid #15803d',
                                    backgroundColor: '#16a34a',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                title={'Increase diagram height by ' + val + 'px'}
                            >
                                +{val}
                            </button>
                        ))}
                    </div>
                    {/* Red decrease buttons row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                        {[10, 25, 50, 100, 250].map((val) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => onDiagramSizeDelta(-val)}
                                style={{
                                    padding: '5px 0',
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    borderRadius: '6px',
                                    border: '1px solid #b91c1c',
                                    backgroundColor: '#dc2626',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                title={'Decrease diagram height by ' + val + 'px'}
                            >
                                -{val}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Apply & Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '8px 0',
                        backgroundColor: '#001f6d',
                        color: '#ffffff',
                        fontWeight: 800,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                    }}
                >
                    Apply & Close
                </button>
            </div>
        </div>
    );
}
