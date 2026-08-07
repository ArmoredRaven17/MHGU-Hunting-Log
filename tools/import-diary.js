#!/usr/bin/env node
// Converts the hand-written markdown hunting diary into a save file the app can open.
//
//   node tools/import-diary.js "path/to/Hunting Diary.md"
//   OUT=mhgu-hunting-log.json node tools/import-diary.js "path/to/Hunting Diary.md"
//   SHOW=unmatched|fuzzy|sample node tools/import-diary.js "path/to/Hunting Diary.md"
//
// Without OUT it only prints the report, so it is safe to run just to see what it would do.
//
// Expected diary shape — blocks separated by blank lines, under `# M/D/YY` date headings:
//
//   **Quest Title** / Monster              (wrap the line in ~~ ~~ to mark the hunt failed)
//   *Locale / Time of Day*
//   First prose line becomes the Objective
//   Any further prose becomes Notes
//   Set: <armour> + <weapon>
//   Hunting Party: a, b, c                 (or "Solo")
//   Carts: 2 / QUEST FAILED                (or "/ QUEST ABANDONED")
//
// Everything is best-effort: a block missing any of those lines still converts, and a
// title matching nothing in the quest data still produces a usable entry — it just isn't
// linked to a QuestData.json row. Harvest Tours are the common case there, being free
// gathering expeditions rather than listed quests.
const fs = require("fs");
const path = require("path");

const MD = process.argv[2];
if (!MD) {
  console.error('usage: node tools/import-diary.js "path/to/Hunting Diary.md"');
  process.exit(1);
}
const DATA = process.argv[3] || path.join(__dirname, "..", "docs", "data.js");

const d = JSON.parse(fs.readFileSync(DATA, "utf8").replace(/^.*?window\.MHGU_LOG_DATA = /s, "").replace(/;\s*$/, ""));
const QUESTS = d.quests;

