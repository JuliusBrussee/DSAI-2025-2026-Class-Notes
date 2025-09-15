# DSAI 2025-2026 Class Notes

A modern, responsive web application for organizing and viewing DSAI (Data Science and Artificial Intelligence) class notes at Leiden University.

**🌐 Live Website:** [https://juliusbrussee.github.io/DSAI-2025-2026-Class-Notes/](https://juliusbrussee.github.io/DSAI-2025-2026-Class-Notes/)

## Features

- 📚 **Organized Course Structure**: Year 1 Semester 1 courses including Calculus, Programming, AI Foundations, and Study Skills
- 🧮 **Mathematical Content Support**: Full LaTeX equation rendering with MathJax
- 🌓 **Dark/Light Theme**: Toggle between themes for comfortable reading
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- 🧪 **Interactive Quizzes**: Per‑lecture quizzes with explanations and local history
- 🔍 **Enhanced Search**: Boosted titles/headings + snippets with keyboard nav
- 🔗 **Deep Links**: Link to a file (`#file`), quiz (`#quiz`), or query (`#q`)
- 📂 **Collapsible Navigation**: Persistent folder tree (expand/collapse all)

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/JuliusBrussee/DSAI-2025-2026-Class-Notes.git
cd DSAI-2025-2026-Class-Notes
```

2. Start a local server:
```bash
python3 -m http.server 8000
```

3. Open your browser and navigate to `http://localhost:8000`

## About

Class notes and study materials for the Data Science and Artificial Intelligence (DSAI) program, academic year 2025–2026, at Leiden University. These are personal notes and may contain mistakes; they are not official course materials. 

## Repository Structure

```
Year1/
  Semester1/
    <Course Name>/
      Lectures/
        Lecture_<N>[_ShortTopic][.md]
      ExamPrep.md
      Notes.md
      assets/                (optional; images/diagrams)
  Semester2/
Year2/
Year3/
```

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Math Rendering**: MathJax 3
- **Markdown Processing**: Showdown.js
- **Search**: Lunr.js
- **Icons**: Font Awesome 6
- **Hosting**: GitHub Pages

## New UX Highlights

- Course cards open a course screen with a file grid and per‑file “Quiz/No quiz” badges.
- Sidebar always shows the full folder tree and auto‑expands/highlights the active file.
- Copy link button in the content toolbar for sharing the current file.

## Deep Links

- Open a file: `#file=Year1/Semester1/<Course>/Lectures/<Lecture>` (with or without `.md`).
- Open a quiz: `#quiz=quizzes/Year1/Semester1/<Course>/Lectures/<Lecture>.json`.
- Restore a search: `#q=<your query>`; results panel appears on load.

Examples:

- `#file=Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_3_DSIP`
- `#quiz=quizzes/Year1/Semester1/Calculus 1/Lectures/Lecture_1&2_Calculus.json`
- `#q=two's complement`

---

**Created by [Julius Brussee](https://github.com/JuliusBrussee)** | Leiden University DSAI Program

## Naming Conventions

- Directories: Title Case with spaces allowed (e.g., `Calculus 1`, `Orientation AI`). Avoid special characters beyond spaces, digits, and letters.
- Lecture files: `Lecture_<N>[_ShortTopic].md` (e.g., `Lecture_1_DSIP.md`, `Lecture_1&2_Calculus.md`). Use underscores instead of spaces within filenames.
- General course notes: `Notes.md` for miscellaneous notes not tied to a single lecture.
- Exam preparation: `ExamPrep.md` for summaries, key formulas, definitions, and practice checklists.

## Content Conventions (Markdown)

- Start each note with a top-level heading and, optionally, the date.
- Use the following sections when helpful:
  - Summary
  - Learning goals
  - Key concepts / Definitions
  - Worked examples / Exercises
  - References / Links
- Use fenced code blocks for code or pseudocode. Example:

  ```
  ```python
  def example():
      return 42
  ```
  ```

- For math, GitHub supports inline `$...$` and block `$$...$$` LaTeX. Keep formulas concise and readable.
- Images/diagrams: place under an `assets/` folder inside the course or lecture folder, and link with relative paths, e.g., `![Title](assets/filename.png)`.

## Add or Edit Quizzes

Quizzes live under a mirrored path of the lecture file in the `quizzes/` directory. The site automatically shows a “Start Quiz” banner on a lecture page if a matching quiz JSON exists.

- Location: `quizzes/<lecture path>.json` (lecture path without `.md`)
- Example: for `Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_1_DSIP`, add
  `quizzes/Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_1_DSIP.json`

Minimal JSON:

```
{
  "id": "y1s1-dsip-lecture-1",
  "lecturePath": "Year1/Semester1/Introduction to Digital Skills and Programming/Lectures/Lecture_1_DSIP",
  "title": "Lecture 1 — ...",
  "settings": { "shuffleQuestions": true, "shuffleOptions": true, "showImmediateFeedback": true },
  "meta": { "version": 1, "lastUpdated": "YYYY-MM-DD", "author": "..." },
  "questions": [
    {
      "id": "q1",
      "type": "single",                      
      "prompt": "... (Markdown + MathJax)",
      "options": [ { "id": "a", "text": "...", "isCorrect": true } ],
      "explanation": "Why this is correct.",
      "tags": ["topic"], "difficulty": "easy", "points": 1
    }
  ]
}
```

Finish behavior: the quiz shows Back/Next, and only on the last question a “Finish” button appears. Finishing clears in‑progress answers so a new attempt starts fresh.

## How to Add Content

### Add a new course

1. Create the course directory under the correct semester.
2. Add subfolders/files as needed:
   - `Lectures/`
   - `ExamPrep.md`
   - `Notes.md`
   - Optional: `Assignments/`, `assets/`

### Add a lecture note

1. Create a new file in the course’s `Lectures/` folder using the naming convention.
2. Start with a heading and brief summary; add learning goals and key concepts.
3. Commit with a clear message.

Template:

```
# Lecture <N>: <Topic>

Date: YYYY-MM-DD

## Summary
<2–4 lines>

## Learning goals
- ...
- ...

## Key concepts
- Term — definition
- ...

## Commit Message Style

- Use concise, descriptive messages. Suggested pattern:
  - `Year1/<Course>: Lecture_<N> - <Topic> (<short summary>)`
  - `Year1/<Course>: update ExamPrep (sections + examples)`


## Roadmap / TODO

- Fill out currently empty `ExamPrep.md` files in `Year1/Semester1`.
- Prefer `.md` extensions for new lecture notes
- Add `Semester2` structure and placeholders when schedules are confirmed.
- Add assets (figures/diagrams) to each course as needed and fix any “attachment:” style links by moving images into an `assets/` folder.

## Notion → Repo → Quiz workflow (optional)

You can import notes exported from Notion and auto‑generate quizzes for each lecture.

- Quick import (manual export):
  1) In Notion, Export → Markdown & CSV for the pages you want.
  2) Run the ingest script to place files into this repo structure:
     - Example: `python scripts/ingest_notion_export.py --source path/to/export.zip --default-year Year1 --default-semester Semester1`
     - Optional mapping: `--course-map scripts/config/course_map.example.yaml`
     - Dry run first: add `--dry-run`.

- Generate quizzes from notes:
  - `python scripts/generate_quizzes_from_md.py --root Year1 --out quizzes` (add `--force` to overwrite existing)
  - Heuristics supported:
    - Bullet definitions like `- Term: definition` produce multiple‑choice questions.
    - Q/A lines like `Q: ...` then `A: ...` produce short‑text questions.

- Auto on push:
  - See `.github/workflows/generate-quizzes.yml` for a sample (commented). Enable and adapt as needed.

### Tips for better quiz generation
- Use clear definition bullets: `- Term: concise definition` or `- **Term**: definition`.
- Add explicit Q/A lines where you want guaranteed questions.
- Keep definitions under ~280 chars for cleaner options.

### Advanced (Notion API sync)
Prefer true sync from Notion? Add a Notion integration and use a custom fetch script with the Notion API (requires secrets like `NOTION_TOKEN`). This repo ships a simple manual‑export importer for reliability; happy to scaffold an API pull workflow on request.

## Disclaimer and License

These are personal study notes intended for learning and revision. They may contain errors or omissions and are not official course materials.
