# 🏛️ Sapthagiri PU College — Question Paper Generator (QPG)
> **Davanagere • The Land of Opportunity**  
> High-Fidelity Institutional Assessment & Assignment Generation Platform

---

## 🌟 Overview
This platform is a dedicated, production-grade assessment engine engineered specifically for **Sapthagiri PU College, Davanagere**. It empowers academic administrators and faculty across the PCMB departments (Physics, Chemistry, Mathematics, Biology) to compose, customize, balance, and export board-standard examination papers, grand tests, assignments, and PYQs with 100% print fidelity and zero formatting errors.

---

## ✨ Key Features
- **Sapthagiri PU College Crest & Header**: Every generated paper, PDF, and assignment features the official college logo and header typography.
- **Authentic Campus Watermark**: The iconic Sapthagiri PU College campus is embedded as an elegant, subtle watermark on printable sheets with opacity controls.
- **Universal PCMB Support**: Strict syllabus mapping across 1st and 2nd PUC Physics, Chemistry, Mathematics, and Biology.
- **Multi-Format Question Bank**: Support for Single-Choice MCQs, Assertion-Reason, Statement-Based, Matching Lists, Diagrams, and Numerical types with native KaTeX mathematical typesetting.
- **A4 Continuous Layout Engine**: 1-Column and 2-Column layouts adhering to Karnataka Pre-University Board, KCET, JEE Main, and NEET formats.
- **Assignment Generator**: Dedicated clean assignment generation mode with student name, roll number, and date headers.
- **Grand Tests & PYQs**: Centralized archive of grand test papers and previous year board examination papers.
- **Real-Time Notification System**: Faculty notification bell for exam commissions, paper submissions, and approval status.
- **Zero Testing Module Clutter**: Cleaned and optimized purely for question paper generation and faculty academic workflows.

---



---

- **Tables**:
  - `public.users`: Faculty and administrator accounts with bcrypt encryption.
  - `public.papers`: Generated question papers, questions payload (JSONB), and layout settings.
  - `public.templates`: Layout templates, custom headers, and typography preferences.
  - `public.exam_blueprints`: KCET, JEE, NEET, and Board blueprint configurations.
  - `public.notifications`: Administrative broadcast alerts and submission notifications.
  - `public.audit_logs`: Audit trail for question generation and paper modifications.
  - `public.grand_test_papers`: Grand test records and PDF attachments.
  - `public.previous_year_papers`: Previous year paper repository.

To re-run migrations at any time:
```bash
npm run init:db
```

---



---

## 💻 Local Development
```bash
# 1. Install dependencies
npm --prefix client install
npm --prefix server install

# 2. Run both server and client in development mode
npm run dev

# 3. Open browser
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

---
© 2026 Sapthagiri PU College, Davanagere. All rights reserved.
