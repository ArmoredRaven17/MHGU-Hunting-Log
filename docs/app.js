"use strict";
(function () {
  const DATA = window.MHGU_LOG_DATA || { quests: [], monsters: [] };
  const $ = (id) => document.getElementById(id);
  // Every user-supplied string goes in through textContent/.value, never innerHTML.
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ── Static config ────────────────────────────────────────────────────────
  const WEAPONS = ["Great Sword", "Long Sword", "Sword & Shield", "Dual Blades",
    "Hammer", "Hunting Horn", "Lance", "Gunlance", "Switch Axe", "Charge Blade",
    "Insect Glaive", "Light Bowgun", "Heavy Bowgun", "Bow", "Prowler"];

  // Every weapon name in the game, keyed by the type labels above. Generated from the
  // save editor's data — see tools/build-weapons.js. Used only to fill the Weapon field's
  // autocomplete, never to validate it.
  const WEAPON_NAMES = DATA.weapons || {};

  // QuestData.json abbreviates locales to fit the randomizer's result card. A logbook
  // line reads better spelled out, and the field stays editable so a time of day can be
  // appended ("Jurassic Frontier / Night").
  const LOCALE_FULL = {
    "J. Frontier": "Jurassic Frontier", "V. Hills": "Verdant Hills",
    "A. Ridge": "Arctic Ridge", "M. Peaks": "Misty Peaks",
    "D. Island": "Deserted Island", "A. Steppe": "Ancestral Steppe",
    "F. Seaway": "Frozen Seaway", "V. Hollow": "Volcanic Hollow",
    "S. Pinnacle": "Sacred Pinnacle", "F. Slayground": "Frozen Slayground",
    "V. Slayground": "Verdant Slayground",
    "Dunes": "Dunes", "Primal Forest": "Primal Forest", "Marshlands": "Marshlands",
    "Volcano": "Volcano", "Sanctuary": "Sanctuary", "Forlorn Arena": "Forlorn Arena",
    "Arena": "Arena", "Ruined Pinnacle": "Ruined Pinnacle", "Desert": "Desert",
    "Jungle": "Jungle", "Wyvern's End": "Wyvern's End", "Ingle Isle": "Ingle Isle",
    "Polar Field": "Polar Field", "Fortress": "Fortress",
    "Forlorn Citadel": "Forlorn Citadel", "Castle Schrade": "Castle Schrade",
  };
  const localeFull = (abbr) => LOCALE_FULL[abbr] || abbr || "";

  // Quest browser grouping: Type → rank label, keyed off q.Level. Mirrors the
  // randomizer's LEVELS table, plus Arena "Event" (level 3), which it doesn't list.
  const TYPE_ORDER = ["Village", "Hub", "Pub", "Special Permits", "Events", "Arena"];
  const RANKS = {
    Village: [[1, "1★"], [2, "2★"], [3, "3★"], [4, "4★"], [5, "5★"], [6, "6★"],
              [7, "7★"], [8, "8★"], [9, "9★"], [10, "10★"], [11, "10★ Advanced"]],
    Hub: [[1, "1★"], [2, "2★"], [3, "3★"], [4, "4★"], [5, "5★"], [6, "6★"], [7, "7★"], [8, "8★"]],
    Pub: [[1, "G1★"], [2, "G2★"], [3, "G3★"], [4, "G4★"], [5, "G4★ (HR13+)"]],
    "Special Permits": [[1, "I"], [2, "II"], [3, "III"], [4, "IV"], [5, "V"], [6, "VI"],
                        [7, "VII"], [8, "VIII"], [9, "IX"], [10, "X"], [11, "G1"], [12, "G2"],
                        [13, "G3"], [14, "G4"], [15, "G5"], [16, "EX"]],
    Events: [[1, "Low Rank"], [2, "High Rank"], [3, "G Rank"]],
    Arena: [[1, "Normal"], [2, "Challenge"], [3, "Event"]],
  };
  const rankLabel = (q) => {
    const row = (RANKS[q.Type] || []).find(([lv]) => lv === q.Level);
    return row ? row[1] : "Level " + q.Level;
  };

  // Theme colors — each named after the monster assigned to that hue in the picker.
  const COLORS = [
    ["Teostra", "#570B0B"], ["Rathalos", "#b51717"],
    ["Tetsucabra", "#783E0F"], ["Agnaktor", "#C7620E"],
    ["Tigrex", "#74631D"], ["Rajang", "#9C8328"],
    ["Deviljho", "#0B570F"], ["Rathian", "#39993E"],
    ["Astalos", "#14503d"], ["Zinogre", "#279773"],
    ["Zamtrios", "#005984"], ["Plesioth", "#0080c1"],
    ["Brachydios", "#0B2757"], ["Lagiacrus", "#0b3f97"],
    ["G. Magala", "#1F0B57", "Gore Magala"], ["Nerscylla", "#4e2fa2"],
    ["Y. Garuga", "#62008f", "Yian Garuga"], ["Chameleos", "#8e50ab"],
    ["Mizutsune", "#D4358C"], ["Congalala", "#C8679D"],
    ["Duramboros", "#5a411f"], ["Diablos", "#997c54"],
    ["Barroth", "#835A32"], ["Bulldrome", "#B17A47"],
    ["K. Daora", "#505358", "Kushala Daora"], ["Valstrax", "#7C879B"],
    ["Forbidden", "#1E2025", "Question Mark"],
  ];
  // THE PALETTE'S ONE INVARIANT: every theme takes white text and a white checkbox tick.
  //
  // Two requirements, one number. A native checkbox takes accent-color from the theme and the
  // browser picks the tick glyph itself — white below relative luminance .1791, black above it.
  // White body text needs its ground at .1833 or below to clear 4.5:1. The checkbox line is the
  // stricter of the two, so hold a surface under .1791 and white text on it clears AA for free.
  //
  // The binding surface is the lightest one a theme paints — a 60/40 composite of darken(hex,.80)
  // and darken(hex,.95), lighter than the tick's own darken(hex,.70), so testing the composite
  // covers both. Every theme is under it; worst white-on-ground in the palette is 4.73:1.
  //
  // This is load-bearing rather than cosmetic. Most of these apps paint white text unconditionally
  // with no light-theme fallback left, so a swatch over the line is not a slightly-too-bright
  // swatch, it is unreadable. The Hunting Log and the Randomizer do still carry an isLight branch,
  // but it trips only at near-white and nothing in the palette comes close. The Randomizer's
  // Gypceros is the deliberate exception — tripping that branch is its entire joke.
  //
  // A NEW OR RE-CUT COLOUR HAS TO CLEAR THIS. A swatch that fails is not a slightly-too-bright
  // swatch, it is a theme that inverts against every other one.
  //
  // Eight came down to get there — Rajang, Rathian, Zinogre, Mizutsune, Congalala, Barroth,
  // Bulldrome and Valstrax — by lightness alone, so each keeps its own hue and saturation. Where
  // capping the light member on its own would have squashed a pair onto one lightness, the dark
  // partner came down by the same factor instead of the pair collapsing: that is why Barroth
  // moved with Bulldrome, and Mizutsune with Congalala.
  //
  // Two pairs are re-cuts of other pairs, keeping their own slot on the wheel and taking the
  // source pair's saturation and lightness, member for member:
  //
  //   Tigrex / Rajang        <- Astalos / Zinogre,      at the yellow slot (47°)
  //   Tetsucabra / Agnaktor  <- Brachydios / Lagiacrus, at the orange slot (27°)
  //
  // Both pairs then come back up as far as the line allows, less a working margin, because a
  // source pair brings its own lightness along and the teal and blue pairs are the dark ones.
  //
  // RAJANG IS THE ONE SITTING ON THE CEILING. Its ground measures .170 against the .1791 line,
  // so it has no lift left: brightening it buys dark text and a black tick, which is the exact
  // thing this invariant exists to prevent. If it ever has to read punchier, trade saturation
  // for lightness along the boundary (#A58100 at S 1.00 is the vivid end) rather than pushing
  // lightness up — but that drops it to L .32 and squeezes the pair against Tigrex, so check
  // the separation before taking it.
  //
  // The earth tones (Duramboros, Diablos, Barroth, Bulldrome) share the 27–47° stretch with both
  // of those pairs by design. Swatches sitting close together in there is expected and is not a
  // collision to design out.
  //
  // A saved theme is a bare hex, so anyone sitting on a retired one keeps a colour that is no
  // longer in the list: it never picks up the change, and anything keyed off the hex (the selected
  // swatch, the theme's icon) stops matching. Remap on read, not on write — the stale value is
  // already in localStorage on every device that chose it. Only hexes that actually shipped are
  // listed; cuts that never left the working tree are not, because no device can hold them.
  //
  // "Shipped" is per app, not per palette. #574916 went out on Talisman Bingo alone, and
  // #68360D / #B5590D / #68581A on MHGU Bingo alone, because an unrelated commit in each of
  // those repos swept the working tree mid-edit and pushed a cut that was still being tuned.
  // They are listed in all nine anyway: the map is kept identical regardless of which app
  // released what, because this palette is hand-copied with no shared source and a per-app map
  // is one more thing to drift.
  const LEGACY_HEX = {
    "#C8A319": "#74631D", "#57470B": "#74631D", "#5E4D0C": "#74631D",           // Tigrex
    "#574916": "#74631D",
    "#F1D364": "#9C8328", "#B59417": "#9C8328", "#C39F19": "#9C8328",           // Rajang
    "#BEA031": "#9C8328",
    "#C65900": "#783E0F", "#FC933E": "#C7620E",                                 // Tetsucabra, Agnaktor
    "#68360D": "#783E0F", "#B5590D": "#C7620E",                                 // ...and the cuts that
    "#68581A": "#74631D",                                                       // reached MHGU Bingo only
    "#3A9B3F": "#39993E", "#2DAE85": "#279773",                                 // Rathian, Zinogre
    "#D84696": "#D4358C", "#CE79A8": "#C8679D",                                 // Mizutsune, Congalala
    "#B57C45": "#835A32", "#CFAA87": "#B17A47",                                 // Barroth, Bulldrome
    "#AEB5C1": "#7C879B",                                                       // Valstrax
  };
  const migrateHex = (h) => (h && LEGACY_HEX[h.toUpperCase()]) || h;
  const COLORS_HEX = Object.fromEntries(COLORS.map(([name, hex]) => [hex.toUpperCase(), name]));
  const COLORS_ICON = Object.fromEntries(COLORS.filter(c => c[2]).map(([name, , icon]) => [name, icon]));

  // ── Icon path helpers ────────────────────────────────────────────────────
  const FALLBACK_ICON = "assets/MonsterIcons/MHGU-Question_Mark_Icon.webp";
  const PROWLER_ICON = "assets/ProwlerIcons/FourthGen-Palico_Icon_Blue.webp";
  // Which icons actually exist on disk, emitted by tools/build-data.js. Checking against
  // it means a derived name that has no icon degrades to the question mark deliberately
  // rather than via a 404 and an error handler.
  const HAS_ICON = new Set(DATA.icons || []);
  const monsterIcon = (name) => (name && HAS_ICON.has(name))
    ? "assets/MonsterIcons/MHGU-" + name.replace(/ /g, "_") + "_Icon.webp"
    : FALLBACK_ICON;
  const weaponIcon = (w) => w === "Prowler" ? PROWLER_ICON
    : "assets/WeaponIcons/icon_" + w.toLowerCase().replace(/ & /g, "_and_").replace(/ /g, "_") + "_tinted.png";

  // QuestData.json names no icon — it's derived. Large-monster quests read it off
  // Monster/Monsters, but the ~195 quests without a monster need the objective text
  // parsed instead. Both helpers below are ported from the randomizer's app.js.

  // Objectives write the target in plural ("Slay 10 Maccao", "Slay 8 Melynxes"), and some
  // monsters are singular-with-an-s already (Rhenoplos, Cephalos). Rather than guess the
  // rule, try each spelling and keep the first that has an icon.
  const resolveMonster = (name) => {
    if (!name) return "";
    for (const c of [name, name.replace(/xes$/, "x"), name.replace(/ies$/, "y"), name.replace(/s$/, "")]) {
      if (HAS_ICON.has(c)) return c;
    }
    return "";
  };
  // Parse the target out of a quest objective, e.g. "Slay 10 Maccao" → Maccao.
  const objectiveMonster = (main) => {
    if (!main) return "";
    // "Slay/Defeat/Hunt a total of N MonsterA or/and MonsterB" → first monster
    let m = main.match(/(?:Slay|Defeat|Hunt) a total of \d+ ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (m) return resolveMonster(m[1]);
    // "Slay N Name" — the capital letter excludes "before time expires" etc.
    m = main.match(/(?:Slay|Defeat|Hunt) \d+ ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (m) return resolveMonster(m[1]);
    return "";
  };
  // Quest-category icon for gathering/egg quests, keyed off the delivered item.
  //
  // The leading verb is stripped first, and that is not cosmetic: "deliver" contains
  // "liver", so matching the raw objective put every plant-gathering quest ("Deliver 20
  // Unique Ferns") on the Bone icon. Matching is otherwise plain substring on purpose —
  // the item names are compounds, and "Goldenfish" and "Balmstone" have to keep hitting
  // Fish and Ore, which a word-boundary rule would break.
  function gatheringIcon(main) {
    const m = (main || "").toLowerCase().replace(/^\s*(?:deliver|slay|hunt|capture|repel|earn|gather|collect)\b/, "");
    if (m.includes("egg"))                                                                            return "assets/MonsterIcons/MHGU-Egg_Quest_Icon.webp";
    if (m.includes("mushroom"))                                                                       return "assets/MonsterIcons/MHGU-Mushroom_Quest_Icon.webp";
    if (m.includes("fish") || m.includes("sashimi") || m.includes("piscine"))                         return "assets/MonsterIcons/MHGU-Fish_Quest_Icon.webp";
    if (m.includes("moth") || m.includes("cricket") || m.includes("rhino") || m.includes("honey"))    return "assets/MonsterIcons/MHGU-Bug_Quest_Icon.webp";
    if (m.includes("ore") || m.includes("coal") || m.includes("stone") || m.includes("chunk") ||
        m.includes("rock"))                                                                           return "assets/MonsterIcons/MHGU-Ore_Quest_Icon.webp";
    if (m.includes("bone") || m.includes("fossil") || m.includes("amber") || m.includes("shell") ||
        m.includes("horn") || m.includes("brain") || m.includes("husk") || m.includes("gut")  ||
        m.includes("tongue") || m.includes("liver") || m.includes("oil") || m.includes("fur"))        return "assets/MonsterIcons/MHGU-Bone_Quest_Icon.webp";
    return "assets/MonsterIcons/MHGU-Wycademy_Quest_Icon.png";
  }

  // ── Quest helpers ────────────────────────────────────────────────────────
  // Saved entries reference a quest by Type + "//" + Name. tools/build-data.js
  // guarantees that key is unique (it collapses the duplicate rows upstream).
  const questKey = (q) => q.Type + "//" + q.Name;
  // "Hub 6★ // Born of Darkness" → "Born of Darkness". Special Permit names carry no
  // "//" separator and pass through untouched.
  const questShortName = (q) => q.Name.replace(/^.*?\/\/\s*/, "");
  const questTargets = (q) => (q.Monsters && q.Monsters.length) ? q.Monsters : (q.Monster ? [q.Monster] : []);
  // The single icon that represents a quest. Egg/gathering quests get a category icon;
  // anything else prefers its Monster field (Special Permits already carry the full
  // deviant name there) and falls back to parsing the objective.
  //
  // Note the objective parse is NOT gated on q.SmMonsters: that flag is unset on plenty of
  // quests that do name a small monster ("Dash It All — Slay 10 Bullfango"), and gating on
  // it costs ~30 icons for no benefit. If the objective doesn't name a resolvable monster
  // the parse returns "" anyway.
  function questIcon(q) {
    if (!q) return FALLBACK_ICON;
    if (q.Egg || q.Gathering) return gatheringIcon(q.Main);
    const target = questTargets(q)[0];
    if (target && HAS_ICON.has(target)) return monsterIcon(target);
    const parsed = objectiveMonster(q.Main);
    if (parsed) return monsterIcon(parsed);
    // "Earn 500 Wycademy Points" — a real quest category, not a monster hunt.
    if (/Wycademy Point/i.test(q.Main || "")) return "assets/MonsterIcons/MHGU-Wycademy_Quest_Icon.png";
    return monsterIcon(target);
  }
  // "Born of Darkness / Hyper Nargacuga"
  // The rank a quest displays in front of its name, or "" when there isn't a sensible one.
  //
  // Special Permits are skipped: their rank is the deviant tier, which their name already
  // carries — "Redhelm IV: Hunt" would otherwise read "IV / Redhelm IV: Hunt".
  // An entry the importer couldn't link has Level 0 and no real rank, so it gets nothing
  // rather than "Level 0".
  // Pub reads as Hub: it's this app's split of the Gathering Hall into High and G rank,
  // not somewhere the game sends you. The G in "G1★" already says which half it is.
  const RANK_PREFIX = { Village: "Village", Hub: "Hub", Pub: "Hub" };
  function questRank(q) {
    if (!q || !q.Type || q.Type === "Special Permits") return "";
    const row = (RANKS[q.Type] || []).find(([lv]) => lv === q.Level);
    if (!row) return "";
    const prefix = RANK_PREFIX[q.Type];
    return prefix ? prefix + " " + row[1] : row[1];
  }
  // "G2★ / Jumping at Shadows / Nargacuga"
  function questDisplay(q) {
    const targets = questTargets(q).map(m => (q.Hyper ? "Hyper " : "") + m);
    const parts = [];
    const rank = questRank(q);
    if (rank) parts.push(rank);
    parts.push(questShortName(q));
    if (targets.length) parts.push(targets.join(" + "));
    return parts.join(" / ");
  }
  function questPills(q) {
    const p = [];
    if (q.Key) p.push(["Key", "pill-key"]);
    if (q.LgMonster) p.push(["Hunt", "pill-hunt"]);
    if (q.SmMonsters) p.push(["Small Monsters", "pill-sm"]);
    if (q.Egg) p.push(["Egg Delivery", "pill-egg"]);
    if (q.Gathering) p.push(["Gathering", "pill-gathering"]);
    if (q.Type === "Special Permits") p.push(["Special Permit", "pill-sp"]);
    if (q.Capture) p.push(["Capture", "pill-capture"]);
    if (q.Hyper) p.push(["Hyper", "pill-hyper"]);
    if (q.Prowler) p.push(["Prowler", "pill-prowler"]);
    if (q.Type === "Arena") p.push(["Arena", "pill-arena"]);
    if (q.Type === "Events") p.push(["Event", "pill-event"]);
    return p;
  }
  const QUESTS_BY_KEY = new Map(DATA.quests.map(q => [questKey(q), q]));

  // ── State ────────────────────────────────────────────────────────────────
  let entries = [];          // { id, seq, questKey, quest{}, date, locale, objective, armor, weapon, weaponType, party[], carts, outcome, clearTime, notes }
  let editingId = null;      // null while composing a new entry
  let selectedQuest = null;
  let seqCounter = 0;
  let dirty = false;
  let fileHandle = null;
  // Farming mode: a save leaves the form standing so back-to-back runs of the same quest
  // can be filed without retyping the loadout each time. Remembered, because it describes
  // how the session is being played rather than anything about one entry.
  const FARMING_KEY = "mhgu-log-farming";
  let farming = false;
  try { farming = localStorage.getItem(FARMING_KEY) === "1"; } catch (e) {}
  let weaponListFor = null;  // which type's names are currently in the datalist
  let localeDefault = "";    // the locale the current quest prefilled, so a user edit is never clobbered

  const newId = () => "le_" + (seqCounter + 1).toString(36) + "_" + Math.random().toString(36).slice(2, 8);

  // ── Toast ────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2200);
  }

  // ── Dirty tracking + autosave ────────────────────────────────────────────
  const AUTOSAVE_KEY = "mhgu-log-autosave";
  const SAVE_APP = "mhgu-hunting-log";
  const SAVE_VERSION = 1;

  const serializeSave = () => ({ app: SAVE_APP, version: SAVE_VERSION, entries });

  function markDirty() {
    if (!dirty) {
      dirty = true;
      $("dirtyDot").classList.remove("hidden");
      document.title = "● MHGU Hunting Log";
    }
    scheduleAutosave();
  }
  function clearDirty() {
    dirty = false;
    $("dirtyDot").classList.add("hidden");
    document.title = "MHGU Hunting Log";
  }
  let autosaveTimer = null;
  function writeLocalSave() {
    clearTimeout(autosaveTimer);
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeSave())); } catch (e) {}
  }
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(writeLocalSave, 500);
  }
  // ── Draft: the entry currently in the editor ─────────────────────────────
  // The logbook autosaves when an entry is committed, but the half-written entry sitting
  // in the form was only in the DOM — close the tab mid-entry and it was gone. This keeps
  // a mirror of the editor itself.
  //
  // Deliberately its own key and NOT part of serializeSave(): a draft is working state for
  // this browser, not a record, and shipping it inside a save file would resurrect someone
  // else's half-finished entry when they open that file.
  const DRAFT_KEY = "mhgu-log-draft";
  let draftTimer = null;

  const draftIsEmpty = (d) => !d.questKey && !d.quest && !d.locale && !d.objective &&
    !d.armor && !d.weapon && !d.weaponType && !d.outcome && !d.clearTime && !d.notes &&
    !d.carts && !(d.party || []).length;

  function writeDraft() {
    clearTimeout(draftTimer);
    const data = readForm();
    try {
      if (draftIsEmpty(data)) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ editingId, data }));
    } catch (e) {}
  }
  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(writeDraft, 400);
  }

  // Returns true if a draft was restored, so boot knows not to leave the blank form.
  //
  // `raw` is passed in at boot rather than read here: resetEditor() writes the draft, and
  // boot calls it first to build the blank form, which would clear the very draft this is
  // about to restore. Boot reads the value before any of that runs.
  function loadDraft(raw) {
    if (raw === undefined) {
      try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return false; }
    }
    if (!raw) return false;
    let d;
    try { d = JSON.parse(raw); } catch (e) { return false; }
    if (!d || !d.data) return false;

    // seq is pinned so normalizeEntry's "assign the next one" path can't advance the
    // counter that real entries depend on.
    const data = normalizeEntry(Object.assign({ seq: 0 }, d.data));
    if (draftIsEmpty(data)) return false;

    selectedQuest = QUESTS_BY_KEY.get(data.questKey) || data.quest || null;
    localeDefault = selectedQuest ? localeFull(selectedQuest.Locale) : "";
    renderQuestHead(selectedQuest);
    const node = questNodes.find(n => n.q === QUESTS_BY_KEY.get(data.questKey));
    if (node) {
      node.btn.classList.add("sel");
      node.sub.classList.add("open");
      node.grp.classList.add("open");
    }
    writeForm(data);

    // Only resume editing an existing entry if it's still there — the log may have been
    // replaced by a different file since.
    editingId = (d.editingId && entries.some(e => e.id === d.editingId)) ? d.editingId : null;
    $("deleteEntryBtn").classList.toggle("hidden", !editingId);
    $("saveAsNewBtn").classList.toggle("hidden", !editingId);
    $("saveEntryBtn").textContent = editingId ? "Update Entry" : "Save Entry";
    // No markEditorClean here: a draft exists precisely because there was unsaved work, so
    // it stays measured against the blank baseline the preceding reset took, and both
    // buttons come back enabled.
    refreshEditorButtons();
    if (editingId) {
      document.querySelectorAll(".log-entry").forEach(n => n.classList.toggle("sel", n.dataset.id === editingId));
    }
    return true;
  }

  function loadAutosave() {
    let raw;
    try { raw = localStorage.getItem(AUTOSAVE_KEY); } catch (e) { return; }
    if (raw) adoptSave(raw, true);
  }

  // Accepts the parsed shape from either the autosave mirror or a picked file. Returns
  // false (and leaves the log untouched) if it isn't ours — silently replacing someone's
  // logbook with the contents of an unrelated JSON file is the one unrecoverable mistake
  // this app could make.
  function adoptSave(text, quiet) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) {
      if (!quiet) toast("That file isn't valid JSON.");
      return false;
    }
    if (!obj || obj.app !== SAVE_APP || !Array.isArray(obj.entries)) {
      if (!quiet) toast("That doesn't look like a hunting log file.");
      return false;
    }
    entries = obj.entries.map(normalizeEntry);
    seqCounter = entries.reduce((m, e) => Math.max(m, e.seq || 0), 0);
    renderLog();
    refreshPartyNames();
    // Mirror it immediately, not on the debounce. Opening a file used to leave the log in
    // memory only: it rendered, looked saved, and the next refresh restored whatever had
    // been in storage beforehand — so a freshly opened logbook silently vanished.
    writeLocalSave();
    return true;
  }
  // Anything read back off disk is treated as untrusted shape, not as our own object.
  function normalizeEntry(raw) {
    const e = raw && typeof raw === "object" ? raw : {};
    const str = (v) => (typeof v === "string" ? v : "");
    return {
      id: str(e.id) || newId(),
      seq: Number.isFinite(e.seq) ? e.seq : ++seqCounter,
      questKey: str(e.questKey),
      quest: e.quest && typeof e.quest === "object" ? e.quest : null,
      date: str(e.date),
      locale: str(e.locale),
      objective: str(e.objective),
      armor: str(e.armor),
      weapon: str(e.weapon),
      weaponType: str(e.weaponType),
      party: Array.isArray(e.party) ? e.party.filter(p => typeof p === "string") : [],
      carts: Math.max(0, Math.min(9, parseInt(e.carts, 10) || 0)),
      outcome: str(e.outcome),
      // Masked here, not just in the editor. The card and the copied text read the stored
      // value directly, so an entry written before the mask existed — or loaded from a
      // file — otherwise kept its old shape forever and copied out verbatim.
      clearTime: formatClearTime(str(e.clearTime), true),
      notes: str(e.notes),
    };
  }

  // ── Named save files ─────────────────────────────────────────────────────
  const supportsFsApi = "showSaveFilePicker" in window;
  const saveOpts = {
    suggestedName: "mhgu-hunting-log.json",
    types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
  };
  async function saveToFile() {
    const data = JSON.stringify(serializeSave(), null, 2);
    if (supportsFsApi) {
      try {
        if (!fileHandle) fileHandle = await window.showSaveFilePicker(saveOpts);
        const w = await fileHandle.createWritable();
        await w.write(data);
        await w.close();
        clearDirty();
        toast("Saved.");
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
        // Anything else (a revoked handle, a read-only location) falls through to a
        // plain download so the log is never trapped in the tab.
        fileHandle = null;
      }
    }
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mhgu-hunting-log.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    clearDirty();
    toast("Downloaded save file.");
  }
  async function openFile() {
    if (supportsFsApi) {
      try {
        const [h] = await window.showOpenFilePicker({ types: saveOpts.types });
        const f = await h.getFile();
        if (adoptSave(await f.text(), false)) {
          fileHandle = h;
          clearDirty();
          resetEditor();
          toast("Loaded " + entries.length + " entr" + (entries.length === 1 ? "y" : "ies") + ".");
        }
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    $("importFile").click();
  }
  $("importFile").addEventListener("change", function () {
    const file = this.files[0];
    this.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (adoptSave(ev.target.result, false)) {
        fileHandle = null;
        clearDirty();
        resetEditor();
        toast("Loaded " + entries.length + " entr" + (entries.length === 1 ? "y" : "ies") + ".");
      }
    };
    reader.readAsText(file);
  });
  window.addEventListener("beforeunload", (e) => {
    if (!dirty || !entries.length) return;
    e.preventDefault();
    e.returnValue = "";
  });

  // ── Quest browser ────────────────────────────────────────────────────────
  const questNodes = [];   // { q, btn, haystack, sub, grp }

  function buildTree() {
    const wrap = $("questTree");
    const byType = new Map();
    for (const q of DATA.quests) {
      if (!byType.has(q.Type)) byType.set(q.Type, new Map());
      const ranks = byType.get(q.Type);
      const label = rankLabel(q);
      if (!ranks.has(label)) ranks.set(label, []);
      ranks.get(label).push(q);
    }
    const types = [...byType.keys()].sort((a, b) => {
      const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    for (const type of types) {
      const ranks = byType.get(type);
      const grp = el("div", "qgrp");
      const head = el("div", "qhead");
      const twist = el("span", "qtwist", "▸");
      const count = el("span", "qcount", String([...ranks.values()].reduce((n, a) => n + a.length, 0)));
      head.append(twist, el("span", null, type), count);
      head.addEventListener("click", () => grp.classList.toggle("open"));
      const kids = el("div", "qkids");
      grp.append(head, kids);

      // Rank order follows the RANKS table, not insertion order.
      const order = (RANKS[type] || []).map(([, label]) => label);
      const rankNames = [...ranks.keys()].sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });

      for (const rname of rankNames) {
        const sub = el("div", "qgrp qsub");
        const shead = el("div", "qhead");
        const stwist = el("span", "qtwist", "▸");
        const scount = el("span", "qcount", String(ranks.get(rname).length));
        shead.append(stwist, el("span", null, rname), scount);
        shead.addEventListener("click", () => sub.classList.toggle("open"));
        const skids = el("div", "qkids");
        sub.append(shead, skids);

        for (const q of ranks.get(rname)) {
          const btn = el("button", "qitem");
          btn.type = "button";
          const icon = el("img", "qitem-icon");
          icon.src = questIcon(q);
          icon.alt = "";
          icon.addEventListener("error", () => { icon.src = FALLBACK_ICON; }, { once: true });
          btn.append(icon, el("span", "qitem-name", questShortName(q)));
          btn.title = q.Name;
          btn.addEventListener("click", () => selectQuest(q));
          skids.appendChild(btn);
          questNodes.push({
            q, btn, sub, grp, subCount: scount, grpCount: count,
            haystack: [q.Name, questShortName(q), questTargets(q).join(" "), q.Main, localeFull(q.Locale)]
              .join(" ").toLowerCase(),
          });
        }
        kids.appendChild(sub);
      }
      wrap.appendChild(grp);
    }
  }

  function filterTree() {
    const query = $("questSearch").value.trim().toLowerCase();
    const terms = query ? query.split(/\s+/) : [];
    const subHits = new Map(), grpHits = new Map();
    let total = 0;

    for (const n of questNodes) {
      const hit = terms.every(t => n.haystack.includes(t));
      n.btn.classList.toggle("hidden", !hit);
      if (!hit) continue;
      total++;
      subHits.set(n.sub, (subHits.get(n.sub) || 0) + 1);
      grpHits.set(n.grp, (grpHits.get(n.grp) || 0) + 1);
    }
    for (const n of questNodes) {
      const sHit = subHits.get(n.sub) || 0, gHit = grpHits.get(n.grp) || 0;
      n.sub.classList.toggle("hidden", sHit === 0);
      n.grp.classList.toggle("hidden", gHit === 0);
      // A search auto-opens what it found; clearing it collapses everything back.
      n.sub.classList.toggle("open", terms.length > 0);
      n.grp.classList.toggle("open", terms.length > 0);
      n.subCount.textContent = String(sHit);
      n.grpCount.textContent = String(gHit);
    }
    $("searchCount").textContent = terms.length
      ? total + " quest" + (total === 1 ? "" : "s") + " match"
      : DATA.quests.length + " quests";
  }

  // ── Editor ───────────────────────────────────────────────────────────────
  function selectQuest(q) {
    selectedQuest = q;
    // Only overwrite Locale when the user hasn't personalised it — so "Jurassic
    // Frontier / Night" survives switching quests, but a plain prefill gets replaced.
    const cur = $("f_locale").value.trim();
    if (!cur || cur === localeDefault) $("f_locale").value = localeFull(q.Locale);
    localeDefault = localeFull(q.Locale);

    renderQuestHead(q);
    document.querySelectorAll(".qitem.sel").forEach(b => b.classList.remove("sel"));
    const node = questNodes.find(n => n.q === q);
    if (node) node.btn.classList.add("sel");
    refreshEditorButtons();
    setView("editor");
    writeDraft();
  }

  function renderQuestHead(q) {
    const icon = $("q_icon"), hyper = $("q_hyper"), pills = $("q_pills");
    pills.innerHTML = "";
    if (!q) {
      $("q_name").textContent = "No quest selected";
      $("q_main").textContent = "Pick a quest from the list on the left to start an entry.";
      icon.src = FALLBACK_ICON;
      hyper.classList.add("hidden");
      return;
    }
    $("q_name").textContent = questDisplay(q);
    $("q_main").textContent = q.Main || "";
    icon.src = questIcon(q);
    icon.onerror = () => { icon.src = FALLBACK_ICON; icon.onerror = null; };
    // The overlay is a ring drawn around one monster's portrait, so it only reads as a
    // ring when there is one portrait. Deviants and multi-monster quests skip it, same
    // as the randomizer does.
    hyper.classList.toggle("hidden", !q.Hyper || q.Type === "Special Permits" || questTargets(q).length > 1);
    for (const [label, cls] of questPills(q)) pills.appendChild(el("span", "pill " + cls, label));
  }

  // datetime-local wants "YYYY-MM-DDTHH:mm" in *local* time, which toISOString isn't.
  function toDateInput(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function formatDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleString(undefined, {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  const FIELD_IDS = ["f_date", "f_locale", "f_objective", "f_armor", "f_weapon",
    "f_weaponType", "f_carts", "f_p1", "f_p2", "f_p3", "f_p4", "f_outcome", "f_time", "f_notes"];

  function readForm() {
    const party = ["f_p1", "f_p2", "f_p3", "f_p4"].map(id => $(id).value.trim()).filter(Boolean);
    return {
      questKey: selectedQuest ? questKey(selectedQuest) : "",
      quest: selectedQuest ? {
        Name: selectedQuest.Name, Type: selectedQuest.Type, Level: selectedQuest.Level,
        Main: selectedQuest.Main, Locale: selectedQuest.Locale,
        Monster: selectedQuest.Monster, Monsters: selectedQuest.Monsters.slice(),
        Hyper: selectedQuest.Hyper, Capture: selectedQuest.Capture, Key: selectedQuest.Key,
        LgMonster: selectedQuest.LgMonster, SmMonsters: selectedQuest.SmMonsters,
        Egg: selectedQuest.Egg, Gathering: selectedQuest.Gathering, Prowler: selectedQuest.Prowler,
      } : null,
      date: $("f_date").value,
      locale: $("f_locale").value.trim(),
      objective: $("f_objective").value.trim(),
      armor: $("f_armor").value.trim(),
      weapon: $("f_weapon").value.trim(),
      weaponType: $("f_weaponType").value,
      party,
      carts: Math.max(0, Math.min(9, parseInt($("f_carts").value, 10) || 0)),
      outcome: $("f_outcome").value,
      clearTime: $("f_time").value.trim(),
      notes: $("f_notes").value.trim(),
    };
  }

  function writeForm(e) {
    $("f_date").value = e.date || "";
    $("f_locale").value = e.locale || "";
    $("f_objective").value = e.objective || "";
    $("f_armor").value = e.armor || "";
    $("f_weapon").value = e.weapon || "";
    $("f_weaponType").value = e.weaponType || "";
    $("f_carts").value = e.carts != null ? e.carts : 0;
    ["f_p1", "f_p2", "f_p3", "f_p4"].forEach((id, i) => { $(id).value = (e.party || [])[i] || ""; });
    $("f_outcome").value = e.outcome || "";
    // Run stored values through the mask too, so an entry written before it existed
    // (or imported from the markdown diary as "6'02") shows in the same MM'SS shape.
    $("f_time").value = formatClearTime(e.clearTime, true);
    $("f_notes").value = e.notes || "";
    syncWeapon();
  }

  // ── Editor dirty state ───────────────────────────────────────────────────
  // Save and Cancel stay disabled until the form differs from what it was loaded with, so
  // neither offers to act when there is nothing to act on. The baseline is re-taken
  // whenever the editor is (re)loaded: a reset, opening an entry, or saving an edit.
  //
  // The date is inside the snapshot on purpose. It's stamped by the reset that also takes
  // the baseline, so it reads as unchanged until the hunter actually edits it.
  let editorBaseline = "";
  const editorSnapshot = () => JSON.stringify(readForm());
  function refreshEditorButtons() {
    const changed = editorSnapshot() !== editorBaseline;
    // Farming leaves the form standing after a save, so it would otherwise read as
    // unchanged and lock the button that files the next run. Filing the same form again is
    // the whole point of the mode, so the gate lifts — but only while composing, never
    // while editing, where Save as New already covers repeats.
    const repeatable = farming && !editingId;
    // Saving additionally needs a quest — an entry without one has nothing to name it.
    $("saveEntryBtn").disabled = (!changed && !repeatable) || !selectedQuest;
    $("cancelEntryBtn").disabled = !changed;
    $("saveAsNewBtn").disabled = !selectedQuest;
  }
  // Keeps the checkbox and the switch's appearance in step. Both are set here rather than
  // letting CSS read :checked off the input, so a state restored at boot renders correctly.
  function syncFarmingSwitch() {
    $("farmingToggle").checked = farming;
    $("farmingToggle").closest(".farm-toggle").classList.toggle("on", farming);
  }

  function markEditorClean() {
    editorBaseline = editorSnapshot();
    refreshEditorButtons();
  }

  // Leaves edit mode without touching the fields. Split out for farming, which files the
  // form as a hunt and keeps it on screen: what's showing afterwards is an unsaved entry
  // rather than the one that was opened, so Update, Delete and Save as New have to stand
  // down even though nothing was cleared.
  function exitEditMode() {
    editingId = null;
    document.querySelectorAll(".log-entry.sel").forEach(n => n.classList.remove("sel"));
    $("deleteEntryBtn").classList.add("hidden");
    $("saveAsNewBtn").classList.add("hidden");
    $("saveEntryBtn").textContent = "Save Entry";
  }

  // Back to a blank entry: every field, the quest, and the tree selection.
  function resetEditor() {
    exitEditMode();
    $("f_date").value = toDateInput(new Date());
    ["f_locale", "f_objective", "f_armor", "f_weapon", "f_time", "f_notes",
     "f_p1", "f_p2", "f_p3", "f_p4"].forEach(id => { $(id).value = ""; });
    $("f_weaponType").value = "";
    $("f_carts").value = 0;
    $("f_outcome").value = "";
    selectedQuest = null;
    localeDefault = "";
    document.querySelectorAll(".qitem.sel").forEach(b => b.classList.remove("sel"));
    renderQuestHead(null);
    syncWeapon();
    markEditorClean();
    writeDraft();
  }

  function editEntry(entry) {
    editingId = entry.id;
    const q = QUESTS_BY_KEY.get(entry.questKey);
    // Fall back to the snapshot taken when the entry was written, so an entry survives
    // its quest being renamed or dropped by a data rebuild.
    selectedQuest = q || entry.quest || null;
    localeDefault = selectedQuest ? localeFull(selectedQuest.Locale) : "";
    renderQuestHead(selectedQuest);
    document.querySelectorAll(".qitem.sel").forEach(b => b.classList.remove("sel"));
    const node = questNodes.find(n => n.q === q);
    if (node) {
      node.btn.classList.add("sel");
      node.sub.classList.add("open");
      node.grp.classList.add("open");
      node.btn.scrollIntoView({ block: "nearest" });
    }
    writeForm(entry);
    $("deleteEntryBtn").classList.remove("hidden");
    $("saveAsNewBtn").classList.remove("hidden");
    $("saveEntryBtn").textContent = "Update Entry";
    // The entry as loaded is the baseline, so Update stays disabled until it's edited.
    markEditorClean();
    document.querySelectorAll(".log-entry").forEach(n => n.classList.toggle("sel", n.dataset.id === entry.id));
    setView("editor");
    writeDraft();
  }

  function saveEntry() {
    if (!selectedQuest) return;
    const data = readForm();
    if (editingId) {
      const i = entries.findIndex(e => e.id === editingId);
      if (i >= 0) entries[i] = Object.assign({}, entries[i], data);
      markDirty();
      renderLog();
      refreshPartyNames();
      document.querySelectorAll(".log-entry").forEach(n => n.classList.toggle("sel", n.dataset.id === editingId));
      // The edit is now the saved state, so Update goes back to disabled until it's
      // edited again — pressing it twice can't do anything the first press didn't.
      markEditorClean();
      writeDraft();
      toast("Entry updated.");
    } else {
      addEntry(data);
      toast("Entry added.");
    }
  }

  // Appends a hunt and clears the form — shared by Save Entry and Save as New so a hunt
  // recorded either way is identical, and gets its own entry number rather than a copy.
  function addEntry(data) {
    entries.push(Object.assign({ id: newId(), seq: ++seqCounter }, data));
    markDirty();
    renderLog();
    refreshPartyNames();
    if (farming) {
      // Everything stays put for the next run. Only edit mode ends, because the form now
      // represents a hunt that hasn't been filed rather than the one that was opened.
      exitEditMode();
      refreshEditorButtons();
      writeDraft();
    } else {
      resetEditor();
    }
  }

  // Farming the same quest: open the last run, adjust what differed, and file it as
  // another hunt rather than overwriting the one you opened.
  //
  // Unlike Update, this doesn't require a change. Two runs of the same quest with the same
  // loadout and the same result are a perfectly ordinary pair of entries, and refusing to
  // record the second because it matches the first would be the wrong call.
  function saveAsNewEntry() {
    if (!selectedQuest) return;
    addEntry(readForm());
    toast("Saved as a new entry.");
  }

  function deleteEntry(id) {
    const i = entries.findIndex(e => e.id === id);
    if (i < 0) return;
    entries.splice(i, 1);
    markDirty();
    renderLog();
    refreshPartyNames();
    if (editingId === id) resetEditor();
    toast("Entry deleted.");
  }

  // The Weapon field follows the type: the type supplies its icon, and it fills the
  // autocomplete with just that type's weapons (~250-400 names each, 5281 in total —
  // offering all of them at once would make the list useless).
  //
  // It stays a plain text input, so a name that isn't in the list is still accepted.
  function syncWeapon() {
    const type = $("f_weaponType").value;
    const input = $("f_weapon");
    const img = $("f_weaponIcon");

    img.classList.toggle("hidden", !type);
    if (type) {
      img.src = weaponIcon(type);
      img.onerror = () => { img.classList.add("hidden"); img.onerror = null; };
    }

    // Disabled only while there is nothing to lose: an entry that already carries a
    // weapon name but no type (imported ones do) has to stay editable.
    const lock = !type && !input.value.trim();
    input.disabled = lock;
    input.placeholder = lock ? "Pick a weapon type first" : "Dual Scissors";

    const names = (WEAPON_NAMES[type] || []);
    if (names === weaponListFor) return;   // same type as last time — leave the DOM alone
    weaponListFor = names;
    const list = $("weaponNames");
    list.innerHTML = "";
    if (!names.length) return;
    const frag = document.createDocumentFragment();
    for (const n of names) {
      const o = document.createElement("option");
      o.value = n;
      frag.appendChild(o);
    }
    list.appendChild(frag);
  }

  // Clear Time is a digit mask in the game's own shape, MM'SS"CC — minutes, seconds,
  // hundredths. Everything that isn't a digit is dropped and the separators are placed
  // from the right, so typing 6 3 1 8 3 walks through 6, 63, 6'31, 63'18, 6'31"83 and
  // lands on exactly what the results screen showed you.
  //
  // `settle` is for when editing finishes: it pads each part out to two digits and clamps
  // minutes to 49 and seconds to 59, a quest running out at 50 minutes. Hundredths need no
  // clamp — two digits can't exceed 99.
  //
  // The clamp only runs on settle, never while typing: "1'84" is a legitimate waypoint on
  // the way to "18'42", and clamping it live to "1'59" would eat the next digit.
  const MAX_MIN = 49, MAX_SEC = 59;
  function formatClearTime(value, settle) {
    const d = String(value || "").replace(/\D/g, "").slice(0, 6);
    if (!d) return "";
    const clamp = (n, max) => String(Math.min(max, n)).padStart(2, "0");
    if (d.length <= 2) {
      return settle ? clamp(parseInt(d, 10), MAX_MIN) + "'00\"00" : d;
    }
    if (d.length <= 4) {
      const mm = d.slice(0, -2), ss = d.slice(-2);
      return settle
        ? clamp(parseInt(mm, 10), MAX_MIN) + "'" + clamp(parseInt(ss, 10), MAX_SEC) + "\"00"
        : mm + "'" + ss;
    }
    const cc = d.slice(-2), ss = d.slice(-4, -2), mm = d.slice(0, -4);
    return settle
      ? clamp(parseInt(mm, 10), MAX_MIN) + "'" + clamp(parseInt(ss, 10), MAX_SEC) + "\"" + cc
      : mm + "'" + ss + "\"" + cc;
  }

  function refreshPartyNames() {
    const names = new Set();
    for (const e of entries) for (const p of e.party || []) if (p) names.add(p);
    const list = $("partyNames");
    list.innerHTML = "";
    [...names].sort((a, b) => a.localeCompare(b)).forEach(n => {
      const o = document.createElement("option");
      o.value = n;
      list.appendChild(o);
    });
  }

  // ── Logbook ──────────────────────────────────────────────────────────────
  // `seq` is the entry number: assigned once when an entry is created and never reused,
  // so it records the order hunts were written down — which is not the order they happened
  // if you backfill a session. Deleting an entry leaves a gap on purpose; the number
  // identifies an entry rather than counting its position.
  //
  // Blank dates go last in BOTH date directions. They're a "no date recorded" bucket, not
  // a point on the timeline, so flipping them to the top on oldest-first would be claiming
  // a chronology the entry doesn't have.
  const byDate = (dir) => (a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? dir : -dir;
    }
    return (b.seq || 0) - (a.seq || 0);
  };
  const SORTS = {
    dateDesc: { asc: false, cmp: byDate(1) },
    dateAsc:  { asc: true,  cmp: byDate(-1) },
    seqDesc:  { asc: false, cmp: (a, b) => (b.seq || 0) - (a.seq || 0) },
    seqAsc:   { asc: true,  cmp: (a, b) => (a.seq || 0) - (b.seq || 0) },
  };
  const SORT_KEY = "mhgu-log-sort";
  let sortBy = "dateDesc";
  try { sortBy = localStorage.getItem(SORT_KEY) || "dateDesc"; } catch (e) {}
  if (!SORTS[sortBy]) sortBy = "dateDesc";

  const sortedEntries = () => entries.slice().sort(SORTS[sortBy].cmp);

  function entryQuest(e) {
    return QUESTS_BY_KEY.get(e.questKey) || e.quest || null;
  }
  function entryQuestDisplay(e) {
    const q = entryQuest(e);
    return q ? questDisplay(q) : "(quest no longer in data)";
  }

  // ── Grouping ─────────────────────────────────────────────────────────────
  // Each mode is: a key to bucket on, a heading for that key, and how to order the
  // buckets. Entries with no value fall into the "" bucket, which always sorts last.
  //
  // Only fields the log reliably holds are offered. Clear Time is the notable omission:
  // the mask works, but nothing recorded times before it existed, so grouping on it would
  // put every entry in one nameless pile.
  const GROUP_KEY = "mhgu-log-group";
  const dayTitle = (k) => {
    const d = new Date(k + "T00:00");
    return isNaN(d) ? k : d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  };
  const primaryMonster = (e) => {
    const q = entryQuest(e);
    if (!q) return "";
    return (q.Monsters && q.Monsters.length ? q.Monsters[0] : q.Monster) || "";
  };
  const OUTCOME_ORDER = ["Success", "Fail", "Abandoned"];
  const alpha = (a, b) => a.localeCompare(b);

  const GROUPINGS = {
    none: { label: "Nothing" },
    date: {
      label: "Day",
      key: (e) => (e.date || "").slice(0, 10),
      title: (k) => dayTitle(k),
      // Follows the chosen sort direction, so the days don't run newest-first while the
      // hunts inside them run oldest-first.
      order: (a, b) => SORTS[sortBy].asc ? a.localeCompare(b) : b.localeCompare(a),
    },
    rank: {
      label: "Quest rank",
      // Requires a level that maps to a real rank. An entry the importer couldn't link
      // carries Type but Level 0, which would otherwise head its own "Village Level 0"
      // group; it belongs with the rest of the unranked.
      key: (e) => {
        const q = entryQuest(e);
        if (!q || !q.Type) return "";
        const known = (RANKS[q.Type] || []).some(([lv]) => lv === q.Level);
        return known ? q.Type + "|" + q.Level : "";
      },
      title: (k) => { const [t, lv] = k.split("|"); return t + " " + rankLabel({ Type: t, Level: +lv }); },
      // Village 1★ through to the G-rank Pub, i.e. the order you played them in.
      order: (a, b) => {
        const rank = (k) => {
          const [t, lv] = k.split("|");
          const i = TYPE_ORDER.indexOf(t);
          return (i < 0 ? 99 : i) * 1000 + (+lv || 0);
        };
        return rank(a) - rank(b);
      },
    },
    monster: {
      label: "Monster",
      key: (e) => primaryMonster(e),
      title: (k) => k,
      order: alpha,
    },
    quest: {
      label: "Quest",
      key: (e) => e.questKey || (e.quest && e.quest.Name) || "",
      title: (k, rows) => entryQuestDisplay(rows[0]),
      order: null,                                   // sorted by heading text instead
    },
    outcome: {
      label: "Outcome",
      key: (e) => e.outcome || "",
      title: (k) => k,
      order: (a, b) => OUTCOME_ORDER.indexOf(a) - OUTCOME_ORDER.indexOf(b),
    },
    carts: {
      label: "Carts",
      key: (e) => String(e.carts || 0),
      title: (k) => k === "1" ? "1 cart" : k + " carts",
      order: (a, b) => (+a) - (+b),
    },
  };
  const EMPTY_TITLE = {
    date: "No date", rank: "Unranked", monster: "No monster",
    quest: "Unknown quest", outcome: "No outcome",
  };

  let groupBy = "none";
  try { groupBy = localStorage.getItem(GROUP_KEY) || "none"; } catch (e) {}
  if (!GROUPINGS[groupBy]) groupBy = "none";

  // ── Selection ────────────────────────────────────────────────────────────
  // Which entries are ticked for copying. Held in memory rather than storage: it's an
  // action in progress, not a property of the log. It does survive a re-render, so
  // changing the sort or grouping mid-selection doesn't throw the ticks away.
  const selected = new Set();
  // Rendered order and the card for each id, so a shift-click can walk the range between
  // two ticks. Rebuilt by renderLog, because the order is whatever the sort and grouping
  // currently produce — a range means "everything between these two on screen".
  let renderedOrder = [];
  const cardsById = new Map();
  // The last box ticked without shift. Shift-clicking extends from here, and the anchor
  // stays put afterwards so the range can be widened or narrowed by clicking again.
  let pickAnchor = null;

  function applyPick(id, on) {
    if (on) selected.add(id); else selected.delete(id);
    const card = cardsById.get(id);
    if (!card) return;
    const box = card.querySelector(".le-pick");
    if (box) box.checked = on;
    card.classList.toggle("picked", on);
  }

  function updateSelectionUI() {
    const n = selected.size;
    const all = entries.length;
    $("copySelBtn").textContent = n ? `Copy Selected (${n})` : "Copy Selected";
    $("copySelBtn").disabled = n === 0;
    $("clearSelBtn").disabled = n === 0;
    const box = $("selectAll");
    box.checked = all > 0 && n === all;
    box.indeterminate = n > 0 && n < all;
    box.disabled = all === 0;
  }

  function renderLog() {
    const list = $("lbList");
    list.innerHTML = "";
    $("lbCount").textContent = String(entries.length);
    $("lbCountTab").textContent = String(entries.length);
    renderedOrder = [];
    cardsById.clear();
    // Drop ticks for entries that no longer exist — deleted, or replaced by a loaded file.
    const live = new Set(entries.map(e => e.id));
    for (const id of [...selected]) if (!live.has(id)) selected.delete(id);
    if (pickAnchor && !live.has(pickAnchor)) pickAnchor = null;
    updateSelectionUI();
    if (!entries.length) {
      list.appendChild(el("p", "lb-empty", "No hunts logged yet. Pick a quest, fill in the details, and press Save Entry."));
      return;
    }

    const rows = sortedEntries();
    const g = GROUPINGS[groupBy];
    if (!g || !g.key) {
      rows.forEach(e => list.appendChild(entryCard(e)));
      return;
    }

    const buckets = new Map();
    for (const e of rows) {
      const k = g.key(e);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(e);
    }
    // Resolve headings first so "quest" can order by the name it displays rather than by
    // its "Hub//Hub 6★ // …" key, which would sort by rank prefix instead of title.
    const groups = [...buckets.entries()].map(([k, rows2]) => ({
      key: k,
      rows: rows2,
      title: k ? g.title(k, rows2) : (EMPTY_TITLE[groupBy] || "—"),
    }));
    groups.sort((a, b) => {
      if (!a.key !== !b.key) return a.key ? -1 : 1;   // the empty bucket sits at the end
      if (!a.key) return 0;
      return g.order ? g.order(a.key, b.key) : alpha(a.title, b.title);
    });

    for (const grp of groups) {
      const head = el("div", "lb-group");
      head.append(el("span", "lb-group-name", grp.title), el("span", "lb-group-count", String(grp.rows.length)));
      list.appendChild(head);
      grp.rows.forEach(e => list.appendChild(entryCard(e)));
    }
  }

  function entryCard(e) {
    {
      const q = entryQuest(e);
      const card = el("div", "log-entry");
      card.dataset.id = e.id;
      renderedOrder.push(e.id);
      cardsById.set(e.id, card);

      const top = el("div", "le-top");
      // Ticking must not open the entry for editing, hence the stopPropagation on the
      // click as well as the change — the card's own click handler sits above this.
      const pick = el("input", "le-pick");
      pick.type = "checkbox";
      pick.checked = selected.has(e.id);
      pick.title = "Select for copying (shift-click for a range)";
      pick.setAttribute("aria-label", "Select entry " + (e.seq || 0) + " for copying");
      // Everything happens on click rather than change: only click carries shiftKey, and
      // it still fires when the box is toggled from the keyboard, so nothing is lost.
      pick.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const on = pick.checked;              // the browser has already toggled it
        applyPick(e.id, on);
        const from = ev.shiftKey && pickAnchor !== null ? renderedOrder.indexOf(pickAnchor) : -1;
        const to = renderedOrder.indexOf(e.id);
        if (from >= 0 && to >= 0) {
          // Whole range takes the state of the box just clicked, so shift-click un-ticks
          // a run as readily as it ticks one.
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (let i = lo; i <= hi; i++) applyPick(renderedOrder[i], on);
        } else {
          pickAnchor = e.id;                  // plain click sets the anchor
        }
        updateSelectionUI();
      });
      const icon = el("img", "le-icon");
      icon.src = questIcon(q);
      icon.alt = "";
      icon.addEventListener("error", () => { icon.src = FALLBACK_ICON; }, { once: true });
      const mid = el("div");
      mid.style.cssText = "flex:1;min-width:0";
      mid.append(el("div", "le-quest", entryQuestDisplay(e)));
      const meta = ["#" + (e.seq || 0), formatDate(e.date), "Carts: " + (e.carts || 0)]
        .filter(Boolean).join(" · ");
      mid.append(el("div", "le-date", meta));
      top.append(pick, icon, mid);
      if (e.outcome) top.append(el("span", "le-outcome " + e.outcome, e.outcome));
      card.classList.toggle("picked", pick.checked);
      card.appendChild(top);

      const dl = el("dl", "le-fields");
      const row = (label, value, cls) => {
        if (!value) return;
        const d = el("div");
        d.append(el("dt", null, label), el("dd", cls || null, value));
        dl.appendChild(d);
      };
      row("Locale", e.locale);
      row("Objective", e.objective);
      row("Armor", e.armor);
      row("Weapon", e.weapon || e.weaponType);
      row("Party", (e.party || []).join(", "));
      row("Time", e.clearTime);
      row("Notes", e.notes, "le-notes");
      if (dl.children.length) card.appendChild(dl);

      const actions = el("div", "le-actions");
      // The whole card is clickable, but that isn't reachable by keyboard — this button
      // is the accessible route to the same thing.
      const editBtn = el("button", "btn tiny", "Edit");
      editBtn.type = "button";
      editBtn.addEventListener("click", (ev) => { ev.stopPropagation(); editEntry(e); });
      const delBtn = el("button", "btn tiny", "Delete");
      delBtn.type = "button";
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        confirmAction("Delete this entry?", entryQuestDisplay(e), () => deleteEntry(e.id));
      });
      actions.append(editBtn, delBtn);
      card.appendChild(actions);

      card.addEventListener("click", () => editEntry(e));
      return card;
    }
  }

  // ── Copy ─────────────────────────────────────────────────────────────────
  // Field order is deliberate — it matches the logbook format this app was built for.
  // The date is omitted from a single-entry copy (it's already visible in the UI) so
  // the text is exactly the seven-line form; Copy All leads with it instead.
  function entryToText(e, withDate) {
    const lines = [];
    if (withDate && e.date) lines.push("Date: " + formatDate(e.date));
    lines.push("Quest: " + entryQuestDisplay(e));
    if (e.locale) lines.push("Locale: " + e.locale);
    if (e.objective) lines.push("Objective: " + e.objective);
    if (e.armor) lines.push("Armor Used: " + e.armor);
    if (e.weapon || e.weaponType) lines.push("Weapon: " + (e.weapon || e.weaponType));
    if ((e.party || []).length) lines.push("Hunting Party: " + e.party.join(", "));
    lines.push("Carts: " + (e.carts || 0));
    if (e.outcome) lines.push("Outcome: " + e.outcome);
    if (e.clearTime) lines.push("Clear Time: " + e.clearTime);
    if (e.notes) lines.push("Notes: " + e.notes);
    return lines.join("\n");
  }
  function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return toast("Copied.");
      const orig = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }, () => toast("Couldn't reach the clipboard."));
  }

  // ── Confirm dialog ───────────────────────────────────────────────────────
  let confirmFn = null;
  function confirmAction(title, body, fn) {
    $("confirmTitle").textContent = title;
    $("confirmBody").textContent = body || "";
    confirmFn = fn;
    $("confirmModal").classList.remove("hidden");
  }
  $("confirmOk").addEventListener("click", () => {
    $("confirmModal").classList.add("hidden");
    const fn = confirmFn; confirmFn = null;
    if (fn) fn();
  });
  $("confirmCancel").addEventListener("click", () => {
    $("confirmModal").classList.add("hidden");
    confirmFn = null;
  });

  // ── Theme ────────────────────────────────────────────────────────────────
  const hexRgb = (h) => { h = h.replace("#", ""); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const rgbToHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const l = (max + min) / 2;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
            : max === g ? ((b - r) / d + 2) / 6
            :             ((r - g) / d + 4) / 6;
    return [h, s, l];
  };
  const hslToRgb = ([h, s, l]) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h * 6) % 2 - 1)), m = l - c / 2;
    const hi = Math.floor(h * 6) % 6;
    const [r, g, b] = hi === 0 ? [c, x, 0] : hi === 1 ? [x, c, 0] : hi === 2 ? [0, c, x]
                    : hi === 3 ? [0, x, c] : hi === 4 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m].map(v => clamp(v * 255));
  };
  // darken/lighten only nudge lightness in HSL space, so the hue and saturation of the
  // chosen theme color are preserved — every derived shade stays "in family."
  const darken = (rgb, f) => { const [h, s, l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l * f)]); };
  const lighten = (rgb, b) => { const [h, s, l] = rgbToHsl(rgb); return hslToRgb([h, s, clamp01(l + (1 - l) * b)]); };
  const css = (rgb) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

  // Every shade is a fixed multiple of the chosen colour's lightness, matching the
  // Collection Tracker and the Randomizer so a theme looks like itself in all three.
  //
  // Fixed factors are the point, not a shortcut. The palette is thirteen dark/light pairs
  // of one hue — Tigrex and Rajang are the same yellow, Teostra and Rathalos the same red —
  // and a factor keeps that relationship because it scales both ends. Normalising the
  // surfaces to equal brightness instead, however even it looks in isolation, collapses
  // every pair onto the same colour and throws the palette away.

  const THEME_KEY = "mhgu-log-theme";
  function applyTheme(hex) {
    const c = hexRgb(hex), r = document.documentElement.style;
    const bright = c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
    const isLight = bright > 230;
    if (isLight) {
      r.setProperty("--bg", css(darken(c, .99)));
      r.setProperty("--bg1", css(darken(c, .99)));
      r.setProperty("--bg2", css(darken(c, .99)));
      r.setProperty("--hover", css(darken(c, .99)));
      r.setProperty("--accent", css(darken(c, .99)));
      r.setProperty("--accent-hover", css(darken(c, 0.1)));
      r.setProperty("--content-bg", css(darken(c, .99)));
      r.setProperty("--panel-bg", css(darken(c, .99)));
      r.setProperty("--input-bg", css(darken(c, .99)));
      r.setProperty("--titlebar-overlay", "rgba(0,0,0,0.02)");
    } else {
      r.setProperty("--bg", css(darken(c, .70)));
      r.setProperty("--bg1", css(darken(c, .80)));
      // The two big panes, named and valued as in the Collection Tracker: its grid
      // backdrop and its detail panel are the same job as the editor and the logbook here.
      r.setProperty("--content-bg", css(darken(c, .55)));
      r.setProperty("--panel-bg", css(darken(c, .40)));
      // Form fields, at the Tracker's --grid-bg value: its grid cells do the same job,
      // small inset controls on a tinted pane, and are likewise darker than what they sit
      // on rather than lighter. At --bg2 they read as lit panels on the brighter themes.
      r.setProperty("--input-bg", css(darken(c, .35)));
      r.setProperty("--bg2", css(darken(c, .95)));
      r.setProperty("--hover", css(darken(c, .30)));
      r.setProperty("--accent", css(darken(c, .7)));
      r.setProperty("--accent-hover", css(lighten(c, .4)));
      r.setProperty("--titlebar-overlay", "rgba(0,0,0,0.18)");
    }
    r.setProperty("--text", isLight ? "#000000" : "#ffffff");
    r.setProperty("--text-dim", isLight ? "#000000" : "#fffffff5");
    r.setProperty("--line", isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.14)");
    r.setProperty("--card", isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)");
    try { localStorage.setItem(THEME_KEY, hex); } catch (e) {}
    document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("sel", s.dataset.hex === hex));
    const titleIcon = document.querySelector(".title-icon");
    if (titleIcon) {
      const name = COLORS_HEX[hex.toUpperCase()];
      titleIcon.src = name ? monsterIcon(COLORS_ICON[name] || name) : FALLBACK_ICON;
      titleIcon.onerror = () => { titleIcon.src = FALLBACK_ICON; titleIcon.onerror = null; };
    }
  }
  function buildSwatches() {
    const wrap = $("swatches");
    wrap.innerHTML = "";
    for (const [name, hex] of COLORS) {
      const d = el("div", "swatch");
      d.dataset.hex = hex;
      d.style.background = hex;
      d.title = name;
      const img = el("img", "swatch-icon");
      img.src = monsterIcon(COLORS_ICON[name] || name);
      img.alt = "";
      img.addEventListener("error", () => { img.src = FALLBACK_ICON; }, { once: true });
      d.append(img, el("span", null, name));
      d.addEventListener("click", () => applyTheme(hex));
      wrap.appendChild(d);
    }
  }

  // ── Narrow-screen view switching ─────────────────────────────────────────
  function setView(v) {
    $("app").dataset.view = v;
    $("tabEditor").classList.toggle("sel", v === "editor");
    $("tabLog").classList.toggle("sel", v === "log");
  }

  // ── Wiring ───────────────────────────────────────────────────────────────
  const modal = (btnId, modalId, closeId) => {
    $(btnId).addEventListener("click", () => $(modalId).classList.remove("hidden"));
    $(closeId).addEventListener("click", () => $(modalId).classList.add("hidden"));
    $(modalId).addEventListener("click", (e) => { if (e.target.id === modalId) $(modalId).classList.add("hidden"); });
  };
  modal("helpBtn", "helpModal", "helpClose");
  modal("linksBtn", "linksModal", "linksClose");
  modal("aboutBtn", "aboutModal", "aboutClose");
  modal("themeBtn", "themeModal", "themeClose");
  $("confirmModal").addEventListener("click", (e) => {
    if (e.target.id === "confirmModal") { $("confirmModal").classList.add("hidden"); confirmFn = null; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal:not(.hidden)").forEach(m => m.classList.add("hidden"));
    confirmFn = null;
  });

  $("questSearch").addEventListener("input", filterTree);
  $("treeExpand").addEventListener("click", () => document.querySelectorAll(".qgrp").forEach(g => g.classList.add("open")));
  $("treeCollapse").addEventListener("click", () => document.querySelectorAll(".qgrp").forEach(g => g.classList.remove("open")));

  $("newBtn").addEventListener("click", () => { resetEditor(); setView("editor"); });
  $("saveBtn").addEventListener("click", saveToFile);
  $("openBtn").addEventListener("click", openFile);
  $("saveEntryBtn").addEventListener("click", saveEntry);
  $("saveAsNewBtn").addEventListener("click", saveAsNewEntry);
  $("farmingToggle").addEventListener("change", function () {
    farming = this.checked;
    try { localStorage.setItem(FARMING_KEY, farming ? "1" : "0"); } catch (e) {}
    syncFarmingSwitch();
    refreshEditorButtons();
    toast(farming ? "Farming on — the form stays filled after saving."
                  : "Farming off — the form clears after saving.");
  });
  $("cancelEntryBtn").addEventListener("click", () => resetEditor());
  $("deleteEntryBtn").addEventListener("click", () => {
    if (!editingId) return;
    const e = entries.find(x => x.id === editingId);
    if (e) confirmAction("Delete this entry?", entryQuestDisplay(e), () => deleteEntry(e.id));
  });
  // Mirror the editor to the draft on every keystroke, so an entry in progress survives
  // the tab closing. Delegated, so fields added later are covered without extra wiring.
  // The draft write is debounced, but the buttons have to answer the keystroke that just
  // happened, so they refresh immediately.
  const onEditorEdit = () => { scheduleDraftSave(); refreshEditorButtons(); };
  $("editorPane").addEventListener("input", onEditorEdit);
  $("editorPane").addEventListener("change", onEditorEdit);
  $("f_weaponType").addEventListener("change", syncWeapon);
  // Reformat as they type, then pad the minutes once they leave the field.
  $("f_time").addEventListener("input", function () {
    this.value = formatClearTime(this.value, false);
  });
  $("f_time").addEventListener("blur", function () {
    this.value = formatClearTime(this.value, true);
  });
  // Copies in the order shown, so what lands in Discord matches what's on screen.
  //
  // One entry comes out as the bare seven-line form, the way the old per-entry Copy did.
  // Several get a Date line each, because a run of otherwise-similar blocks is unreadable
  // without something to separate them.
  $("copySelBtn").addEventListener("click", () => {
    const picked = sortedEntries().filter(e => selected.has(e.id));
    if (!picked.length) return;
    const text = picked.map(e => entryToText(e, picked.length > 1)).join("\n\n");
    copyText(text, $("copySelBtn"));
  });
  $("selectAll").addEventListener("change", function () {
    const on = this.checked;
    entries.forEach(e => applyPick(e.id, on));
    pickAnchor = null;   // a bulk change leaves no meaningful place to extend a range from
    updateSelectionUI();
  });
  // Worth its own button rather than leaning on the All box: while a partial selection has
  // that box indeterminate, clicking it selects everything instead of clearing, so wiping
  // a few ticks otherwise takes two clicks and passes through "all 236 selected".
  $("clearSelBtn").addEventListener("click", () => {
    entries.forEach(e => applyPick(e.id, false));
    pickAnchor = null;
    updateSelectionUI();
  });
  $("sortBy").addEventListener("change", function () {
    sortBy = SORTS[this.value] ? this.value : "dateDesc";
    try { localStorage.setItem(SORT_KEY, sortBy); } catch (e) {}
    renderLog();
    if (editingId) {
      document.querySelectorAll(".log-entry").forEach(n => n.classList.toggle("sel", n.dataset.id === editingId));
    }
  });
  $("groupBy").addEventListener("change", function () {
    groupBy = GROUPINGS[this.value] ? this.value : "none";
    try { localStorage.setItem(GROUP_KEY, groupBy); } catch (e) {}
    renderLog();
    // Keep the entry being edited highlighted through the re-render.
    if (editingId) {
      document.querySelectorAll(".log-entry").forEach(n => n.classList.toggle("sel", n.dataset.id === editingId));
    }
  });
  $("tabEditor").addEventListener("click", () => setView("editor"));
  $("tabLog").addEventListener("click", () => setView("log"));

  // ── Boot ─────────────────────────────────────────────────────────────────
  WEAPONS.forEach(w => $("f_weaponType").add(new Option(w, w)));
  buildSwatches();
  // Fall back to the default when the stored hex is no longer in the palette — a theme
  // that has since been removed would otherwise load with no swatch to match it, leaving
  // the picker showing nothing as selected.
  const DEFAULT_THEME = "#1E2025";
  let savedTheme = DEFAULT_THEME;
  try { savedTheme = migrateHex(localStorage.getItem(THEME_KEY)) || savedTheme; } catch (e) {}
  if (!COLORS_HEX[String(savedTheme).toUpperCase()]) savedTheme = DEFAULT_THEME;
  applyTheme(savedTheme);

  $("sortBy").value = sortBy;
  $("groupBy").value = groupBy;
  syncFarmingSwitch();
  buildTree();
  filterTree();
  loadAutosave();
  renderLog();
  refreshPartyNames();
  // Read before resetEditor(), which writes the draft and would clear it.
  let bootDraft = null;
  try { bootDraft = localStorage.getItem(DRAFT_KEY); } catch (e) {}
  resetEditor();
  // After resetEditor, so the restored draft wins over the blank form it just built.
  if (loadDraft(bootDraft)) {
    writeDraft();   // put it back, since resetEditor just cleared the stored copy
    toast("Picked up the entry you were writing.");
  }
  setView("editor");

  // Force a repaint after the MHFU custom font loads to prevent select text clipping.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      document.querySelectorAll("select").forEach(s => {
        s.style.display = "none"; s.offsetHeight; s.style.display = "";
      });
    });
  }
})();
