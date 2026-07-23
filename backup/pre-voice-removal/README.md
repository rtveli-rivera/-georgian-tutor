# Backup: voice exercises (removed 2026-07-23, v1.0.5)

These are the pre-removal copies of every file changed when the TTS-dependent
exercises were taken out of the app (synthetic Georgian voices weren't good
enough on the phone). Also all in git history at tag/commit "Release 1.0.4".

What was removed from the app:
- **Listen & type** exercise (Practice menu + Thursday production slot,
  replaced by Complete-the-dialogue) — `exercises.js` (genListenType,
  EXERCISE_TYPES entry), `exercise.js` (rListenType), `lesson.js` (rotation)
- **Ear-training game** ("which did you hear?") — `pronunciation.js`
  (renderGame)
- **▶ Model / ▶ Model → Me** TTS-comparison buttons in the record widget —
  `exercise.js` (recordCompare)
- **Auto-speak** of sentence cards during reviews — `review.js`

To restore any of it: copy the relevant file back over its counterpart in
`js/` (or cherry-pick from git), run `py bump.py`, commit, push.
Worth restoring if a good Georgian voice ever becomes available on the phone
(e.g. the optional Azure natural-voice feature in Settings, which still works).
