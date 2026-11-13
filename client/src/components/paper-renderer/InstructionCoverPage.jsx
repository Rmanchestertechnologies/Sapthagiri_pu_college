// ─── Instruction Cover Page ───────────────────────────────────────────────────
export function InstructionCoverPage({ paper, questions = [], duration, totalMarks, classes = [] }) {
    const totalQCount = questions.length || 60;

    return (
        <div style={{ paddingBottom: '16px', borderBottom: '2px dashed #666', marginBottom: '20px' }}>
            {/* Candidate Name and Reg No Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 14px 0', fontSize: '12px', fontWeight: 800 }}>
                <div style={{ flex: 1 }}>
                    Name of the candidate: <span style={{ display: 'inline-block', borderBottom: '1.5px solid #000', width: '240px', marginLeft: '6px' }}>&nbsp;</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800 }}>Reg. No.</span>
                    <div style={{ display: 'flex', border: '1.5px solid #000' }}>
                        {[...Array(8)].map((_, i) => (
                            <div key={i} style={{ width: '20px', height: '22px', borderRight: i < 7 ? '1.5px solid #000' : 'none' }}></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Instructions Title */}
            <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', color: '#000' }}>
                IMPORTANT INSTRUCTIONS TO CANDIDATES :
            </div>

            {/* Instructions Body */}
            <div style={{ fontSize: '11.5px', lineHeight: '1.5', color: '#111' }}>
                <p style={{ margin: '3px 0' }}>
                    <strong>1)</strong> This question paper contains <strong>{totalQCount} questions</strong>. Each question consists of a question stem and 4 choices/options.
                </p>
                <p style={{ margin: '3px 0' }}>
                    <strong>2)</strong> Duration: <strong>{duration || '180 Minutes / 3 Hours'}</strong>. Read each question carefully and shade the corresponding circle completely on the OMR answer sheet using a blue/black ballpoint pen.
                </p>

                {/* OMR Demonstration Box */}
                <div style={{ border: '1.5px solid #000', margin: '8px 0', padding: '6px', background: '#fafafa', borderRadius: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', border: '1px solid #777', background: '#fff' }}>
                        <div style={{ padding: '5px 8px', borderRight: '1px solid #777', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '4px', color: '#111' }}>ಸರಿಯಾದ ಕ್ರಮ / CORRECT METHOD</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center' }}>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>A</span>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, background: '#000', color: '#fff' }}>B</span>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>C</span>
                                <span style={{ border: '1.5px solid #000', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>D</span>
                            </div>
                        </div>
                        <div style={{ padding: '5px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '4px', color: '#111' }}>ತಪ್ಪು ಕ್ರಮಗಳು / WRONG METHODS</div>
                            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#c00' }}>✖</span>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>B</span>
                                </div>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px' }}>A</span>
                                    <span style={{ border: '1px solid #000', borderRadius: '50%', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, color: '#090' }}>✔</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <p style={{ margin: '3px 0' }}>
                    <strong>3)</strong> Avoid stray marks or multiple responses on the OMR sheet. Hand over the sheet to the room invigilator at conclusion of exam.
                </p>
            </div>
        </div>
    );
}
