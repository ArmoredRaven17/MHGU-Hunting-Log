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

### Which icon a quest gets

`QuestData.json` stores no icon — `questIcon()` derives it, in this order:

1. Egg/gathering quests → a category icon from `gatheringIcon()`, keyed off the delivered item.
2. Otherwise the `Monster` / `Monsters[0]` field (Special Permits already hold the full
   deviant name, e.g. `Redhelm Arzuros`).
3. Otherwise the target is parsed out of the objective — `"Slay 10 Maccao"` → `Maccao`.
4. `"Earn N Wycademy Points"` → the Wycademy icon.

`build-data.js` emits an `icons` array listing what is actually in `assets/MonsterIcons`,
and `monsterIcon()` checks against it. That is what lets step 3 try several spellings of a
plural (`Melynxes` → `Melynx`, but `Rhenoplos` stays put) and keep the one that exists,
instead of depluralising blind. Only 17 of 1292 quests fall back to the question mark, all
of them Fatalis/Alatreon/Nakarkos quests whose icon files aren't in the asset set.

Two traps, both of which the randomizer's equivalent code still falls into:

- **`gatheringIcon` strips the leading verb before matching.** "deliver" contains "liver",
  so matching the raw objective puts every plant-gathering quest on the Bone icon.
- **Matching is otherwise plain substring, deliberately.** A word-boundary rule would stop
  `Goldenfish` and `Balmstone` hitting Fish and Ore.
- **The objective parse is not gated on the `SmMonsters` flag**, which is unset on plenty
  of quests that do name a small monster.

## Weapon names

`WeaponNames.json` at the repo root is vendored like the quest data, generated by
`tools/build-weapons.js` from the [MHGU save editor](https://github.com/ArmoredRaven17/mhgu-editor):

```bash
node tools/build-weapons.js "../mhgu-editor"
node tools/build-data.js
```

Names come from the editor's **per-type tree files** (`greatsword.json` etc.), not its
`weapons.json` — the latter lists one entry per weapon id and so omits upgrade levels,
which is where most of the names people actually write down live (`Dual Scissors`,
`Ham of Hams` and `Sage Lance` are all missing from it). 5281 names across 15 types.

Palico weapon names keep the `F ` prefix the editor's data carries. Don't strip it — how
those names render in game isn't something this repo can verify, and the editor's data is
the reliable source.

The names only feed the Weapon field's autocomplete. That field stays a plain text input,
so anything not in the list is still accepted, and it is disabled only while no type is
picked *and* it is empty — an imported entry with a weapon but no type must stay editable.
