# Motion and interaction design — paper wizard

Code: `client/src/ui/motion/index.jsx` (the kit) and `client/src/pages/teacher/CommissionedExam.jsx` (where it is used).
Library: `framer-motion` 11. Everything respects the system "reduce motion" setting (`MotionConfig reducedMotion="user"`).

## Principles
1. Nothing blocks the page. Status is a floating pill, never a full-screen loader or a browser `alert()`.
2. Every action has a physical reaction (press squeeze, tilt, slide, stamp).
3. Spatial continuity: steps slide in the direction you are travelling; the active step is one pill that glides.
4. Show state, not just controls: the dock tells you whether the paper is balanced before you press anything.

## Motion language
| Name | Spring | Used for |
|---|---|---|
| press | stiffness 700, damping 30 | button press / hover lift |
| soft | stiffness 260, damping 28 | layout, progress fill |
| bouncy | stiffness 380, damping 18 | step pill, check marks, beam tilt |
| island | stiffness 420, damping 32 | status pill, dock, palette |

Palette stays the existing navy / gold / white of the college brand (already high-contrast); status colours are emerald (done / balanced), red (error).

## Five signature interactions (all live in the wizard)
1. **Gliding step pill** — one gold pill morphs between steps (shared layout), finished steps turn into check marks, a line fills as you progress.
2. **Balance dock** — a floating pill with a scale icon that tilts toward "too many" / "to go" as you change chapter or type counts, rolls the numbers, and settles level and green with the total marks when the counts match.
3. **Status island** — a Dynamic-Island style pill that drops in, morphs from spinner to a drawn check (or a warning), and dismisses itself. Replaces the full-screen loader and the save `alert()`.
4. **Paper seal** — saving stamps a seal onto the screen with a spring thump and a drawn check.
5. **Directional step transition** — moving forward slides the next step in from the right, going back slides from the left.

## Extras (beyond the brief)
6. Command palette, Ctrl/⌘ + K: jump to any finished step, go back, save, leave.
7. Keyboard control in the palette (↑ ↓ Enter Esc) with a gliding highlight.
8. Animated numbers (rolling counters) in the dock.
9. Reduce-motion support for everyone who needs it.
10. Non-blocking saves: the page stays usable while the paper saves.
11. Clearer disabled steps (readable, outlined) instead of faded ones.
12. Subject chips that wrap instead of overlapping on narrow cards.

## Not done (honest list)
- Dark mode: not added. The wizard and paper pages use fixed light Tailwind colours throughout; a proper dark theme needs a token pass over every screen.
- Drag-and-drop reordering of questions and a live "paper assembling" preview: not built yet.
- The "choose acquisition mode" dialog after picking a subject is still a modal.
- Only the teacher paper wizard uses the kit so far; the admin dashboard, saved papers, assignments and student exam screens do not.

## How it was checked
In the browser on the local test server: step slide and rail, command palette (open, list, Esc), dock (balanced → "3 too many"), status island (working message during generation), save (island "Saving paper…" → "Saved to your papers", seal shown, no `alert`). Client tests (57) and the production build pass. There are no automated tests for the animations themselves.
