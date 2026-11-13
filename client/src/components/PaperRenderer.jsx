/**
 * PaperRenderer.jsx
 *
 * Professional Unified A4 Layout & Preview System
 *
 * Requirements fulfilled:
 * - True A4 Paper Rendering with discrete Page-by-Page pagination
 * - Intelligent Diagram Placement & Spacing via QuestionBlock & A4PaperEngine
 * - Preview Mode with Page Navigation (Page X of Y, Prev, Next, Zoom, Fit-to-screen)
 * - Separate Alignment Step / Panel (not shown prematurely on create screen)
 * - 100% fidelity match between Preview and PDF print
 */

import { useState, useMemo, useEffect } from 'react';
import { EditQuestionModal, SwapQuestionModal } from './PaperQuestionEditorModals';
import api from '../api';
import A4PaperEngine from './A4PaperEngine';
import { generatePaperSet } from '../utils/pqrsGenerator';
import { SettingsPanel } from './paper-renderer/SettingsPanel';
import { DEFAULT_SETTINGS } from './paper-renderer/marks';

export { InstructionCoverPage } from './paper-renderer/InstructionCoverPage';
export { PaperHeader } from './paper-renderer/PaperHeader';
export { SettingsPanel } from './paper-renderer/SettingsPanel';
export { DEFAULT_SETTINGS, calcTotal, formatMarks } from './paper-renderer/marks';

