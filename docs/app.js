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
    ["Tetsucabra", "#c65900"], ["Agnaktor", "#fc933e"],
    ["Tigrex", "#C8A319"], ["Rajang", "#f1d364"],
    ["Deviljho", "#0B570F"], ["Rathian", "#3a9b3f"],
    ["Astalos", "#14503d"], ["Zinogre", "#2dae85"],
    ["Zamtrios", "#005984"], ["Plesioth", "#0080c1"],
    ["Brachydios", "#0B2757"], ["Lagiacrus", "#0b3f97"],
    ["G. Magala", "#1F0B57", "Gore Magala"], ["Nerscylla", "#4e2fa2"],
    ["Y. Garuga", "#62008f", "Yian Garuga"], ["Chameleos", "#8e50ab"],
    ["Mizutsune", "#D84696"], ["Congalala", "#ce79a8"],
    ["Duramboros", "#5a411f"], ["Diablos", "#997c54"],
    ["Barroth", "#B57C45"], ["Bulldrome", "#cfaa87"],
    ["K. Daora", "#505358", "Kushala Daora"], ["Valstrax", "#aeb5c1"],
    ["Forbidden", "#1E2025", "Question Mark"],
  ];
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
  function questDisplay(q) {
    const targets = questTargets(q).map(m => (q.Hyper ? "Hyper " : "") + m);
    return questShortName(q) + (targets.length ? " / " + targets.join(" + ") : "");
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
    $("saveEntryBtn").textContent = editingId ? "Update Entry" : "Save Entry";
    $("saveEntryBtn").disabled = !selectedQuest;
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
      clearTime: str(e.clearTime),
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
    $("saveEntryBtn").disabled = false;
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

  // Fields that carry over to the next entry — you rarely swap armour or party
  // between back-to-back hunts, but the objective and the result are per-hunt.
  function resetEditor(keepLoadout) {
    editingId = null;
    document.querySelectorAll(".log-entry.sel").forEach(n => n.classList.remove("sel"));
    $("deleteEntryBtn").classList.add("hidden");
    $("saveEntryBtn").textContent = "Save Entry";
    $("f_date").value = toDateInput(new Date());
    ["f_objective", "f_time", "f_notes"].forEach(id => { $(id).value = ""; });
    $("f_carts").value = 0;
    $("f_outcome").value = "";
    if (!keepLoadout) {
      ["f_locale", "f_armor", "f_weapon", "f_p1", "f_p2", "f_p3", "f_p4"].forEach(id => { $(id).value = ""; });
      $("f_weaponType").value = "";
      selectedQuest = null;
      localeDefault = "";
      document.querySelectorAll(".qitem.sel").forEach(b => b.classList.remove("sel"));
      renderQuestHead(null);
      $("saveEntryBtn").disabled = true;
    }
    syncWeapon();
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
    $("saveEntryBtn").textContent = "Update Entry";
    $("saveEntryBtn").disabled = !selectedQuest;
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
      writeDraft();
      toast("Entry updated.");
    } else {
      entries.push(Object.assign({ id: newId(), seq: ++seqCounter }, data));
      markDirty();
      renderLog();
      refreshPartyNames();
      resetEditor(true);   // keep quest/armour/weapon/party ready for the next hunt
      toast("Entry added.");
    }
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

  // Clear Time is a digit mask: everything that isn't a digit is dropped, and the last two
  // digits are always the seconds, so the apostrophe walks left as you type — 1, 18,
  // 1'84, 18'42.
  //
  // `settle` is for when editing finishes. It pads the minutes out to two digits, reads a
  // bare "6" as six minutes flat rather than six seconds, and clamps to 49'59 — a quest
  // runs out at 50 minutes, so that is the highest clear time anyone can post.
  //
  // The clamp only runs on settle, never while typing: "1'84" is a legitimate waypoint on
  // the way to "18'42", and clamping it live to "1'59" would eat the next digit.
  const MAX_MIN = 49, MAX_SEC = 59;
  function formatClearTime(value, settle) {
    const d = String(value || "").replace(/\D/g, "").slice(0, 4);
    if (!d) return "";
    const clamp = (n, max) => String(Math.min(max, n)).padStart(2, "0");
    if (d.length <= 2) return settle ? clamp(parseInt(d, 10), MAX_MIN) + "'00" : d;
    const mm = d.slice(0, -2), ss = d.slice(-2);
    return settle
      ? clamp(parseInt(mm, 10), MAX_MIN) + "'" + clamp(parseInt(ss, 10), MAX_SEC)
      : mm + "'" + ss;
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

  function renderLog() {
    const list = $("lbList");
    list.innerHTML = "";
    $("lbCount").textContent = String(entries.length);
    $("lbCountTab").textContent = String(entries.length);
    $("copyAllBtn").disabled = entries.length === 0;
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

      const top = el("div", "le-top");
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
      top.append(icon, mid);
      if (e.outcome) top.append(el("span", "le-outcome " + e.outcome, e.outcome));
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
      const copyBtn = el("button", "btn tiny", "Copy");
      copyBtn.type = "button";
      copyBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        copyText(entryToText(e, false), copyBtn);
      });
      const delBtn = el("button", "btn tiny", "Delete");
      delBtn.type = "button";
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        confirmAction("Delete this entry?", entryQuestDisplay(e), () => deleteEntry(e.id));
      });
      actions.append(editBtn, copyBtn, delBtn);
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
      r.setProperty("--titlebar-overlay", "rgba(0,0,0,0.02)");
    } else {
      r.setProperty("--bg", css(darken(c, .70)));
      r.setProperty("--bg1", css(darken(c, .80)));
      r.setProperty("--bg2", css(darken(c, 0.95)));
      r.setProperty("--hover", css(darken(c, 0.30)));
      r.setProperty("--accent", css(darken(c, 0.7)));
      r.setProperty("--accent-hover", css(lighten(c, 0.4)));
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

  $("newBtn").addEventListener("click", () => { resetEditor(true); setView("editor"); });
  $("saveBtn").addEventListener("click", saveToFile);
  $("openBtn").addEventListener("click", openFile);
  $("saveEntryBtn").addEventListener("click", saveEntry);
  $("cancelEntryBtn").addEventListener("click", () => resetEditor());
  $("deleteEntryBtn").addEventListener("click", () => {
    if (!editingId) return;
    const e = entries.find(x => x.id === editingId);
    if (e) confirmAction("Delete this entry?", entryQuestDisplay(e), () => deleteEntry(e.id));
  });
  // Mirror the editor to the draft on every keystroke, so an entry in progress survives
  // the tab closing. Delegated, so fields added later are covered without extra wiring.
  $("editorPane").addEventListener("input", scheduleDraftSave);
  $("editorPane").addEventListener("change", scheduleDraftSave);
  $("f_weaponType").addEventListener("change", syncWeapon);
  // Reformat as they type, then pad the minutes once they leave the field.
  $("f_time").addEventListener("input", function () {
    this.value = formatClearTime(this.value, false);
  });
  $("f_time").addEventListener("blur", function () {
    this.value = formatClearTime(this.value, true);
  });
  $("copyAllBtn").addEventListener("click", () => {
    copyText(sortedEntries().map(e => entryToText(e, true)).join("\n\n"), $("copyAllBtn"));
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
  try { savedTheme = localStorage.getItem(THEME_KEY) || savedTheme; } catch (e) {}
  if (!COLORS_HEX[String(savedTheme).toUpperCase()]) savedTheme = DEFAULT_THEME;
  applyTheme(savedTheme);

  $("sortBy").value = sortBy;
  $("groupBy").value = groupBy;
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
