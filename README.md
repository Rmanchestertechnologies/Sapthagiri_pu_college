# 🏛️ Sapthagiri PU College — Enterprise Examination & Assessment Portal
> **Davanagere • The Land of Opportunity**  
> *Production-Grade Question Paper Generator, 4-Set PQRS Engine, OMR Scanner & Computer-Based Testing System*

---

## 📑 Table of Contents
1. [Executive Overview](#-executive-overview)
2. [Key Capabilities & Modules](#-key-capabilities--modules)
   - [1. Question Paper Generator (QPG) Wizard](#1-question-paper-generator-qpg-wizard)
   - [2. A4 High-Fidelity Paper Engine](#2-a4-high-fidelity-paper-engine)
   - [3. Institutional Answer Key & Solution Guide](#3-institutional-answer-key--solution-guide)
   - [4. Section-Aware 4-Set PQRS Permutation Engine](#4-section-aware-4-set-pqrs-permutation-engine)
   - [5. Multi-Subject Exam Merge Engine](#5-multi-subject-exam-merge-engine)
   - [6. Assignment Generation Suite](#6-assignment-generation-suite)
   - [7. Computer Vision & ML OMR Engine](#7-computer-vision--ml-omr-engine)
   - [8. Online CBT Lab Examination Portal](#8-online-cbt-lab-examination-portal)
3. [System Architecture & Multi-Database Topology](#-system-architecture--multi-database-topology)
4. [Tech Stack & Engineering Standards](#-tech-stack--engineering-standards)
5. [Directory & Codebase Map](#-directory--codebase-map)
6. [API Endpoints Reference](#-api-endpoints-reference)
7. [Environment Configuration](#-environment-configuration)
8. [Installation & Local Setup](#-installation--local-setup)
9. [Production Deployment & Build](#-production-deployment--build)
10. [Academic Integrity & Institution Branding](#-academic-integrity--institution-branding)

---

## 🌟 Executive Overview
The **Sapthagiri PU College Examination Platform** is an institutional assessment, curriculum management, and evaluation suite custom-built for **Sapthagiri Pre-University College, Davanagere**.

Engineered to replace manual exam authoring and fragmented tools, it delivers an end-to-end digital pipeline for:
- Formulating authentic **PUC Board, KCET, NEET, and JEE Main** question papers.
- Auto-fetching questions strictly balanced by **chapter quotas, difficulty levels, and pedagogical question types**.
- Rendering print-perfect A4 papers featuring the college's official circular emblem watermark, typography, and KaTeX mathematical typesetting.
- Generating randomized 4-Set (`P, Q, R, S`) papers with recalculated answer keys and step-by-step solution guides.
- Automated optical mark recognition (OMR) grading powered by computer vision and deep learning.

---

## ⚡ Key Capabilities & Modules

### 1. Question Paper Generator (QPG) Wizard
A guided 7-step wizard (`CommissionedExam.jsx`) ensuring full curriculum coverage:
* **Step 1: Subject Selection**: Physics, Chemistry, Mathematics, Biology, Botany, Zoology, or competitive combinations (NEET PCBZ, JEE PCM, CET PCMB).
* **Step 2: Generation Mode**:
  * **Auto-Fetch**: Algorithmic question retrieval and balancing.
  * **Manual Selection**: Interactive browse-and-pick mode from live question pools.
* **Step 3: Syllabus & Concept Filtering**: Class 11 (I PUC), Class 12 (II PUC), or Both; multi-chapter selection with granular concept tags.
* **Step 4: Chapter Quotas**: Precise allocation of questions per chapter (e.g., Chapter 1: 15, Chapter 2: 15) with smooth non-snapping backspace input editing.
* **Step 5: Question Type Allocations & Difficulty Balance**:
  * Question Types: Standard MCQ, Assertion & Reasoning ($A/R$), Match the Following (2-column Roman/Numeric matrix), Statement-Based (Statement I, II, III), Diagrammatic, and JEE Numerical ($Integer$).
  * Difficulty Sliders: Easy, Medium, and Hard balancing strictly to 100%.
* **Step 6: Real-Time Assembly**: Dedicated multi-chapter parallel query execution guaranteeing that questions are strictly balanced across all selected chapters without bias toward any single chapter.
* **Step 7: Final Paper Composition**: Real-time live preview with immediate access to swap, edit, reorder, or delete questions.

### 2. A4 High-Fidelity Paper Engine
Driven by `A4PaperEngine.jsx` and `PaperRenderer.jsx`:
* **Continuous Layout**: True-to-scale A4 dimensions ($794\text{px} \times 1123\text{px}$ per page) with auto-overflow pagination.
* **Layout Modes**: Seamless toggle between **1-Column** (Standard Board/NEET) and **2-Column** (KCET/JEE Magazine style) presentation.
* **Institution Watermark**: Faint official Sapthagiri PU College campus crest centered on every page with reactive opacity ($0\text{--}30\%$) and scale controls.
* **Interactive Diagram Resizing**: In-preview diagram scaling ($100\text{px}\text{--}500\text{px}$ or Auto) and alignment (`Center`, `Float Left`, `Float Right`, `Below Question`).
* **Options Layout**: Configurable options per line (1 column stacked, 2-column $2\times 2$ grid, or inline 4 options).
* **Question Swap Modal**: Cascading dropdown filter (`Chapter` $\to$ `Concept` $\to$ `Type` $\to$ `Difficulty Level`) allowing teachers to swap unwanted questions with instant notification.
* **Rich LaTeX / KaTeX Typesetting**: Native rendering for complex mathematical integrals, chemical reaction arrows, matrices, and sub/superscripts.

### 3. Institutional Answer Key & Solution Guide
* **Official Institutional Grid (`A4AnswerKey.jsx`)**:
  * Standard 15-column-per-row grid matching Karnataka State PU Board & CET office protocols.
  * Left-hand subject identifier (`PHY`, `CHEM`, `MATH`, `BIO`, `BOT`, `ZOO`).
  * Display toggle: Numeric (`1, 2, 3, 4`) or Alphabetical (`A, B, C, D`).
  * Instant vector PDF export (`jspdf-autotable`) and Microsoft Excel export (`.xlsx` via SheetJS).
  * Interactive inline key editor with database persistence.
* **Comprehensive Solution Guide (`A4SolutionKey.jsx`)**:
  * Full step-by-step explanations, intermediate formulas, and diagram references for every question in the paper.
  * Formatted print and PDF output.
* **Customized Question Numbering**:
  * Supports custom starting question numbers (e.g., start numbering from `Q.10` $\to$ `10, 11, 12...`).
  * The question paper preview, printed exam, Answer Key, and Solution Guide automatically synchronize to the custom start number.

### 4. Section-Aware 4-Set PQRS Permutation Engine
Implemented in `pqrsGenerator.js`:
* **Set P**: Original master order.
* **Set Q**: Deterministic question shuffling within each subject section.
* **Set R**: Option shuffling with automatic recalculation of correct answer indices.
* **Set S**: Double permutation (both questions and options permuted independently).
* Strict preservation of custom `startQNo` across all 4 sets.

### 5. Multi-Subject Exam Merge Engine
* Allows academic directors to combine individual department papers (e.g., 45 Qs Physics + 45 Qs Chemistry + 45 Qs Botany + 45 Qs Zoology) into a single master **180-Question NEET Grand Assessment** or **CET Combined Paper** with unified headers, continuous numbering, and combined answer key.

### 6. Assignment Generation Suite
* Dedicated mode (`AssignmentGenerator.jsx`) for daily homework, weekly problem sheets, and vacation assignments.
* Automatic student metadata block: Student Name, Roll Number, Section, Date, and Teacher's Signature line.

### 7. Computer Vision & ML OMR Engine
Located in `server/omr_engine/`:
* **Multi-Format Processing**: Supports NEET (200 questions / 4 subjects), KCET (60 questions), and JEE Main (75 questions).
* **Pre-Processing Pipeline**: Perspective warp, affine alignment, edge detection, and thresholding.
* **Deep Learning Classifier**: Keras/ONNX convolutional neural network classifying filled, partially filled, and erased bubbles.
* **Student Identity Detection**: Automatic extraction of student SAT/Enrollment numbers from bubble grids.
* **Analytics**: Generates batch score summaries, subject-wise percentiles, and chapter-level weakness diagnostics.

### 8. Online CBT Lab Examination Portal
* Computer-Based Test engine (`ExamEngine.jsx` & `StudentLabPortal.jsx`) supporting real-time timed tests.
* Full-screen lock, tab switch detection, auto-save timers, and immediate scorecard generation.

---

## 🏛️ System Architecture & Multi-Database Topology

To guarantee high availability and sub-second query speeds across tens of thousands of competitive exam questions, the platform implements a **distributed multi-database routing architecture**:

```mermaid
graph TD
    Client["React 18 + Vite Frontend"] -->|"REST API / JWT"| Server["Node.js / Express Server"]
    Server --> MainDB[("Main PostgreSQL DB\n(Users, Papers, Templates, Blueprints)")]
    Server --> RoutingService["supabaseQuestions Routing Engine"]
    
    RoutingService -->|"Physics Qs"| PhyPool[("DB_PHY_11 & DB_PHY_12")]
    RoutingService -->|"Chemistry Qs"| ChemPool[("DB_CHEM_11 & DB_CHEM_12")]
    RoutingService -->|"Maths Qs"| MathPool[("DB_MATH_11 & DB_MATH_12")]
    RoutingService -->|"Biology Qs"| BioPool[("DB_BIO_11 & DB_BIO_12")]
    
    Server --> OMREngine["Python OpenCV/Keras OMR Engine"]
    OMREngine --> Cloudinary["Cloudinary CDN (Diagrams & Scans)"]
```

### Database Responsibilities:
1. **Primary Database (`DATABASE_URL`)**: Stores administrative users, faculty accounts, saved question papers (`public.papers`), layout settings, audit logs, and notification records.
2. **8 Dedicated Subject Repositories**:
   - `DB_PHY_11_URL` / `DB_PHY_12_URL`: Class 11 and Class 12 Physics question banks.
   - `DB_CHEM_11_URL` / `DB_CHEM_12_URL`: Class 11 and Class 12 Chemistry question banks.
   - `DB_MATH_11_URL` / `DB_MATH_12_URL`: Class 11 and Class 12 Mathematics question banks.
   - `DB_BIO_11_URL` / `DB_BIO_12_URL`: Class 11 and Class 12 Biology (Botany & Zoology) question banks.

---

## 💻 Tech Stack & Engineering Standards

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, Vite 6, Tailwind CSS |
| **Mathematical Rendering** | KaTeX, custom LaTeX equation sanitizers |
| **Document Generation** | jsPDF, `jspdf-autotable`, SheetJS (`xlsx`), `docx` (Word export), html2canvas |
| **Icons & UI** | Lucide React |
| **Backend Runtime** | Node.js (v18+ / v20+ / v24+), Express.js |
| **Database Clients** | `pg` (Node-Postgres Connection Pooling), `@supabase/supabase-js` |
| **OMR Engine** | Python 3.10+, OpenCV, Keras, ONNX Runtime, NumPy |
| **Authentication** | Stateless JWT tokens, bcrypt password hashing |
| **Cloud Storage** | Cloudinary CDN for diagram and scan storage |

---

## 📁 Directory & Codebase Map

```
SAPTHAGIRI_PU_COLLEGE/
├── client/                                 # Frontend React application
│   ├── public/                             # Public static assets (crest, campus logos)
│   ├── src/
│   │   ├── components/                     # Core reusable UI components
│   │   │   ├── A4AnswerKey.jsx             # Institutional 15-col Answer Key table & exports
│   │   │   ├── A4PaperEngine.jsx           # Continuous A4 paper preview & layout engine
│   │   │   ├── A4SolutionKey.jsx           # Comprehensive solution explanations view
│   │   │   ├── MathRenderer.jsx            # KaTeX LaTeX math typesetting wrapper
│   │   │   ├── PaperQuestionEditorModals.jsx# Question edit & cascading swap modals
│   │   │   ├── PaperRenderer.jsx           # Live interactive preview & toolbar controls
│   │   │   ├── QuestionBlock.jsx           # Card renderer for MCQ, AR, Match, Stmt
│   │   │   ├── QuestionImage.jsx           # Resilient image loader with error handling
│   │   │   └── ResizableDiagram.jsx        # Interactive diagram resize & float control
│   │   ├── pages/
│   │   │   ├── admin/                      # Admin dashboard, blueprints, paper preview
│   │   │   ├── teacher/                    # Teacher dashboard, CommissionedExam, OMR
│   │   │   ├── exam/                       # Online CBT exam engine & scorecards
│   │   │   └── auth/                       # Unified login interface
│   │   ├── utils/
│   │   │   ├── pqrsGenerator.js            # 4-Set (P, Q, R, S) shuffling algorithm
│   │   │   └── sanitize.js                 # HTML/LaTeX sanitization helpers
│   │   ├── App.jsx                         # Application router & route guards
│   │   └── main.jsx                        # React root entry point
├── server/                                 # Backend Node.js / Express service
│   ├── config/                             # Subject database pools & connection maps
│   ├── middleware/                         # Authentication & RBAC role guards
│   ├── models/                             # Data models & schemas
│   ├── routes/                             # Express REST API controllers
│   │   ├── admin.js                        # Admin stats & faculty management
│   │   ├── auth.js                         # Login, token validation, user profile
│   │   ├── exams.js                        # Exam creation & submission handling
│   │   ├── omr.js                          # OMR scanning bridge & evaluation
│   │   ├── papers.js                       # Question paper CRUD & persistence
│   │   └── questions.js                    # Question search, filtering & auto-fetch
│   ├── services/
│   │   ├── postgresStorage.js              # Primary database storage procedures
│   │   ├── supabaseQuestions.js            # Multi-pool query router & question mapper
│   │   ├── wordExport.js                   # High-fidelity Microsoft Word (.docx) export
│   │   └── pdfPaperExport.js               # Direct server-side PDF generator
│   ├── omr_engine/                         # Python CV / ML OMR scoring pipeline
│   └── server.js                           # Express entry point & middleware setup
└── README.md                               # Project documentation
```

---

## 🔌 API Endpoints Reference

### 1. Authentication (`/api/auth`)
- `POST /api/auth/login`: Authenticate admin, teacher, or student credentials.
- `GET /api/auth/me`: Retrieve currently authenticated user context from JWT.

### 2. Question Paper Generation (`/api/papers`)
- `GET /api/papers`: List all saved papers (with subject/exam type filters).
- `GET /api/papers/:id`: Fetch complete question paper payload by ID.
- `POST /api/papers`: Save newly generated or commissioned question paper.
- `PUT /api/papers/:id`: Update question paper content, layout settings, or answer keys.
- `DELETE /api/papers/:id`: Permanently delete a question paper.
- `POST /api/papers/:id/export/word`: Download editable `.docx` document.

### 3. Question Bank & Repository (`/api/questions`)
- `GET /api/questions`: Query questions by subject, class, chapter, concept, type, and difficulty.
- `GET /api/questions/metadata`: Get syllabus taxonomy (distinct chapters and concepts for selected subject).
- `GET /api/questions/:id`: Fetch individual question details.

### 4. OMR Evaluation (`/api/omr`)
- `POST /api/omr/scan`: Upload scanned answer sheet image for CV/ML evaluation.
- `GET /api/omr/results/:examId`: Retrieve class result sheet and student scores.

---

## ⚙️ Environment Configuration

Create a `.env` file in the `server/` directory containing the following keys:

```env
# ── Server Core ──
PORT=5000
NODE_ENV=production
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
ADMIN_PASSWORD=your_admin_master_password
ALLOWED_ORIGINS=http://localhost:5173,https://your-production-domain.com

# ── Primary Database (PostgreSQL / Supabase) ──
DATABASE_URL=postgresql://user:password@host:5432/postgres?sslmode=require
DIRECT_DATABASE_URL=postgresql://user:password@host:5432/postgres?sslmode=require
SUPABASE_URL=https://your-project.supabase.co

# ── Dedicated Subject Question Databases ──
DB_PHY_11_URL=postgresql://user:password@host:5432/physics_11?sslmode=require
DB_PHY_12_URL=postgresql://user:password@host:5432/physics_12?sslmode=require
DB_CHEM_11_URL=postgresql://user:password@host:5432/chemistry_11?sslmode=require
DB_CHEM_12_URL=postgresql://user:password@host:5432/chemistry_12?sslmode=require
DB_MATH_11_URL=postgresql://user:password@host:5432/maths_11?sslmode=require
DB_MATH_12_URL=postgresql://user:password@host:5432/maths_12?sslmode=require
DB_BIO_11_URL=postgresql://user:password@host:5432/biology_11?sslmode=require
DB_BIO_12_URL=postgresql://user:password@host:5432/biology_12?sslmode=require
```

---

## 🚀 Installation & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10+ (required only if running the OMR OpenCV service locally)

### Setup Steps
```bash
# 1. Clone repository
git clone https://github.com/Rmanchestertechnologies/Sapthagiri_pu_college.git
cd Sapthagiri_pu_college

# 2. Install Server Dependencies
cd server
npm install
cd ..

# 3. Install Client Dependencies
cd client
npm install
cd ..

# 4. Start Development Servers
# Terminal 1: Backend Server
cd server
npm run dev

# Terminal 2: Frontend Client
cd client
npm run dev
```

- **Frontend Client**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`

---

## 📦 Production Deployment & Build

To compile the React client for production hosting:

```bash
# Build frontend
npm --prefix client run build
```
The compiled bundle will be output to `client/dist`, ready for static hosting or deployment via Vercel / Nginx.

---

## 🎓 Academic Integrity & Institution Branding
* **Institution**: Sapthagiri Pre-University College
* **Location**: Davanagere, Karnataka, India
* **Tagline**: *The Land of Opportunity*
* **Copyright**: © 2026 Sapthagiri PU College. All Rights Reserved.
