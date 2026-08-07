# MHGU Hunting Log

A logbook for **Monster Hunter Generations Ultimate**. Pick a quest, record what you were
after, what you wore, who came along and how it went, and build up a running record of your
hunts.

**Live:** https://armoredraven17.github.io/MHGU-Hunting-Log/

```
Quest: Born of Darkness / Hyper Nargacuga
Locale: Jurassic Frontier / Night
Objective: Seeking Hyper Narga Scales to upgrade Hidden Scythe.
Armor Used: OG Hunter
Weapon: Dual Scissors
Hunting Party: vescucci, TJ, azvock, Raven
Carts: 0
```

That's what the **Copy** button on every entry produces, ready to paste into Discord.

## Features

- **Quest browser** — all 1292 quests, searchable by quest name or monster and browsable by
  rank. Picking one fills in its locale, objective and monster icon.
- **Per-entry fields** — date, locale, your own objective, armour, weapon (with a type
  picker that supplies the icon), a party of up to four, carts, outcome, clear time and
  free-text notes. Only the ones you fill in show up.
- **Autosave** — the log saves itself in your browser as you type.
- **Save files** — write the log out to a `.json` file and load it back, so you can keep
  separate logbooks per playthrough. Uses the File System Access API where available,
  falling back to a download on Firefox.
- **Themes** — the same 28 monster-coloured themes as the Quest Randomizer.

## Running it

There is no build step for the app itself. Open `docs/index.html` in a browser, or serve
`docs/` with any static file server.

## Data

`QuestData.json` and `LgMonsters.json` at the repo root are **copies** of the canonical
files in the [MHGU Quest Randomizer](https://github.com/ArmoredRaven17/MHGU-Quest-Randomizer)
repo. When they change over there, re-copy them here and regenerate:

```bash
node tools/build-data.js
```

That writes `docs/data.js` (`window.MHGU_LOG_DATA`). There is no automatic sync, on purpose
— see [CLAUDE.md](CLAUDE.md).

## Importing a markdown diary

If you already keep the log as a markdown file, `tools/import-diary.js` converts it:

```bash
OUT=mhgu-hunting-log.json node tools/import-diary.js "path/to/Hunting Diary.md"
```

Run it without `OUT` first — it prints a report (how many entries it found, how many
matched a real quest, which titles it couldn't place) without writing anything. Then open
the resulting `.json` with the 📁 button. See the header of the script for the diary format
it expects.

## Deploying

GitHub Pages serves the `docs/` folder on `master`. **Bump the `?v=N` query string** on
`styles.css`, `app.js` or `data.js` in `docs/index.html` whenever you change that file —
the Pages CDN caches by full URL, so without a bump nobody sees the update.

## Other MHGU apps

- [MHGU Quest Randomizer](https://armoredraven17.github.io/MHGU-Quest-Randomizer/)
- [MHGU Bingo](https://armoredraven17.github.io/MHGU-Bingo/)
- [MHGU Collection Tracker](https://armoredraven17.github.io/mhgu-collection-tracker/)

## Credits

Monster, weapon, Palico and item icons come from the
[Monster Hunter Wiki](https://monsterhunter.fandom.com/), whose community content is
licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); any adaptations
here are shared under the same licence. The tab icon is the EX Old Fatalis Ticket, taken
from the [MHGU save editor](https://github.com/ArmoredRaven17/mhgu-editor)'s item icon set
(`MH4G-Ticket_Icon_White`, the sprite `item_colored_icons.json` maps that item to).

Monster Hunter is a trademark of Capcom; this is an unofficial fan tool.