// ─── Main PaperRenderer Component ─────────────────────────────────────────────
export default function PaperRenderer({
    paper,
    activeTemplate,
    isAssignment = false,
    enableSets = false,
    settings: externalSettings,
    setSettings: externalSetSettings,
    showSettingsPanel = false,
    onProceedToAlignment,
    onProceedToFinalize,
    onDiagramResize,
    onShuffleQuestions,
    onPaperUpdated,
    // External toolbar control props — when provided, toolbar is hidden and parent owns controls
    setsActive: externalSetsActive,
    setSetsActive: externalSetSetsActive,
    activeSet: externalActiveSet,
    setActiveSet: externalSetActiveSet,
    zoom: externalZoom,
    setZoom: externalSetZoom,
    hideToolbar = false,
    onBack,
    onOpenAnswerKey,
    onOpenSolutions,
    onReshuffle,
    onOpenMerge,
    onDownloadWord,
    downloadingWord,
    onPrint,
    onFinalizeSave,
    savingPaper,
}) {
    const [internalSettings, setInternalSettings] = useState(DEFAULT_SETTINGS);
    const settings = externalSettings || internalSettings;
    const setSettings = externalSetSettings || setInternalSettings;

    // 4 Sets State (P, Q, R, S) — use external state if provided
    const [internalSetsActive, setInternalSetsActive] = useState(enableSets || paper?.enableSets || false);
    const [internalActiveSet, setInternalActiveSet] = useState(paper?.setName || 'P');
    const setsActive = externalSetsActive !== undefined ? externalSetsActive : internalSetsActive;
    const setSetsActive = externalSetSetsActive || setInternalSetsActive;
    const activeSet = externalActiveSet || internalActiveSet;
    const setActiveSet = externalSetActiveSet || setInternalActiveSet;

    // Zoom state — use external if provided
    const [internalZoom, setInternalZoom] = useState(100);
    const zoom = externalZoom !== undefined ? externalZoom : internalZoom;
    const setZoom = externalSetZoom || setInternalZoom;

    // Live questions state for on-the-fly editing & swapping in preview
    const [localQuestions, setLocalQuestions] = useState(paper?.questions || []);

    useEffect(() => {
        if (paper?.questions) {
            setLocalQuestions(paper.questions);
        }
    }, [paper?.questions]);

    const [editingQuestion, setEditingQuestion] = useState(null); // { question, index, displayNum }
    const [swappingQuestion, setSwappingQuestion] = useState(null); // { question, index, displayNum }

    // The preview shows the ACTIVE set (P/Q/R/S) but edits are stored in the master paper. In sets Q, R and S the order
    // and the options are shuffled, so a displayed position is not a master position and an edit made there cannot be
    // mapped back to the master option order. Editing, swapping and deleting are therefore done on Set P; these used
    // to apply the displayed index to the master list and change the wrong question.
    const editingBlockedInSet = () => {
        if (setsActive && activeSet !== 'P') {
            alert('Questions are edited, swapped and deleted on Set P (the master paper). Switch to Set P, make the change, then view this set again.');
            return true;
        }
        return false;
    };
    // Position in the master list of the question shown at `displayIndex` (matched by id, so layout changes stay on the right question)
    const masterIndexOf = (displayIndex) => {
        const shown = (activePaper?.questions || [])[displayIndex];
        const id = shown && (shown._id || shown.id);
        const found = id ? localQuestions.findIndex(q => (q._id || q.id) === id) : -1;
        return found >= 0 ? found : displayIndex;
    };

    const handleSaveEditedQuestion = async (updatedQ, index) => {
        if (editingBlockedInSet()) return;
        const nextQuestions = [...localQuestions];
        nextQuestions[index] = updatedQ;
        setLocalQuestions(nextQuestions);

        const updatedPaper = { ...paper, questions: nextQuestions };
        if (onPaperUpdated) {
            onPaperUpdated(updatedPaper);
        }

        const paperId = paper?._id || paper?.id;
        if (paperId) {
            try {
                await api.put(`/api/papers/${paperId}`, {
                    ...paper,
                    questions: nextQuestions
                });
            } catch (e) {
                console.warn('Auto-save edited question warning:', e.message);
            }
        }
    };

    const handleSelectSwappedQuestion = async (index, chosenQ) => {
        if (editingBlockedInSet()) return;
        const nextQuestions = [...localQuestions];
        nextQuestions[index] = chosenQ;
        setLocalQuestions(nextQuestions);

        const updatedPaper = { ...paper, questions: nextQuestions };
        if (onPaperUpdated) {
            onPaperUpdated(updatedPaper);
        }

        const paperId = paper?._id || paper?.id;
        if (paperId) {
            try {
                await api.put(`/api/papers/${paperId}`, {
                    ...paper,
                    questions: nextQuestions
                });
            } catch (e) {
                console.warn('Auto-save swapped question warning:', e.message);
            }
        }
    };

    const effectivePaper = useMemo(() => {
        return { ...paper, questions: localQuestions };
    }, [paper, localQuestions]);

    // Generate active set paper only when sets are active, otherwise return master paper
    const activePaper = useMemo(() => {
        if (isAssignment || !effectivePaper) return effectivePaper;
        if (!setsActive || activeSet === 'P') return { ...effectivePaper, setName: setsActive ? 'P' : '' };
        return generatePaperSet(effectivePaper, activeSet, Number(settings.startQNo) || 1);
    }, [effectivePaper, activeSet, isAssignment, setsActive, settings.startQNo]);

    const questions = useMemo(() => activePaper?.questions || [], [activePaper]);

    // Layout change handler (persists alignment, sizing, and optionsPerLine in real time)
    const handleUpdateQuestionLayout = (displayIndex, layoutChanges) => {
        const qIndex = masterIndexOf(displayIndex);
        const nextQuestions = [...localQuestions];
        nextQuestions[qIndex] = {
            ...nextQuestions[qIndex],
            ...layoutChanges,
        };
        setLocalQuestions(nextQuestions);
        const updatedPaper = { ...paper, questions: nextQuestions };
        if (onPaperUpdated) {
            onPaperUpdated(updatedPaper);
        }
        const paperId = paper?._id || paper?.id;
        if (paperId) {
            try {
                api.put(`/api/papers/${paperId}`, {
                    ...paper,
                    questions: nextQuestions
                }).catch(e => console.warn('Layout save warning:', e.message));
            } catch (e) {
                console.warn('Layout save error:', e.message);
            }
        }
    };

    // Question delete handler
    const handleDeleteQuestion = async (index) => {
        if (editingBlockedInSet()) return;
        const nextQuestions = localQuestions.filter((_, i) => i !== index);
        setLocalQuestions(nextQuestions);
        const updatedPaper = { ...paper, questions: nextQuestions };
        if (onPaperUpdated) {
            onPaperUpdated(updatedPaper);
        }
        const paperId = paper?._id || paper?.id;
        if (paperId) {
            try {
                await api.put('/api/papers/' + paperId, {
                    ...paper,
                    questions: nextQuestions,
                });
            } catch (e) {
                console.warn('Auto-save deleted question warning:', e.message);
            }
        }
    };

    return (
        <div className="paper-renderer-wrapper w-full flex flex-col items-center">
            {/* Alignment / Settings Panel (Shown only in Alignment step) */}
            {showSettingsPanel && (
                <div className="w-full max-w-5xl no-print">
                    <SettingsPanel
                        settings={settings}
                        setSettings={setSettings}
                        totalQuestions={questions.length}
                        setsActive={setsActive}
                        setSetsActive={setSetsActive}
                        activeSet={activeSet}
                        setActiveSet={setActiveSet}
                        zoom={zoom}
                        setZoom={setZoom}
                        onBack={onBack}
                        onOpenAnswerKey={onOpenAnswerKey}
                        onOpenSolutions={onOpenSolutions}
                        onReshuffle={onReshuffle}
                        onOpenMerge={onOpenMerge}
                        onDownloadWord={onDownloadWord}
                        downloadingWord={downloadingWord}
                        onPrint={onPrint}
                        onFinalizeSave={onFinalizeSave}
                        savingPaper={savingPaper}
                    />
                </div>
            )}

            {/* ── TRUE A4 ENGINE RENDERING ── */}
            <A4PaperEngine
                paper={activePaper}
                activeTemplate={activeTemplate}
                isAssignment={isAssignment}
                settings={settings}
                zoom={zoom}
                onDiagramResize={onDiagramResize}
                onEditQuestion={(q, idx, displayNum) => { if (!editingBlockedInSet()) setEditingQuestion({ question: q, index: idx, displayNum }); }}
                onSwapQuestion={(q, idx, displayNum) => { if (!editingBlockedInSet()) setSwappingQuestion({ question: q, index: idx, displayNum }); }}
                onQuestionLayoutChange={handleUpdateQuestionLayout}
            />

            {/* ── INTERACTIVE EDIT & SWAP MODALS ── */}
            <EditQuestionModal
                isOpen={Boolean(editingQuestion)}
                question={editingQuestion?.question}
                questionIndex={editingQuestion?.index}
                displayNum={editingQuestion?.displayNum}
                onClose={() => setEditingQuestion(null)}
                onSave={(updatedQ, idx) => handleSaveEditedQuestion(updatedQ, idx)}
                onDelete={(idx) => handleDeleteQuestion(idx)}
            />
            <SwapQuestionModal
                isOpen={Boolean(swappingQuestion)}
                oldQuestion={swappingQuestion?.question}
                questionIndex={swappingQuestion?.index}
                displayNum={swappingQuestion?.displayNum}
                paperSubject={activePaper?.subject}
                onClose={() => setSwappingQuestion(null)}
                onSwap={(idx, chosenQ) => handleSelectSwappedQuestion(idx, chosenQ)}
                onSelectSwap={(idx, chosenQ) => handleSelectSwappedQuestion(idx, chosenQ)}
            />
        </div>
    );
}
