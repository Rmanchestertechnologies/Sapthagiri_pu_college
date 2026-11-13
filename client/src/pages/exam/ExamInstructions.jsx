import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';

export default function ExamInstructions() {
    const { examId } = useParams();
    const navigate = useNavigate();
    const [exam, setExam] = useState(null);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(true);
    // Parsed once (see ExamEngine). It used to be parsed on every render, so `studentInfo` was a new object each time and the effect below
    // (which depends on it) ran again on every render: with the countdown re-rendering every second, each terminal sent
    // /take and /start about three times a second for the whole exam, reset its own state each time, and a lab quickly hit
    // the rate limit ("Access Denied" and back to the portal).
    const studentInfo = useMemo(() => {
        try { return JSON.parse(localStorage.getItem('student_info') || '{}') || {}; } catch { return {}; }
    }, []);

    const [timeLeftToStart, setTimeLeftToStart] = useState(null); // seconds until start

    useEffect(() => {
        if (!studentInfo || !studentInfo.rollNumber) {
            navigate('/lab-exam');
            return;
        }
        const emailParam = encodeURIComponent(studentInfo.studentEmail || '');
        const rollParam = encodeURIComponent(studentInfo.rollNumber || '');
        api.get(`/api/exams/${examId}/take?email=${emailParam}&rollNumber=${rollParam}`)
            .then(r => { setExam(r.data); setLoading(false); })
            .catch(err => {
                setLoading(false);
                alert(err.response?.data?.msg || 'Access Denied: Only officially enrolled students are permitted to take this exam.');
                navigate('/lab-exam');
            });
    }, [examId, studentInfo, navigate]);

    useEffect(() => {
        if (!exam || !exam.start_time) {
            setTimeLeftToStart(null);
            return;
        }
        const checkStart = () => {
            const start = new Date(exam.start_time).getTime();
            const now = new Date().getTime();
            const diff = Math.floor((start - now) / 1000);
            if (diff > 0) {
                setTimeLeftToStart(diff);
            } else {
                setTimeLeftToStart(null);
            }
        };
        checkStart();
        const timer = setInterval(checkStart, 1000);
        return () => clearInterval(timer);
    }, [exam]);

    const formatStartCountdown = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleProceed = () => {
        if (!agreed) return;
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => {
                navigate(`/exam/${examId}`);
            }).catch(() => {
                navigate(`/exam/${examId}`);
            });
        } else {
            navigate(`/exam/${examId}`);
        }
    };

    if (loading) return <div style={styles.center}>Loading exam...</div>;
    if (!exam) return <div style={styles.center}>Exam not found or not available.</div>;

    return (
        <div style={styles.page}>
            {/* Top Bar */}
            <div style={styles.topBar}>
                <div style={{ ...styles.systemName, display: 'flex', alignItems: 'center' }}>
                    <img src="/SapthagiriLogo.jpg" alt="Sapthagiri Logo" style={{ height: 26, width: 26, marginRight: 10, objectFit: 'contain', borderRadius: 4 }} />
                    Sapthagiri Pre University College, Davanagere — CBT Examination Portal
                </div>
                <div style={styles.topRight}>
                    <div style={styles.studentInfoBox}>
                        <div style={styles.studentDetails}>
                            <span style={styles.studentName}>{studentInfo.studentName || 'Student'}</span>
                            <span style={styles.studentMeta}>
                                {studentInfo.rollNumber || 'N/A'} • {studentInfo.section || 'N/A'}
                            </span>
                        </div>
                        <div style={styles.avatarBox}>👤</div>
                    </div>
                    <span style={styles.examTypeTag}>{exam.examType}</span>
                    <button
                        onClick={() => navigate('/lab')}
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        ← Exit
                    </button>
                </div>
            </div>

            <div style={styles.container}>
                <h2 style={styles.mainHeading}>Please read the instructions carefully</h2>
                
                <div style={styles.sectionHeading}><u>General Instructions:</u></div>
                <ol style={styles.list}>
                    <li>Total duration of {exam.title} is {exam.duration_minutes} min.</li>
                    <li>The clock will be set at the server. The countdown timer in the top right corner of screen will display the remaining time available for you to complete the examination. When the timer reaches zero, the examination will end by itself. You will not be required to end or submit your examination.</li>
                    <li>
                        The Questions Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
                        <ol style={styles.paletteList}>
                            <li style={styles.paletteItem}>
                                <div style={{ ...styles.paletteShape, ...styles.shapeNotVisited }}></div>
                                You have not visited the question yet.
                            </li>
                            <li style={styles.paletteItem}>
                                <div style={{ ...styles.paletteShape, ...styles.shapeNotAnswered }}></div>
                                You have not answered the question.
                            </li>
                            <li style={styles.paletteItem}>
                                <div style={{ ...styles.paletteShape, ...styles.shapeAnswered }}></div>
                                You have answered the question.
                            </li>
                            <li style={styles.paletteItem}>
                                <div style={{ ...styles.paletteShape, ...styles.shapeMarked }}></div>
                                You have NOT answered the question, but have marked the question for review.
                            </li>
                            <li style={styles.paletteItem}>
                                <div style={{ ...styles.paletteShape, ...styles.shapeAnsweredMarked }}>
                                    <div style={styles.greenDot}></div>
                                </div>
                                The question(s) "Answered and Marked for Review" will be considered for evaluation.
                            </li>
                        </ol>
                    </li>
                    <li>Your selected answers are saved automatically on the server every few seconds. If the page is refreshed or the computer restarts, sign in again with the same enrolment number: the exam resumes with your answers and the remaining time.</li>
                    <li>Do not switch tabs, minimise the window or leave full-screen mode. These are recorded, and repeated attempts can disqualify you.</li>
                </ol>

                <div style={styles.sectionHeading}><u>Navigating to a Question:</u></div>
                <ol start="7" style={styles.list}>
                    <li>To answer a question, do the following:
                        <ol type="a" style={styles.subList}>
                            <li>Click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Your selected answer is kept.</li>
                            <li>Click on <strong>Save &amp; Next</strong> to save your answer for the current question and then go to the next question.</li>
                            <li>Click on <strong>Mark for Review &amp; Next</strong> to mark the current question for review and go to the next question. If you selected an answer it is kept and counted.</li>
                            <li>Click on <strong>Save &amp; Mark for Review</strong> to keep your answer, mark the question for review, and go to the next question.</li>
                        </ol>
                    </li>
                </ol>

                <div style={styles.sectionHeading}><u>Answering a Question:</u></div>
                <ol start="8" style={styles.list}>
                    <li>Procedure for answering a multiple choice type question:
                        <ol type="a" style={styles.subList}>
                            <li>To select your answer, click on the button of one of the options.</li>
                            <li>To deselect your chosen answer, click on the button of the chosen option again or click on the <strong>Clear Response</strong> button</li>
                            <li>To change your chosen answer, click on the button of another option</li>
                            <li>To save your answer, you MUST click on the <strong>Save &amp; Next</strong> button.</li>
                            <li>To mark the question for review, click on the <strong>Mark for Review &amp; Next</strong> button.</li>
                        </ol>
                    </li>
                    <li>To change your answer to a question that has already been answered, first select that question for answering and then follow the procedure for answering that type of question.</li>
                </ol>

                <div style={styles.sectionHeading}><u>Submitting:</u></div>
                <ol start="10" style={styles.list}>
                    <li>You can move between any questions during the exam, as often as you like, until the time is over.</li>
                    <li>Click <strong>Submit</strong> when you have finished. A summary of answered, unanswered and marked questions is shown before the final confirmation. When the time reaches zero, your answers are submitted automatically.</li>
                </ol>

                <hr style={styles.divider} />
                <div style={styles.redText}>
                    All questions appear in English. Read each question and all of its options carefully before answering.
                </div>
                <hr style={styles.divider} />

                <div style={styles.agreeBox}>
                    <input 
                        type="checkbox" 
                        id="agreeCheck" 
                        checked={agreed} 
                        onChange={e => setAgreed(e.target.checked)} 
                        style={styles.checkbox} 
                    />
                    <label htmlFor="agreeCheck" style={styles.agreeText}>
                        I have read and understood the instructions. All computer hardware allotted to me are in proper working condition. I declare that I am not in possession of / not wearing / not carrying any prohibited gadget like mobile phone, bluetooth devices etc. /any prohibited material with me into the Examination Hall.I agree that in case of not adhering to the instructions, I shall be liable to be debarred from this Test and/or to disciplinary action, which may include ban from future Tests / Examinations
                    </label>
                </div>

                <div style={styles.footer}>
                    {timeLeftToStart !== null ? (
                        <div style={styles.countdownBox}>
                            ⏳ Exam starts in {formatStartCountdown(timeLeftToStart)}
                        </div>
                    ) : (
                        <button
                            style={{ ...styles.proceedBtn, ...(agreed ? {} : styles.proceedBtnDisabled) }}
                            onClick={handleProceed}
                            disabled={!agreed}
                        >
                            PROCEED
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    page: { minHeight: '100vh', background: '#fff', fontFamily: 'Arial, sans-serif', color: '#333' },
    topBar: { background: '#1e3a5f', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    systemName: { fontSize: '16px', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' },
    topRight: { display: 'flex', alignItems: 'center', gap: '16px' },
    studentInfoBox: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' },
    studentDetails: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    studentName: { fontSize: '14px', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' },
    studentMeta: { fontSize: '11px', color: '#93c5fd', fontFamily: 'Inter, sans-serif' },
    avatarBox: { fontSize: '24px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    examTypeTag: { background: '#f59e0b', color: '#000', borderRadius: '6px', padding: '4px 12px', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' },
    container: { maxWidth: '1000px', margin: '0 auto', padding: '20px' },
    mainHeading: { textAlign: 'center', fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' },
    sectionHeading: { fontSize: '16px', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' },
    list: { paddingLeft: '20px', fontSize: '14px', lineHeight: '1.6', margin: '0 0 10px 0' },
    subList: { paddingLeft: '20px', margin: '5px 0' },
    paletteList: { listStyleType: 'decimal', paddingLeft: '20px', marginTop: '10px' },
    paletteItem: { display: 'flex', alignItems: 'center', marginBottom: '15px' },
    paletteShape: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 },
    shapeNotVisited: { width: '30px', height: '30px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '3px' },
    shapeNotAnswered: { width: '30px', height: '30px', background: '#eb3b3b', border: '1px solid #c92a2a', clipPath: 'polygon(0 15%, 100% 0, 100% 85%, 0% 100%)', borderRadius: '2px' },
    shapeAnswered: { width: '30px', height: '30px', background: '#22c55e', border: '1px solid #16a34a', clipPath: 'polygon(0 0, 100% 15%, 100% 100%, 0 85%)', borderRadius: '2px' },
    shapeMarked: { width: '30px', height: '30px', background: '#6366f1', border: '1px solid #4f46e5', borderRadius: '50%' },
    shapeAnsweredMarked: { width: '30px', height: '30px', background: '#6366f1', border: '1px solid #4f46e5', borderRadius: '50%', position: 'relative' },
    greenDot: { width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', position: 'absolute', bottom: '0px', right: '0px', border: '1px solid #fff' },
    arrowIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: '#3b82f6', color: '#fff', borderRadius: '50%', fontSize: '12px' },
    divider: { border: '0', borderTop: '1px solid #eee', margin: '20px 0' },
    redText: { color: '#dc2626', fontSize: '13px', margin: '10px 0' },
    agreeBox: { display: 'flex', alignItems: 'flex-start', margin: '20px 0' },
    checkbox: { marginTop: '4px', marginRight: '10px' },
    agreeText: { fontSize: '13px', lineHeight: '1.5', cursor: 'pointer' },
    footer: { display: 'flex', justifyContent: 'center', margin: '40px 0' },
    proceedBtn: { background: '#4ade80', color: '#fff', border: 'none', padding: '10px 40px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '2px', textTransform: 'uppercase' },
    proceedBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
    countdownBox: { background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e', padding: '10px 20px', fontWeight: 'bold' },
    center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#666', fontSize: '16px' }
};