// ── quest index ───────────────────────────────────────────────────────────
const shortName = (q) => q.Name.replace(/^.*?\/\/\s*/, "");
const norm = (s) => s.toLowerCase()
  .replace(/[\u2018\u2019']/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const byNorm = new Map();
for (const q of QUESTS) {
  const k = norm(shortName(q));
  if (!byNorm.has(k)) byNorm.set(k, []);
  byNorm.get(k).push(q);
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

const ALL_KEYS = [...byNorm.keys()];
function fuzzy(key) {
  let best = null, bestD = Infinity;
  const limit = Math.max(2, Math.round(key.length * 0.25));
  for (const k of ALL_KEYS) {
    if (Math.abs(k.length - key.length) > limit) continue;
    const dist = lev(key, k);
    if (dist < bestD) { bestD = dist; best = k; }
  }
  return bestD <= limit ? { key: best, dist: bestD } : null;
}

// ── markdown parse ────────────────────────────────────────────────────────
const lines = fs.readFileSync(MD, "utf8").split(/\r?\n/);

const MONTHS = {};
let curDate = "", curType = "", inQuests = false;
const blocks = [];
let block = null;

const flush = () => { if (block && block.body.length) blocks.push(block); block = null; };

for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const line = raw.trim();

  // Section headers
  let m = /^#{1,6}\s*(.+)$/.exec(line);
  if (m) {
    flush();
    const h = m[1].trim();
    if (/^Quests$/i.test(h)) { inQuests = true; continue; }
    if (/^(Current Goals|Sets)$/i.test(h)) { inQuests = false; continue; }
    // date header: 5/29/26 · 6/13:26 · 7/10
    const dm = /^(\d{1,2})\/(\d{1,2})(?:[\/:](\d{2,4}))?/.exec(h);
    if (dm) {
      const [, mo, da, yr] = dm;
      const year = yr ? (yr.length === 2 ? 2000 + +yr : +yr) : 2026;
      curDate = `${year}-${String(+mo).padStart(2, "0")}-${String(+da).padStart(2, "0")}T00:00`;
      // Reset the Village/Hub context: it only applies to the session it heads, and
      // letting it persist across dates mis-attributes every later quest to the last
      // type seen (most sessions carry no type header at all).
      curType = "";
      inQuests = true;
      continue;
    }
    const tm = /^(Village|Hub|Pub)\b/i.exec(h);
    if (tm) { curType = tm[1][0].toUpperCase() + tm[1].slice(1).toLowerCase(); continue; }
    continue; // "Strem" and anything else: just a divider
  }

  if (!inQuests) continue;

  if (!line) { flush(); continue; }

  // Entry start: **Title** ... or ~~**Title**...~~
  if (/^~*\*\*/.test(line)) {
    // One map line is written bold instead of italic. Only treat a fully-bold line as a
    // map line when it names a time of day, so a real entry head is never swallowed.
    const boldInner = /^\*\*([^*]+)\*\*$/.exec(line);
    if (block && !block.locale && boldInner && /\/\s*(day|night)$/i.test(boldInner[1].trim())) {
      block.locale = boldInner[1].trim();
      continue;
    }
    flush();
    block = { date: curDate, type: curType, head: line, body: [], locale: "", srcLine: i + 1 };
    continue;
  }

  if (!block) continue;

  // Italic map line
  if (/^\*[^*].*\*$/.test(line) && !block.locale && block.body.length === 0) {
    block.locale = line.replace(/^\*|\*$/g, "").trim();
    continue;
  }
  block.body.push(line);
}
flush();

// ── field extraction ──────────────────────────────────────────────────────
const WEAPON_TYPES = [
  [/\bgun ?lance\b/i, "Gunlance"],
  [/\bgun ?hammer\b|\bhammer\b|\bcudgel\b|\bham of hams\b|\benormous ham\b/i, "Hammer"],
  [/\bcharge blade\b|\bcb\b/i, "Charge Blade"],
  [/\bswitch axe\b/i, "Switch Axe"],
  [/\blong ?sword\b/i, "Long Sword"],
  [/\bgreat ?sword\b/i, "Great Sword"],
  [/\bsns\b|\bsword & shield\b|\bsword and shield\b|\bdual scissors\b/i, "Sword & Shield"],
  [/\bdual blades\b/i, "Dual Blades"],
  [/\bhunting horn\b/i, "Hunting Horn"],
  [/\b(insect )?glaive\b/i, "Insect Glaive"],
  [/\blance\b/i, "Lance"],
  [/\bhbg\b|\bheavy bowgun\b|\bcannon\b/i, "Heavy Bowgun"],
  [/\blbg\b|\blight bowgun\b/i, "Light Bowgun"],
  [/\bbow\b/i, "Bow"],
  [/\bprowler\b/i, "Prowler"],
];
const weaponTypeOf = (s) => {
  if (!s) return "";
  for (const [re, t] of WEAPON_TYPES) if (re.test(s)) return t;
  return "";
};

const out = [];
const unmatched = [];
let seq = 0;

for (const b of blocks) {
  let head = b.head;
  const failedMark = /^~~/.test(head);
  head = head.replace(/~~/g, "").trim();

  const hm = /^\*\*(.+?)\*\*(.*)$/.exec(head);
  if (!hm) continue;
  let title = hm[1].trim();
  let rest = hm[2].trim().replace(/^\/\s*/, "");
  if (/^Quest Title$/i.test(title)) continue; // the blank template block

  // "(2)" repeat marker after the title
  let repeat = "";
  const rp = /\s*\((\d+)\)\s*$/.exec(title);
  if (rp) { repeat = rp[1]; title = title.slice(0, rp.index).trim(); }

  let armor = "", weapon = "", party = [], carts = 0, outcome = "", notes = [], objective = "";
  let cartsSeen = false;

  for (const lineRaw of b.body) {
    const line = lineRaw.replace(/~~/g, "").trim();
    let m;
    if ((m = /^Set:\s*(.*)$/i.exec(line))) {
      const v = m[1].trim();
      const parts = v.split(/\s*\+\s*/);
      armor = parts.shift() || "";
      weapon = parts.join(" + ");
      continue;
    }
    if ((m = /^(?:Hunting )?Party:\s*(.*)$/i.exec(line))) {
      const v = m[1].trim();
      party = /^solo$/i.test(v) || !v ? [] : v.split(/\s*,\s*/).filter(Boolean);
      continue;
    }
    if ((m = /^Carts:\s*(\d*)\s*(?:\/\s*QUEST\s+(FAILED|ABANDONED))?\s*$/i.exec(line))) {
      cartsSeen = true;
      carts = m[1] ? +m[1] : 0;
      if (m[2]) outcome = /ABANDONED/i.test(m[2]) ? "Abandoned" : "Fail";
      continue;
    }
    // "Bomb-Sleeper Set" — armour written without the "Set:" prefix
    if (/\bSet$/i.test(line) && !armor) { armor = line.replace(/\s*Set$/i, "").trim(); continue; }
    notes.push(line);
  }

  if (/QUEST\s+FAILED/i.test(b.body.join(" "))) outcome = outcome || "Fail";
  if (/QUEST\s+ABANDONED/i.test(b.body.join(" "))) outcome = "Abandoned";
  if (!outcome) outcome = failedMark ? "Fail" : "Success";

  if (notes.length) objective = notes.shift();
  if (repeat) notes.push(`Repeated ×${repeat}.`);

  // ── match the quest ──
  // The diary prefixes some names with how the quest was reached. Only "Urgent Quest:"
  // is an annotation — "Advanced:" and "Event:" are part of the real in-game names.
  const key = norm(title.replace(/^urgent quest\s*:\s*/i, ""));
  let cands = byNorm.get(key) || [];
  let matchNote = "";
  if (!cands.length) {
    // "The Unwavering" for "The Unwavering Colossus" — a unique prefix is a safe match,
    // and it's too far away in edit distance for the fuzzy pass to reach.
    const pre = ALL_KEYS.filter(k => k.startsWith(key + " "));
    if (pre.length === 1) {
      cands = byNorm.get(pre[0]);
      matchNote = `prefix "${title}" -> "${shortName(cands[0])}"`;
    }
  }
  if (!cands.length) {
    const f = fuzzy(key);
    if (f) { cands = byNorm.get(f.key); matchNote = `fuzzy(${f.dist}) "${title}" -> "${shortName(cands[0])}"`; }
  }

  let quest = null;
  if (cands.length === 1) quest = cands[0];
  else if (cands.length > 1) {
    const monsters = rest.toLowerCase();
    const loc = (b.locale || "").toLowerCase();
    const text = (b.body.join(" ") + " " + title).toLowerCase();
    // Rank hints from how the entry describes itself.
    const gRank = /\bg[1-5]\b|\bg-?\s?rank\b/.test(text);
    const villageSaid = /\bvillage\b/.test(text);
    const hubSaid = /\bhub\b/.test(text);
    const score = (q) => {
      let s = 0;
      if (b.type && q.Type === b.type) s += 4;
      // Village quests are single-player only in MHGU, so a party rules them out.
      if (party.length && q.Type === "Village") s -= 6;
      if (gRank && q.Type === "Pub") s += 3;
      if (gRank && q.Type !== "Pub") s -= 2;
      if (villageSaid && q.Type === "Village") s += 2;
      if (hubSaid && q.Type === "Hub") s += 2;
      const tgt = (q.Monsters && q.Monsters.length ? q.Monsters : (q.Monster ? [q.Monster] : []));
      for (const t of tgt) if (monsters.includes(t.toLowerCase())) s += 3;
      if (/hyper/i.test(rest) && q.Hyper) s += 3;
      if (loc && q.Locale && loc.includes(q.Locale.toLowerCase().replace(/^[a-z]\. /, ""))) s += 1;
      return s;
    };
    const ranked = cands.map(q => [score(q), q]).sort((a, b2) => b2[0] - a[0]);
    quest = ranked[0][1];
    if (ranked.length > 1 && ranked[0][0] === ranked[1][0]) {
      matchNote += ` TIED(${cands.length}) "${title}" -> ${quest.Type} [${ranked.map(r => r[1].Type + ":" + r[0]).join(" ")}]`;
    }
  }

  if (!quest) unmatched.push({ line: b.srcLine, title, rest, date: b.date });

  seq++;
  const snapshot = quest ? {
    Name: quest.Name, Type: quest.Type, Level: quest.Level, Main: quest.Main, Locale: quest.Locale,
    Monster: quest.Monster, Monsters: quest.Monsters.slice(), Hyper: quest.Hyper, Capture: quest.Capture,
    Key: quest.Key, LgMonster: quest.LgMonster, SmMonsters: quest.SmMonsters, Egg: quest.Egg,
    Gathering: quest.Gathering, Prowler: quest.Prowler,
  } : (() => {
    // No match in the quest data — keep enough for the card to render sensibly.
    // Harvest Tours are the bulk of these: they're free gathering expeditions, not
    // listed quests, so QuestData.json has no row for them at all.
    const tour = /^Harvest Tour:\s*(.+)$/i.exec(title);
    return {
      Name: title, Type: b.type || "", Level: 0, Main: tour ? "Gathering" : rest,
      Locale: tour ? tour[1].trim() : "",
      Monster: "", Monsters: [], Hyper: /hyper/i.test(rest), Capture: /\(cap/i.test(rest),
      Key: false, LgMonster: false, SmMonsters: false, Egg: false,
      Gathering: !!tour || /gathering/i.test(rest), Prowler: false,
    };
  })();

  out.push({
    id: "le_md" + String(seq).padStart(4, "0"),
    seq,
    questKey: quest ? quest.Type + "//" + quest.Name : "",
    quest: snapshot,
    date: b.date || "",
    locale: b.locale || "",
    objective,
    armor,
    weapon,
    weaponType: weaponTypeOf(weapon) || weaponTypeOf(armor),
    party,
    carts,
    outcome,
    clearTime: "",
    notes: notes.join("\n"),
    _dbg: { srcLine: b.srcLine, matchNote, rest, cartsSeen },
  });
}

// ── report ────────────────────────────────────────────────────────────────
console.log(`blocks parsed : ${blocks.length}`);
console.log(`entries       : ${out.length}`);
console.log(`matched quest : ${out.filter(e => e.questKey).length}`);
console.log(`UNMATCHED     : ${unmatched.length}`);
console.log(`outcomes      : ${JSON.stringify(out.reduce((a, e) => (a[e.outcome] = (a[e.outcome] || 0) + 1, a), {}))}`);
console.log(`dated         : ${out.filter(e => e.date).length}  undated: ${out.filter(e => !e.date).length}`);
console.log(`with party    : ${out.filter(e => e.party.length).length}`);
console.log(`with armour   : ${out.filter(e => e.armor).length}   weapon: ${out.filter(e => e.weapon).length}   weaponType: ${out.filter(e => e.weaponType).length}`);
console.log(`carts > 3     : ${out.filter(e => e.carts > 3).length}`);

if (process.env.SHOW === "unmatched") {
  console.log("\n--- unmatched ---");
  unmatched.forEach(u => console.log(`  L${u.line}  "${u.title}"   / ${u.rest}`));
}
if (process.env.SHOW === "fuzzy") {
  console.log("\n--- fuzzy / ambiguous matches ---");
  out.filter(e => e._dbg.matchNote).forEach(e => console.log(`  L${e._dbg.srcLine}  ${e._dbg.matchNote}`));
}
if (process.env.SHOW === "sample") {
  console.log("\n--- last 3 entries ---");
  out.slice(-3).forEach(e => console.log(JSON.stringify(e, null, 1)));
}

if (process.env.OUT) {
  const clean = out.map(({ _dbg, ...e }) => e);
  fs.writeFileSync(process.env.OUT, JSON.stringify({ app: "mhgu-hunting-log", version: 1, entries: clean }, null, 2));
  console.log(`\nwrote ${process.env.OUT}`);
}
