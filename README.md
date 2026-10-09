# SyncShift

**Asynchronous EA Dispatch & Dual-Timezone Command Center** for a UK founder and a Philippines-based EA.

## Architecture
- **Dual timezone:** `Intl.DateTimeFormat` with `Europe/London` (auto BST/GMT) and `Asia/Manila`. Overlap = UK 06:00-11:00, mapped onto a 24h PHT track, so the bar shifts correctly when the UK changes clocks.
- **Nudge engine:** hours since last contact; > 48h and not Closed raises an amber (red > 72h) badge.
- **Dispatch:** Web Speech API (falls back to typing) then a regex parser to category, urgency and PHT due time.
- **Storage:** `localStorage` key `syncshift.v1`, seeded on first load.
- **Offline:** cache-first `sw.js` at root scope.

## Deploy
Push to `main`; enable Pages > Source: GitHub Actions. Replace `YOUR-USER` in `sitemap.xml`/`robots.txt`, and the placeholders in `.well-known/`.

MIT licensed.

## Shared backend (v1.1)
See `backend/Code.gs` (paste into Extensions > Apps Script in the sheet, deploy as Web app). Set `CFG.url` / `CFG.token` at the top of `js/app.js`. The URL and token are visible in the public JS, so keep the sheet free of sensitive data.

SyncShift is a specialized web application designed to help a business founder and their Executive Assistant work together seamlessly across different countries and time zones. Its primary purpose is to stop important tasks, ideas, and follow-up messages from getting lost in crowded email inboxes or text message conversations. Instead of forcing a busy business owner to fill out complex spreadsheets, this application acts as a clean, shared digital desk that automatically organizes their thoughts into actionable steps.

The application is built to be extremely easy to understand and navigate. At the very top of the screen, a visual time tracker shows the current time in both the United Kingdom and the Philippines. It clearly highlights the exact hours when both people are awake and working at the same time, which completely removes the confusion of scheduling meetings.

Below the time tracker, there is a simple text box called the Brain Dump. The business founder can type a natural, everyday sentence like, "Book a restaurant for tomorrow night," and press one button. The application is smart enough to automatically categorize the task, assign a deadline, and place it directly into the Executive Assistant's organized list.

The middle section of the screen holds this daily task list, which is automatically sorted so the most urgent items always remain at the top. When the Executive Assistant completes an assignment, they simply click a button labeled "Done," and the shared database updates instantly for the founder to see. At the end of the day, the assistant can click a single button to generate a perfectly formatted summary report of everything that was accomplished.

At the bottom of the screen, there is a follow-up tracker for external relationships. If the assistant contacts a client or a job candidate and does not receive a reply for forty-eight hours, the application provides a clear visual warning to remind the assistant to send another message.

Ultimately, this application is necessary because standard spreadsheets are difficult to read on mobile phones and require too much manual clicking to update. This application solves those problems by providing a fast, mobile-friendly screen that even saves your work when the internet connection is temporarily lost. It handles all the administrative organization automatically, which gives the Executive Assistant more free time to focus on completing the actual work for the business.
