# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What this is

A static single-page web app: a hunting logbook for Monster Hunter Generations Ultimate.
The user picks a quest and records what they were after, what they wore, who came along and
how it went; entries accumulate into a running log they can copy out as plain text.

No build step, no framework, no modules. `docs/app.js` is one IIFE, `docs/styles.css` is
hand-written, `docs/data.js` is generated.

**Live:** https://armoredraven17.github.io/MHGU-Hunting-Log/ (GitHub Pages serves `docs/`).

## Relationship to the other MHGU apps

This is a **standalone app**. It shares no runtime state with the
[MHGU Quest Randomizer](https://github.com/ArmoredRaven17/MHGU-Quest-Randomizer), MHGU
Bingo or the Collection Tracker — different origin, different localStorage keys, different
save files. It borrows two things from the Randomizer, both by copying:

1. **UI language** — the titlebar, `.panel`/`.btn`/`.chk` classes, MHFU font, background
   textures, category pills and the whole `applyTheme` colour system.
2. **Quest data** — `QuestData.json` and `LgMonsters.json`.

Changes here do **not** need mirroring into the Randomizer or its desktop app, and vice
versa. That is deliberate: these apps drifted apart on purpose so the Randomizer's fixed
result-card layout doesn't constrain a form-heavy logbook.

## Files

| Path | Contents |
|---|---|
| `docs/index.html` | Markup + all four modals. Holds the `?v=N` cache-busting versions. |
| `docs/styles.css` | All styling, theme CSS variables, the responsive breakpoints. |
| `docs/app.js` | All logic (one IIFE, no modules). |
| `docs/data.js` | Generated — `window.MHGU_LOG_DATA = { quests, monsters }`. Never edit by hand. |
| `tools/build-data.js` | Emits `docs/data.js` from the vendored JSON. |
| `QuestData.json`, `LgMonsters.json` | Vendored copies of the Randomizer's canonical data. |

## Critical: cache busting

GitHub Pages caches assets by full URL. Every time you change `styles.css`, `app.js` or
`data.js`, you **must** increment that file's `?v=N` in `docs/index.html`. Without it,
users keep the stale copy until they hard-refresh.

## Data workflow

`QuestData.json` and `LgMonsters.json` are copies, not a submodule or a fetch. When the
Randomizer's data changes:

```bash
cp "../MHGU Quest Randomizer/QuestData.json" .
cp "../MHGU Quest Randomizer/LgMonsters.json" .
node tools/build-data.js
```

The generator drops the fields this app never reads (Hunter Arts entirely, the Arena
`ArenaWeapons`/`ArenaBiases` arrays) and **collapses duplicate quest rows**: upstream
`QuestData.json` repeats five Village quests as byte-identical entries. Saved log entries
key on `Type + "//" + Name`, so that key has to be unique — the generator warns loudly if
two rows ever share the key while differing in content, which it cannot resolve on its own.

## Architecture

State is three module-level values in `docs/app.js`:

- `entries` — the logbook. Each entry snapshots the quest fields it displays alongside
  `questKey`, so an entry survives a data rebuild that renames or drops its quest
  (`entryQuest()` prefers live data and falls back to the snapshot).
- `editingId` — `null` while composing a new entry, otherwise the entry being edited.
- `selectedQuest` — the quest currently loaded into the editor.

Flow: `buildTree()` renders all 1292 quests once at boot → `filterTree()` shows/hides on
search → `selectQuest()` loads one into the editor → `saveEntry()` pushes or replaces in
`entries` → `renderLog()` rebuilds the list.

Two behaviours that look like bugs but aren't:

- **Saving a new entry keeps the quest, locale, armour, weapon and party** and clears only
  the per-hunt fields. Back-to-back hunts usually share a loadout; `resetEditor(true)` is
  the "log another hunt" path, `resetEditor()` the full clear.
- **`selectQuest` only overwrites Locale when it still matches the previous quest's
  prefill**, so a hand-edited "Jurassic Frontier / Night" survives switching quests.

All user text goes into the DOM via `textContent`/`.value` through the `el()` helper —
never `innerHTML`. Keep it that way; notes and party names are free text.

## Storage

- `mhgu-log-autosave` — debounced 500 ms mirror of the whole log, for crash recovery.
- `mhgu-log-theme` — the chosen theme hex.
- Save files are `{ app: "mhgu-hunting-log", version: 1, entries: [...] }`. `adoptSave()`
  rejects anything whose `app` doesn't match rather than clobbering the log, and
  `normalizeEntry()` treats everything read back as untrusted shape.

## Assets

```
docs/assets/
  MonsterIcons/   MHGU-<Monster_Name>_Icon.webp   (deviants included, e.g. MHGU-Redhelm_Arzuros_Icon.webp)
  WeaponIcons/    icon_<weapon_name>_tinted.png
  ProwlerIcons/   FourthGen-Palico_Icon_Blue.webp is the Prowler "weapon type" icon
  fonts/          mhfu_font.ttf
```

Filenames are derived programmatically (spaces → underscores; ` & ` → `_and_` for weapons).
Every `<img>` built from those helpers gets an `error` handler that swaps in
`MHGU-Question_Mark_Icon.webp` or hides itself.
