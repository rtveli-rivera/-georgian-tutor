# ქართული — Kartuli Coach

A local, single-user web app that teaches Georgian through structured ~25-minute daily
lessons, built for an English speaker who already reads Mkhedruli and has native
speakers to practice with. No accounts, no cloud, no build step — everything runs
and stays on your machine.

## Run it

Double-click **start.bat** (serves on http://localhost:8144 and opens your browser).
That's it. Requires Python (already installed) — used only as a static file server.

Tests: open http://localhost:8144/tests.html — the SRS scheduler and conjugation
checker suites run in the browser and show green/red.

> **Tip for audio:** use Microsoft Edge — it ships a Georgian (ka-GE) voice for
> text-to-speech. In other browsers, install a Georgian voice via
> Windows Settings → Time & Language → Speech.
>
> **Android:** Google's TTS engine has no Georgian. Install the free **RHVoice**
> app (Play Store), download its Georgian voice (Natia), set it as the preferred
> engine under Settings → Text-to-speech output, then fully close and reopen the
> app. (eSpeak NG also works, more robotically.) **iPhone:** iOS ships no
> Georgian voice at all — audio buttons stay silent there.

## Install it on your phone (PWA)

Same recipe as Plant Tracker: a phone can only install this as a real offline app
over **HTTPS**, so host the folder on a free static host.

**Recommended — GitHub Pages (push-to-deploy):**
1. Create a repo (e.g. `georgian-tutor`) at github.com/new, push this folder.
2. Repo **Settings → Pages → Deploy from branch** (main, root). You get
   `https://<you>.github.io/georgian-tutor/`.
3. Open that URL on your phone:
   - **Android (Chrome):** ⋮ menu → **Install app** / Add to Home Screen.
   - **iPhone (Safari):** Share → **Add to Home Screen**.

It launches full-screen, works fully offline, and keeps working with your PC off.
Netlify Drop (app.netlify.com/drop — drag the folder) works too, but Git hosting
makes updates a one-line `git push`.

**Your progress lives on each device** (cards, streak, recordings are in that
browser's IndexedDB). Settings → Export/… gives you a JSON backup to move state.

### Updating the installed app

```
py bump.py            # bumps APP_VERSION + the sw.js cache version (required!)
git commit -am "release"
git push              # GitHub Pages redeploys the same URL
```

The installed app checks for a new version on reopen/focus (and hourly) and shows
a "🍇 new version ready — Update" banner; one tap swaps it in. Skipping `bump.py`
means phones keep the old cached version.

## Daily lesson reminders (no server)

Turn them on in **Settings → Daily lesson reminder** (it asks for notification
permission). The rules, identical to Plant Tracker's reminder engine:

- **At most one nudge per calendar day**, and none once today's lesson is done.
- The copy escalates: normal day → "Today's lesson is waiting"; active streak →
  "Keep your 🔥 N-day streak alive"; streak at risk → a firmer nudge.
- **Android, installed as an app:** Periodic Background Sync wakes the service
  worker roughly daily, so the reminder arrives even with the app closed.
- **iPhone / desktop:** reminders fire when the app is open or reopened (hourly
  re-check while open). Apple doesn't allow background notifications without a
  push server, and this app deliberately has no server.

## The daily lesson (~25 min)

1. **2' warm-up** — shadow 3 sentences from yesterday (TTS model + record-and-compare).
2. **8' reviews** — SM-2 spaced repetition, word cards and sentence cards interleaved.
   Keyboard: **Space** flips, **1–4** grades (Again / Hard / Good / Easy).
3. **8' new material** — a grammar micro-lesson (Mon/Thu) or 6–8 new words, always
   introduced through a short everyday-Tbilisi dialogue.
4. **5' production** — rotating exercise: translation, conjugation slot machine,
   unscramble, listen-and-type, register switch; Wednesday = cluster ladder,
   Saturday = 60-second free talk (recorded and archived).
5. **2' speaker mission** — a concrete task for your next conversation with a native
   speaker, with the phrases you'll need and the questions they may ask back.
   Log what tripped you up; future lessons lean into it.

## Curriculum (communicative order, not textbook order)

- **W1–4 Foundations:** ვარ, მაქვს/მყავს, მინდა/ვიცი, questions, numbers, politeness.
- **W5–10 The Present Machine:** subject markers (ვ- team), object markers (მ-/გ-/გვ-),
  postpositions -ში/-ზე/-თან, genitive.
- **W11–20 Future & Past:** future via preverbs, მი-/მო- deixis, then the aorist —
  and only then the ergative, taught as the subject's "past-tense costume" (-მა).
- **W21–26 Deep Georgian:** perfect series (the flipped construction), the "to-me"
  feeling verbs (მიყვარს family), conditional, უნდა.
- **W27+:** consolidation, storytelling, supra mastery, vocabulary to 600+.

Screeve names never appear in the UI — tenses are labeled plainly (present, future,
past, have-done).

## Content

All seed content is plain, editable JSON in `data/`:

| file | contents |
|---|---|
| `vocab1/2/3.json` | 600 frequency-ranked words, each with **2 example sentences** |
| `dialogues1/2.json` | 40 dialogues (supra, marshutka, bazaar, café, in-laws…) |
| `verbs1/2.json` | conjugation tables for the 80 most frequent verbs (present/future/past/have-done) |
| `grammar.json` | 26 grammar micro-lessons with drills |
| `curriculum.json` | the 52-week map |
| `speaker_tasks.json` | 30 native-speaker missions |
| `register.json` | შენ↔თქვენ switching drills |
| `pronunciation.json` | ejective/aspirate contrasts, minimal pairs, cluster ladders |

Georgian verb morphology is irregular; forms the authors were less sure about carry a
**⚑ verify with speaker** flag in the UI — confirm those with your in-laws and edit
the JSON (or toggle the flag in Library). Words they teach you can be added in
**Library → Add word** (two example sentences required — house rule).

## Where your data lives

Learning state (cards, review history, streak, mission logs, recordings) is stored in
IndexedDB in your browser profile, recordings included — nothing leaves the machine.
Settings → Export writes a JSON backup.

## Architecture

Vanilla ES modules, no dependencies.

- `js/srs.js` — SM-2 scheduler (pure functions; tested)
- `js/conjugation.js` — checker for the conjugation slot machine (tested)
- `js/lesson.js` — daily lesson generator (deterministic per date)
- `js/exercises.js` — exercise bank generators
- `js/tts.js` / `js/recorder.js` — Web Speech ka-GE + MediaRecorder
- `js/db.js` — IndexedDB wrapper
- `js/views/*` — UI (Today wizard, Review, Practice, Sounds, Speak, Progress, Library, Settings)
