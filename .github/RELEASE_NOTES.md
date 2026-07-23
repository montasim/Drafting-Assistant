## What’s new in v0.1.3

- Rebuilt the extension as **Thoughtline**, with dedicated Reply, Generate, Ideas, History, and Settings views in a responsive Chrome side panel.
- Added staged LinkedIn analysis with bilingual summaries and four independently editable reply directions: Insight, Question, Extend, and Challenge.
- Added sourced idea research across Hacker News, DEV, Medium, Lobsters, and Stack Overflow, plus editable posts based on research or the user's own experience.
- Added searchable and editable work history, data import and export, storage recovery, session workspace restoration, and incognito-safe persistence boundaries.
- Added explicit AI-processing consent, on-demand site permissions, AES-256-GCM credential encryption, reviewable writing preferences, and local LinkedIn PDF profile extraction.
- Added Gemini-first generation with one Groq fallback, typed provider and source boundaries, untrusted-content isolation, and guarded LinkedIn layout calibration.
- Added production onboarding and Terms views together with unit, real-writer journey, visual-regression, responsive, accessibility, and AI response-quality coverage.

## Install in Chrome

1. Download the Chrome ZIP and `SHA256SUMS.txt` attached to this release.
2. Place both files in the same folder and verify the archive:

   ```bash
   sha256sum --check SHA256SUMS.txt
   ```

3. Extract the ZIP to a permanent folder.
4. Open `chrome://extensions` in Chrome 120 or later.
5. Enable **Developer mode**.
6. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
7. Open Thoughtline and complete setup. Reload any LinkedIn tabs that were already open.

Chrome loads Thoughtline from the extracted folder, so do not delete that folder while the extension is installed. GitHub installations do not update automatically; download, verify, and load each newer release when one becomes available.
