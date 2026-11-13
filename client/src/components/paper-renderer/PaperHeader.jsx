// ─── Paper Header ─────────────────────────────────────────────────────────────
export function PaperHeader({
    title,
    subject,
    classes,
    duration,
    totalMarks,
    templateUrl,
    isAssignment = false,
    setName = 'P',
    headerConfig = null,
}) {
    // Strictly preserve user-defined title or exam type without hardcoded placeholders or auto-generated default overrides
    const displayTitle = (title || headerConfig?.title || (isAssignment ? 'ASSIGNMENT' : 'EXAMINATION')).trim();

    const currentSet = (setName || 'P').toUpperCase();

    // Institutional Header Configuration
    const collegeName = headerConfig?.collegeName || 'SAPTHAGIRI PU COLLEGE';
    const subTitle = headerConfig?.subTitle || 'DAVANAGERE • THE LAND OF OPPORTUNITY';
    const subjectCode = headerConfig?.subjectCode ? ` (Code: ${headerConfig.subjectCode})` : '';
    const displaySubject = (headerConfig?.subject || subject || 'General') + subjectCode;

    // Strict Class Display: 11th -> "11th", 12th -> "12th", Both -> "11th & 12th"
    const classArray = Array.isArray(classes) ? classes : [classes].filter(Boolean);
    const classStrings = classArray.map(c => String(c).toLowerCase()).join(' ');
    const has11 = classStrings.includes('11') || classStrings.includes('first') || classStrings.includes('puc-i') || classStrings.includes('both');
    const has12 = classStrings.includes('12') || classStrings.includes('second') || classStrings.includes('puc-ii') || classStrings.includes('both');

    let displayClass = '11th & 12th';
    if (has11 && has12) {
        displayClass = '11th & 12th';
    } else if (has11) {
        displayClass = '11th';
    } else if (has12) {
        displayClass = '12th';
    } else if (classArray.length > 0) {
        displayClass = classArray.join(', ');
    }

    const displayDuration = headerConfig?.timeAllowed || duration || '3 Hours 15 Minutes';
    const displayMarks = headerConfig?.maxMarks || totalMarks || '70';
    const instructions = headerConfig?.generalInstructions || [];

    return (
        <div style={{ marginBottom: '6px', borderBottom: '2px solid #000', paddingBottom: '4px' }}>
            {templateUrl && templateUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                <div style={{ textAlign: 'center', marginBottom: '6px', borderBottom: '1.5px solid #000', paddingBottom: '4px' }}>
                    <img
                        src={templateUrl}
                        alt="Header"
                        onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                        style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                    />
                </div>
            ) : (
                /* Official Sapthagiri PU College Davanagere Header Crest */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ width: '56px', height: '56px', flexShrink: 0 }}>
                        <img 
                            src="/SapthagiriLogo.jpg" 
                            alt="Sapthagiri PU College" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#000', lineHeight: 1.1 }}>
                            {collegeName}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#333', marginTop: '2px' }}>
                            {subTitle}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000', marginTop: '4px' }}>
                            {displayTitle}
                        </div>
                    </div>
                    {!isAssignment && (
                        <div style={{ width: '56px', height: '56px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #000', borderRadius: '4px', padding: '2px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>SET</span>
                            <span style={{ fontSize: '22px', fontWeight: 900, lineHeight: 1 }}>{currentSet}</span>
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#111', fontWeight: 700, borderTop: '1px solid #777', paddingTop: '4px', marginTop: '4px' }}>
                <span>Subject: <strong>{displaySubject}</strong></span>
                <span>Class: <strong>{displayClass}</strong></span>
                {/* an assignment has no exam duration (it showed the exam default, "200 Minutes") */}
                {!isAssignment && <span>Time: <strong>{displayDuration}</strong></span>}
                <span>Max Marks: <strong>{displayMarks}</strong></span>
            </div>

            {!isAssignment && instructions.length > 0 && (
                <div style={{ marginTop: '6px', padding: '5px 8px', border: '1px solid #777', borderRadius: '4px', background: '#fafafa', fontSize: '10px', lineHeight: '1.4', color: '#111' }}>
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px', fontSize: '9.5px', letterSpacing: '0.04em' }}>
                        General Instructions:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '14px', listStyleType: 'decimal' }}>
                        {instructions.map((ins, iIdx) => (
                            <li key={iIdx} style={{ margin: '1px 0' }}>{ins.replace(/^\d+[\.\)]\s*/, '')}</li>
                        ))}
                    </ul>
                </div>
            )}

            {isAssignment && (
                /* Pure clean Assignment header */
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #777', paddingTop: '4px', fontWeight: 700, fontSize: '11.5px', marginTop: '4px' }}>
                    <span>Subject: <strong>{displaySubject}</strong></span>
                    <span>Class: <strong>{displayClass}</strong></span>
                    <span>Student Name: _____________________</span>
                    <span>Roll No: ________</span>
                    <span>Date: _________</span>
                </div>
            )}
        </div>
    );
}
