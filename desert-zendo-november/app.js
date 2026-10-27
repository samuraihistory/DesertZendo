(function () {
  "use strict";

  const { THEMES, PRACTICES, MOODS, MEAL_TYPES, BELL_INVITATIONS, RECITATIONS, HOONKO_NOTE } = window.NHN_DATA;

  const STORAGE = {
    settings: "nhnSettings",
    days: "nhnDays",
  };

  const MS_PER_DAY = 86400000;
  const NOVEMBER = 10; // JS month index
  const DAYS_IN_NOVEMBER = 30;

  // ---------- Date helpers ----------
  function toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function todayISO() {
    return toISO(new Date());
  }

  function novISO(day) {
    return toISO(new Date(settings.year, NOVEMBER, day));
  }

  // Day of November (1–30) for an ISO date, or null if outside the month.
  function novDay(iso) {
    const d = parseISO(iso);
    if (d.getFullYear() !== settings.year || d.getMonth() !== NOVEMBER) return null;
    return d.getDate();
  }

  function clampToNovember(iso) {
    if (novDay(iso)) return iso;
    return parseISO(iso) < new Date(settings.year, NOVEMBER, 1) ? novISO(1) : novISO(DAYS_IN_NOVEMBER);
  }

  function nowHHMM() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // US Thanksgiving: fourth Thursday of November.
  function thanksgivingDay(year) {
    const firstDow = new Date(year, NOVEMBER, 1).getDay();
    const firstThu = 1 + ((4 - firstDow + 7) % 7);
    return firstThu + 21;
  }

  // Observances marked on the calendar. Hōonkō follows the Ōtani-ha dates,
  // November 21–28, ending on Shinran's memorial day.
  function observances(year, day) {
    const out = [];
    if (day >= 21 && day <= 28) {
      out.push({ short: "Hōonkō", name: day === 28 ? "Hōonkō: Shinran’s memorial day" : "Hōonkō (November 21–28)" });
    }
    if (day === thanksgivingDay(year)) out.push({ short: "Thanksgiving", name: "Thanksgiving (US)" });
    return out;
  }

  // Approximate moon phase from the mean synodic month, anchored to the new
  // moon of 2000-01-06 18:14 UTC. Good to within about a day, which is enough
  // for marking new and full moon days on a calendar.
  const SYNODIC = 29.530588853;
  const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14);

  function moonCycles(ms) {
    return (ms - NEW_MOON_EPOCH) / MS_PER_DAY / SYNODIC;
  }

  function moonEvent(year, day) {
    const start = moonCycles(new Date(year, NOVEMBER, day).getTime());
    const end = moonCycles(new Date(year, NOVEMBER, day + 1).getTime());
    if (Math.floor(end) > Math.floor(start)) return "new";
    if (Math.floor(end - 0.5) > Math.floor(start - 0.5)) return "full";
    return null;
  }

  // ---------- Storage ----------
  function defaultYear() {
    // Upcoming or current November.
    return new Date().getFullYear();
  }

  // Everything is saved to this browser's localStorage right away, so the
  // page works offline and when opened as a plain file. When the page runs
  // as a claude.ai Artifact, each record is also saved to the viewer's
  // private `db` subtree, which is the copy that wins across devices.
  function readLocal(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Storage blocked or full; the account copy (if any) still saves.
    }
  }

  function removeLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      // Nothing to remove.
    }
  }

  function withDefaults(saved) {
    const base = {
      year: defaultYear(),
      bell: { every: 30, from: "08:00", to: "20:00", volume: 0.6 },
      cardsOpen: { readingCard: true, zenCard: true },
      sitStyle: "zendo",
      sitRounds: 1,
      kinhinMinutes: 5,
      recite: { id: "namu-amida-butsu", sound: true, hideCount: false },
    };
    if (!saved) return base;
    return {
      ...base,
      ...saved,
      bell: { ...base.bell, ...(saved.bell || {}) },
      cardsOpen: { ...base.cardsOpen, ...(saved.cardsOpen || {}) },
      recite: { ...base.recite, ...(saved.recite || {}) },
    };
  }

  function loadSettings() {
    return withDefaults(readLocal(STORAGE.settings));
  }

  function saveSettings() {
    writeLocal(STORAGE.settings, settings);
    writeRemote("settings", settings);
  }

  function loadDays() {
    return readLocal(STORAGE.days) || {};
  }

  function saveDay(iso) {
    writeLocal(STORAGE.days, days);
    if (!remote) unsyncedDays.add(iso);
    writeRemote("day-" + iso, days[iso] || null);
  }

  // ---------- Account sync (claude.ai Artifact only) ----------
  let remote = null; // the viewer's private collection, once connected
  const unsyncedDays = new Set(); // days edited before the account answered
  const remoteWrites = {}; // doc id -> { running, next }

  function setSyncStatus(text) {
    document.getElementById("syncStatus").textContent = text;
  }

  // One write at a time per document; a newer body replaces a queued one.
  // A null body deletes the document.
  function writeRemote(docId, body) {
    if (!remote) return;
    const slot = remoteWrites[docId] || (remoteWrites[docId] = { running: false, next: undefined });
    slot.next = body === null ? null : JSON.parse(JSON.stringify(body));
    if (!slot.running) flushRemote(docId, slot);
  }

  async function flushRemote(docId, slot) {
    slot.running = true;
    while (slot.next !== undefined) {
      const body = slot.next;
      slot.next = undefined;
      try {
        const ref = remote.doc(docId);
        await (body === null ? ref.delete() : ref.set(body));
        setSyncStatus("Saved to your claude.ai account.");
      } catch (err) {
        setSyncStatus(
          err && err.code === "quota_exceeded"
            ? "Your account storage for this page is full. Changes are saved in this browser only."
            : "Couldn't reach your account. Changes are saved in this browser and will sync on your next edit."
        );
      }
    }
    slot.running = false;
  }

  async function connectRemote() {
    if (!window.claude || typeof window.claude.use !== "function") return;
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    const userId = user ? await user.id() : null;
    if (!db || !userId) {
      setSyncStatus("Sign in to claude.ai to save across devices. For now, changes are saved in this browser only.");
      return;
    }
    const collection = db.collection("data/users/" + userId);
    let snap;
    try {
      snap = await collection.limit(1000).get();
    } catch (err) {
      setSyncStatus("Couldn't reach your account. Changes are saved in this browser only.");
      return;
    }
    flushTodayForm();
    remote = collection;

    if (snap.empty) {
      // First visit with an account: upload what this browser already has.
      writeRemote("settings", settings);
      Object.keys(days).forEach((iso) => writeRemote("day-" + iso, days[iso]));
      setSyncStatus("Saved to your claude.ai account.");
      return;
    }

    const accountDays = {};
    let accountSettings = null;
    snap.docs.forEach((doc) => {
      if (doc.id === "settings") accountSettings = doc.data();
      else if (doc.id.startsWith("day-")) accountDays[doc.id.slice(4)] = doc.data();
    });
    // The account copy wins, except for days edited while it was loading.
    unsyncedDays.forEach((iso) => {
      if (days[iso]) accountDays[iso] = days[iso];
      writeRemote("day-" + iso, days[iso] || null);
    });
    unsyncedDays.clear();
    days = JSON.parse(JSON.stringify(accountDays));
    if (accountSettings) settings = withDefaults(JSON.parse(JSON.stringify(accountSettings)));
    writeLocal(STORAGE.days, days);
    writeLocal(STORAGE.settings, settings);
    setSyncStatus("Saved to your claude.ai account.");
    refreshAll();
  }

  function emptyDayRecord() {
    const practices = {};
    PRACTICES.forEach((p) => (practices[p.id] = false));
    return {
      practices,
      sitMinutes: 0,
      mood: 0,
      diary: "",
      gratitude: "",
      intention: "",
      meals: [],
      sessions: [],
      bells: 0,
      recitations: {},
    };
  }

  // Records are created on first write so empty days stay out of storage.
  function getDay(iso) {
    return days[iso] ? { ...emptyDayRecord(), ...days[iso] } : emptyDayRecord();
  }

  function updateDay(iso, fn) {
    const rec = getDay(iso);
    fn(rec);
    days[iso] = rec;
    saveDay(iso);
  }

  function wasPracticed(rec) {
    if (!rec) return false;
    if (rec.sitMinutes > 0 || (rec.meals && rec.meals.length)) return true;
    if (rec.diary && rec.diary.trim()) return true;
    if (rec.recitations && Object.values(rec.recitations).some((n) => n > 0)) return true;
    return PRACTICES.some((p) => rec.practices && rec.practices[p.id]);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function flash(el, text) {
    el.textContent = text;
    clearTimeout(el._flashTimer);
    el._flashTimer = setTimeout(() => (el.textContent = ""), 2000);
  }

  let settings = loadSettings();
  let days = loadDays();
  let selected = clampToNovember(todayISO());

  // ---------- Tabs ----------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const views = document.querySelectorAll(".view");
  let activeView = "today";

  function showView(name) {
    flushTodayForm();
    activeView = name;
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    views.forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    renderActive();
  }

  tabButtons.forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));

  function renderActive() {
    if (activeView === "today") renderToday();
    if (activeView === "meals") renderMeals();
    if (activeView === "sit") renderSessions();
    if (activeView === "recite") renderRecite();
    if (activeView === "calendar") renderCalendar();
    if (activeView === "month") renderMonth();
  }

  // ---------- Header & date bar ----------
  const selDateInput = document.getElementById("selDate");

  function renderHeader() {
    const today = todayISO();
    const n = novDay(today);
    const first = new Date(settings.year, NOVEMBER, 1);
    let label;
    let filled;
    if (n) {
      label = `Day ${n} of ${DAYS_IN_NOVEMBER}`;
      filled = n;
    } else if (parseISO(today) < first) {
      const until = Math.round((first - parseISO(today)) / MS_PER_DAY);
      label = `November ${settings.year} begins in ${until} day${until === 1 ? "" : "s"}`;
      filled = 0;
    } else {
      label = `November ${settings.year} complete`;
      filled = DAYS_IN_NOVEMBER;
    }
    document.getElementById("dayLabel").textContent = label;
    // The month's ensō is brushed a little further each day.
    const enso = document.getElementById("monthEnso");
    enso.dataset.progress = String(filled / DAYS_IN_NOVEMBER);
    window.Ink.redraw(enso);
    document.getElementById("monthDay").textContent = n ? String(n) : filled ? "30" : "";
  }

  function renderDateBar() {
    selDateInput.min = novISO(1);
    selDateInput.max = novISO(DAYS_IN_NOVEMBER);
    selDateInput.value = selected;
    const n = novDay(selected);
    const weekday = parseISO(selected).toLocaleDateString(undefined, { weekday: "long" });
    document.getElementById("selDayNote").textContent =
      `${weekday} · Day ${n}` + (selected === todayISO() ? " · today" : "");
    document.getElementById("prevDayBtn").disabled = n <= 1;
    document.getElementById("nextDayBtn").disabled = n >= DAYS_IN_NOVEMBER;
  }

  function selectDate(iso) {
    flushTodayForm();
    selected = clampToNovember(iso);
    renderDateBar();
    renderActive();
  }

  selDateInput.addEventListener("change", () => {
    if (selDateInput.value) selectDate(selDateInput.value);
  });
  document.getElementById("prevDayBtn").addEventListener("click", () => {
    selectDate(novISO(novDay(selected) - 1));
  });
  document.getElementById("nextDayBtn").addEventListener("click", () => {
    selectDate(novISO(novDay(selected) + 1));
  });

  // ---------- Today ----------
  const checklistFieldset = document.getElementById("practiceChecklist");
  const sitMinutesInput = document.getElementById("sitMinutes");
  const diaryInput = document.getElementById("diary");
  const gratitudeInput = document.getElementById("gratitude");
  const intentionInput = document.getElementById("intention");
  const moodRow = document.getElementById("moodRow");
  const saveStatus = document.getElementById("saveStatus");

  PRACTICES.forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "checklist-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "practice-" + p.id;
    const label = document.createElement("label");
    label.setAttribute("for", cb.id);
    label.textContent = p.label;
    wrap.appendChild(cb);
    wrap.appendChild(label);
    checklistFieldset.appendChild(wrap);
    cb.addEventListener("change", () => saveTodayForm());
  });

  MOODS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-btn";
    btn.dataset.value = m.value;
    btn.textContent = m.label;
    btn.addEventListener("click", () => {
      const current = getDay(selected).mood;
      updateDay(selected, (rec) => (rec.mood = current === m.value ? 0 : m.value));
      renderMood();
      flash(saveStatus, "Saved.");
    });
    moodRow.appendChild(btn);
  });

  function renderMood() {
    const mood = getDay(selected).mood;
    moodRow.querySelectorAll(".mood-btn").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.value) === mood);
    });
  }

  function renderTheme() {
    const n = novDay(selected);
    const theme = THEMES[n - 1];
    const obs = observances(settings.year, n);
    document.getElementById("themeEyebrow").textContent = [
      `Day ${n}`,
      parseISO(selected).toLocaleDateString(undefined, { month: "long", day: "numeric" }),
      ...obs.map((o) => o.short),
    ].join(" · ");
    const note = document.getElementById("observanceNote");
    note.hidden = !obs.some((o) => o.short === "Hōonkō");
    note.textContent = HOONKO_NOTE;
    document.getElementById("themeTitle").textContent = theme.title;
    document.getElementById("themePractice").textContent = theme.practice;
    document.getElementById("diaryPrompt").textContent = theme.prompt;
    renderReading(n);
    renderZen(n);
  }

  const CARD_IDS = ["readingCard", "zenCard"];

  function applyCardsOpen() {
    CARD_IDS.forEach((id) => (document.getElementById(id).open = settings.cardsOpen[id]));
  }

  CARD_IDS.forEach((id) => {
    const card = document.getElementById(id);
    card.addEventListener("toggle", () => {
      if (settings.cardsOpen[id] === card.open) return;
      settings.cardsOpen[id] = card.open;
      saveSettings();
    });
  });

  function renderReading(n) {
    const reading = window.NHN_READINGS[n - 1];
    document.getElementById("readingTitle").textContent = reading.title;
    document.getElementById("readingCite").textContent = reading.collection;
    document.getElementById("readingLink").href = reading.url;
    const body = document.getElementById("readingBody");
    body.innerHTML = "";
    reading.blocks.forEach((block) => {
      const p = document.createElement("p");
      if (block.verse) p.className = "verse";
      p.textContent = block.text;
      body.appendChild(p);
    });
  }

  function renderZen(n) {
    const zen = window.NHN_ZEN[n - 1];
    const original = document.getElementById("zenOriginal");
    original.lang = zen.lang;
    // Short sayings hang in vertical columns, one phrase each, as on a scroll.
    const vertical = [...zen.original].length <= 18;
    original.classList.toggle("vertical", vertical);
    original.textContent = vertical ? zen.original.replace(/([，。、])\s*(?=.)/g, "$1\n").replace(/　/g, "\n") : zen.original;
    const reading = document.getElementById("zenReading");
    reading.textContent = zen.reading || "";
    reading.hidden = !zen.reading;
    // "/" marks a line break in verse renderings.
    document.getElementById("zenEnglish").textContent = zen.english.replace(/ \/ /g, "\n");
    document.getElementById("zenCite").textContent = `${zen.who} · ${zen.work}`;
  }

  function renderToday() {
    renderTheme();
    const rec = getDay(selected);
    PRACTICES.forEach((p) => {
      document.getElementById("practice-" + p.id).checked = !!rec.practices[p.id];
    });
    sitMinutesInput.value = rec.sitMinutes || "";
    diaryInput.value = rec.diary;
    gratitudeInput.value = rec.gratitude;
    intentionInput.value = rec.intention;
    renderMood();
  }

  function saveTodayForm() {
    updateDay(selected, (rec) => {
      PRACTICES.forEach((p) => {
        rec.practices[p.id] = document.getElementById("practice-" + p.id).checked;
      });
      rec.sitMinutes = Number(sitMinutesInput.value) || 0;
      rec.diary = diaryInput.value;
      rec.gratitude = gratitudeInput.value;
      rec.intention = intentionInput.value;
    });
    flash(saveStatus, "Saved.");
  }

  let typingTimer = null;

  // Save keystrokes still waiting on the debounce before the form changes day.
  function flushTodayForm() {
    if (!typingTimer) return;
    clearTimeout(typingTimer);
    typingTimer = null;
    saveTodayForm();
  }
  [sitMinutesInput, diaryInput, gratitudeInput, intentionInput].forEach((el) => {
    el.addEventListener("input", () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        typingTimer = null;
        saveTodayForm();
      }, 400);
    });
  });

  // ---------- Meals ----------
  const mealTypeSelect = document.getElementById("mealType");
  MEAL_TYPES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    mealTypeSelect.appendChild(opt);
  });

  function guessMealType() {
    const h = new Date().getHours();
    if (h < 11) return "Breakfast";
    if (h < 15) return "Lunch";
    if (h < 17) return "Tea";
    return "Dinner";
  }
  mealTypeSelect.value = guessMealType();

  const MEAL_FLAGS = [
    { id: "plant", el: "mealPlant", label: "plant-based" },
    { id: "pause", el: "mealPause", label: "paused first" },
    { id: "noScreens", el: "mealNoScreens", label: "no screens" },
    { id: "slow", el: "mealSlow", label: "ate slowly" },
  ];

  document.getElementById("addMealBtn").addEventListener("click", () => {
    const what = document.getElementById("mealWhat").value.trim();
    const status = document.getElementById("mealStatus");
    if (!what) {
      flash(status, "Add what you ate first.");
      return;
    }
    const meal = {
      type: mealTypeSelect.value,
      what,
      hunger: Number(document.getElementById("mealHunger").value),
      fullness: Number(document.getElementById("mealFull").value),
      note: document.getElementById("mealNote").value.trim(),
      at: nowHHMM(),
    };
    MEAL_FLAGS.forEach((f) => (meal[f.id] = document.getElementById(f.el).checked));
    updateDay(selected, (rec) => {
      rec.meals.push(meal);
      if (meal.pause && meal.noScreens) rec.practices.meal = true;
    });
    document.getElementById("mealWhat").value = "";
    document.getElementById("mealNote").value = "";
    MEAL_FLAGS.forEach((f) => (document.getElementById(f.el).checked = false));
    flash(status, "Added.");
    renderMeals();
  });

  function renderMeals() {
    const list = document.getElementById("mealList");
    const meals = getDay(selected).meals;
    list.innerHTML = "";
    document.getElementById("mealEmpty").hidden = meals.length > 0;
    meals.forEach((m, i) => {
      const li = document.createElement("li");
      const flags = MEAL_FLAGS.filter((f) => m[f.id]).map((f) => `<span class="tag">${f.label}</span>`);
      li.innerHTML = `
        <div class="meal-head">
          <strong>${escapeHtml(m.type)}</strong>
          <span class="muted">${escapeHtml(m.at || "")} · hunger ${m.hunger}/5 → fullness ${m.fullness}/5</span>
        </div>
        <div>${escapeHtml(m.what)}</div>
        ${m.note ? `<div class="muted">${escapeHtml(m.note)}</div>` : ""}
        <div class="tags">${flags.join("")}</div>
      `;
      const del = document.createElement("button");
      del.className = "link-btn";
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        updateDay(selected, (rec) => rec.meals.splice(i, 1));
        renderMeals();
      });
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  // ---------- Bell sound ----------
  // A singing-bowl-like tone synthesized with the Web Audio API, so the app
  // ships no audio recordings. Partials are inharmonic, as in real bowls.
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  const PARTIALS = [
    { ratio: 1, gain: 1, decay: 9 },
    { ratio: 1.004, gain: 0.6, decay: 8 }, // slight detune gives the slow "wah" beat
    { ratio: 2.76, gain: 0.45, decay: 5 },
    { ratio: 5.4, gain: 0.2, decay: 3 },
    { ratio: 8.93, gain: 0.08, decay: 1.6 },
  ];

  // Returns the bell's output node, so a bell scheduled for later can be
  // silenced by disconnecting it.
  function strikeBell(delaySec = 0) {
    const ctx = ensureAudio();
    const volume = settings.bell.volume;
    if (volume <= 0) return null;
    const t0 = ctx.currentTime + delaySec;
    const base = 196; // G3
    const master = ctx.createGain();
    master.gain.value = volume * 0.35;
    master.connect(ctx.destination);
    PARTIALS.forEach((p) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = base * p.ratio;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p.gain, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + p.decay + 0.1);
    });
    return master;
  }

  function strikeBells(count, spacingSec = 5) {
    const bells = [];
    for (let i = 0; i < count; i++) bells.push(strikeBell(i * spacingSec));
    return bells;
  }

  // ---------- Mindfulness bell ----------
  const bellInvitation = document.getElementById("bellInvitation");
  const bellEvery = document.getElementById("bellEvery");
  const bellFrom = document.getElementById("bellFrom");
  const bellTo = document.getElementById("bellTo");
  const bellVolume = document.getElementById("bellVolume");
  const bellToggleBtn = document.getElementById("bellToggleBtn");
  const bellStatus = document.getElementById("bellStatus");
  let bellTimer = null;
  let invitationIndex = 0;

  function showInvitation() {
    bellInvitation.textContent = BELL_INVITATIONS[invitationIndex % BELL_INVITATIONS.length];
    invitationIndex++;
    // Restart the ink ring that spreads out from the bell.
    const ring = document.getElementById("bellRing");
    ring.classList.remove("ringing");
    void ring.offsetWidth;
    ring.classList.add("ringing");
  }

  function loadBellForm() {
    bellEvery.value = String(settings.bell.every);
    bellFrom.value = settings.bell.from;
    bellTo.value = settings.bell.to;
    bellVolume.value = settings.bell.volume;
  }

  function saveBellForm() {
    settings.bell = {
      every: Number(bellEvery.value),
      from: bellFrom.value || "08:00",
      to: bellTo.value || "20:00",
      volume: Number(bellVolume.value),
    };
    saveSettings();
    if (bellTimer) scheduleNextBell();
  }

  [bellEvery, bellFrom, bellTo, bellVolume].forEach((el) => el.addEventListener("change", saveBellForm));

  function withinBellHours() {
    const now = nowHHMM();
    const { from, to } = settings.bell;
    return from <= to ? now >= from && now < to : now >= from || now < to;
  }

  function scheduleNextBell() {
    clearTimeout(bellTimer);
    // Vary the interval by ±25% so the bell stays a surprise.
    const minutes = settings.bell.every * (0.75 + Math.random() * 0.5);
    const at = new Date(Date.now() + minutes * 60000);
    bellTimer = setTimeout(onScheduledBell, minutes * 60000);
    bellStatus.textContent = `Next bell around ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
  }

  function onScheduledBell() {
    if (withinBellHours()) {
      strikeBell();
      showInvitation();
      const today = todayISO();
      if (novDay(today)) updateDay(today, (rec) => rec.bells++);
    }
    scheduleNextBell();
  }

  bellToggleBtn.addEventListener("click", () => {
    if (bellTimer) {
      clearTimeout(bellTimer);
      bellTimer = null;
      bellToggleBtn.textContent = "Start bell";
      bellStatus.textContent = "Bell stopped.";
      return;
    }
    ensureAudio(); // must start from a user gesture
    bellToggleBtn.textContent = "Stop bell";
    scheduleNextBell();
  });

  document.getElementById("bellNowBtn").addEventListener("click", () => {
    strikeBell();
    showInvitation();
  });

  // ---------- Meditation timer ----------
  const timerDisplay = document.getElementById("timerDisplay");
  const segmentLabel = document.getElementById("segmentLabel");
  const sitLength = document.getElementById("sitLength");
  const sitRounds = document.getElementById("sitRounds");
  const kinhinLength = document.getElementById("kinhinLength");
  const sitInterval = document.getElementById("sitInterval");
  const breathPace = document.getElementById("breathPace");
  const sitWalking = document.getElementById("sitWalking");
  const sitStartBtn = document.getElementById("sitStartBtn");
  const sitStopBtn = document.getElementById("sitStopBtn");
  const breathCircle = document.getElementById("breathCircle");
  const breathText = document.getElementById("breathText");
  const sitStatus = document.getElementById("sitStatus");
  const sitStyle = document.getElementById("sitStyle");

  // Zendo style: three bells, each left to fade, open the sitting and the
  // clock starts on the third; a single bell closes it. Between periods,
  // two bells start kinhin and one bell calls everyone back to the cushion.
  const OPENING_BELL_SPACING = 5; // seconds
  const KINHIN_BELL_SPACING = 3; // seconds
  const SIT_STYLES = {
    zendo: { opening: 3, closing: 1 },
    simple: { opening: 1, closing: 2 },
  };

  function loadSitForm() {
    sitStyle.value = settings.sitStyle;
    sitRounds.value = String(settings.sitRounds);
    kinhinLength.value = String(settings.kinhinMinutes);
  }

  sitStyle.addEventListener("change", () => {
    settings.sitStyle = sitStyle.value;
    saveSettings();
  });
  sitRounds.addEventListener("change", () => {
    settings.sitRounds = Number(sitRounds.value);
    saveSettings();
    if (!sit) showIdleTimer();
  });
  kinhinLength.addEventListener("change", () => {
    settings.kinhinMinutes = Number(kinhinLength.value);
    saveSettings();
    if (!sit) showIdleTimer();
  });
  sitWalking.addEventListener("change", () => !sit && showIdleTimer());

  let sit = null; // the session in progress; see the Begin handler

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  // A session is a list of segments: zazen periods with kinhin between, or
  // a single walking segment.
  function buildSegments() {
    const minutes = Number(sitLength.value) || 0;
    if (sitWalking.checked) return [{ type: "walking", ms: minutes * 60000 }];
    const rounds = Number(sitRounds.value) || 1;
    const out = [];
    for (let i = 0; i < rounds; i++) {
      if (i) out.push({ type: "kinhin", ms: Number(kinhinLength.value) * 60000 });
      out.push({ type: "zazen", ms: minutes * 60000 });
    }
    return out;
  }

  function describePlan() {
    const minutes = Number(sitLength.value) || 0;
    if (sitWalking.checked) return `${minutes} min walking meditation`;
    const rounds = Number(sitRounds.value) || 1;
    if (rounds === 1) return `${minutes} min zazen`;
    return `${rounds} × ${minutes} min zazen, ${kinhinLength.value} min kinhin between`;
  }

  function showIdleTimer() {
    timerDisplay.textContent = formatClock((Number(sitLength.value) || 0) * 60000);
    segmentLabel.textContent = describePlan();
  }
  sitLength.addEventListener("input", () => !sit && showIdleTimer());

  function startBreathGuide(pace) {
    if (!pace) {
      breathText.textContent = "Sitting";
      return null;
    }
    breathCircle.style.transitionDuration = pace + "s";
    let inhale = true;
    const step = () => {
      breathCircle.classList.toggle("expanded", inhale);
      breathText.textContent = inhale ? "Breathing in" : "Breathing out";
      inhale = !inhale;
    };
    step();
    return setInterval(step, pace * 1000);
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) return await navigator.wakeLock.request("screen");
    } catch (err) {
      // Not fatal: the screen may just dim.
    }
    return null;
  }

  // Ring bells for the session, remembering when each will sound so that
  // ending early can silence the ones still to come.
  function ringSessionBells(count, spacingSec) {
    const now = Date.now();
    strikeBells(count, spacingSec).forEach((node, i) => {
      if (node) sit.pendingBells.push({ node, at: now + i * spacingSec * 1000 });
    });
  }

  sitStartBtn.addEventListener("click", async () => {
    const segments = buildSegments();
    if (!segments[0].ms) return;
    ensureAudio();
    const style = SIT_STYLES[sitStyle.value] || SIT_STYLES.zendo;
    const start = Date.now() + (style.opening - 1) * OPENING_BELL_SPACING * 1000;
    let t = start;
    segments.forEach((seg) => {
      seg.start = t;
      seg.end = t + seg.ms;
      t = seg.end;
    });
    sit = {
      start,
      end: t,
      segments,
      segIndex: -1,
      interval: Number(sitInterval.value) * 60000,
      nextInterval: Infinity,
      closingBells: style.closing,
      openingCount: style.opening,
      breathPace: Number(breathPace.value),
      breath: null,
      pendingBells: [],
    };
    ringSessionBells(style.opening, OPENING_BELL_SPACING);
    sit.tick = setInterval(onSitTick, 250);
    sitStartBtn.disabled = true;
    sitStopBtn.disabled = false;
    sitStatus.textContent = "";
    onSitTick();
    const wakeLock = await requestWakeLock();
    if (sit) sit.wakeLock = wakeLock;
    else if (wakeLock) wakeLock.release().catch(() => {});
  });

  sitStopBtn.addEventListener("click", () => finishSit(true));

  function enterSegment(index) {
    const first = sit.segIndex === -1;
    sit.segIndex = index;
    const seg = sit.segments[index];
    if (!first) ringSessionBells(seg.type === "kinhin" ? 2 : 1, KINHIN_BELL_SPACING);
    clearInterval(sit.breath);
    sit.breath = null;
    breathCircle.classList.remove("expanded");
    sit.nextInterval = seg.type === "zazen" && sit.interval ? seg.start + sit.interval : Infinity;
    if (seg.type === "zazen") {
      sit.breath = startBreathGuide(sit.breathPace);
      const zazenCount = sit.segments.filter((s) => s.type === "zazen").length;
      const number = sit.segments.slice(0, index + 1).filter((s) => s.type === "zazen").length;
      segmentLabel.textContent = zazenCount > 1 ? `Zazen, period ${number} of ${zazenCount}` : "Zazen";
    } else if (seg.type === "kinhin") {
      breathText.textContent = "Kinhin";
      segmentLabel.textContent = "Kinhin: stand, bow, and walk slowly until the bell";
    } else {
      breathText.textContent = "Walking";
      segmentLabel.textContent = "Walking meditation";
    }
  }

  function onSitTick() {
    const now = Date.now();
    if (now < sit.start) {
      // Still inside the opening bells.
      const elapsed = (sit.openingCount - 1) * OPENING_BELL_SPACING * 1000 - (sit.start - now);
      const bell = Math.min(sit.openingCount, Math.floor(elapsed / (OPENING_BELL_SPACING * 1000)) + 1);
      breathText.textContent = `Bell ${bell} of ${sit.openingCount}`;
      timerDisplay.textContent = formatClock(sit.segments[0].ms);
      segmentLabel.textContent = describePlan();
      return;
    }
    if (now >= sit.end) {
      finishSit(false);
      return;
    }
    const index = sit.segments.findIndex((seg) => now < seg.end);
    if (index !== sit.segIndex) enterSegment(index);
    const seg = sit.segments[index];
    timerDisplay.textContent = formatClock(seg.end - now);
    if (now >= sit.nextInterval && sit.nextInterval < seg.end) {
      strikeBell();
      sit.nextInterval += sit.interval;
    }
  }

  function finishSit(early) {
    const now = Date.now();
    let zazenMs = 0;
    let walkMs = 0;
    sit.segments.forEach((seg) => {
      const ms = Math.max(0, Math.min(seg.end, now) - seg.start);
      if (seg.type === "zazen") zazenMs += ms;
      else walkMs += ms;
    });
    const zazen = Math.round(zazenMs / 60000);
    const walked = Math.round(walkMs / 60000);
    const walkKind = sit.segments.some((seg) => seg.type === "kinhin") ? "kinhin" : "walking";
    clearInterval(sit.tick);
    clearInterval(sit.breath);
    // Silence bells that haven't rung yet.
    if (early) sit.pendingBells.forEach((bell) => bell.at > now && bell.node.disconnect());
    const closingBells = sit.closingBells;
    if (sit.wakeLock) sit.wakeLock.release().catch(() => {});
    sit = null;
    breathCircle.classList.remove("expanded");
    breathText.textContent = "Ready";
    sitStartBtn.disabled = false;
    sitStopBtn.disabled = true;
    showIdleTimer();
    if (!early) strikeBells(closingBells);

    if (zazen + walked < 1) {
      sitStatus.textContent = "Session under a minute — not logged.";
      return;
    }
    const iso = loggingDay();
    updateDay(iso, (rec) => {
      if (zazen >= 1) {
        rec.sessions.push({ at: nowHHMM(), minutes: zazen, walking: false, kind: "zazen" });
        rec.practices.sitting = true;
      }
      if (walked >= 1) {
        rec.sessions.push({ at: nowHHMM(), minutes: walked, walking: true, kind: walkKind });
        rec.practices.walking = true;
      }
      rec.sitMinutes = (rec.sitMinutes || 0) + zazen + walked;
    });
    const parts = [];
    if (zazen >= 1) parts.push(`${zazen} min zazen`);
    if (walked >= 1) parts.push(`${walked} min ${walkKind}`);
    sitStatus.textContent = `Logged ${parts.join(" and ")} to ${iso}.`;
    renderSessions();
  }

  function renderSessions() {
    const list = document.getElementById("sessionList");
    const sessions = getDay(selected).sessions;
    list.innerHTML = "";
    document.getElementById("sessionEmpty").hidden = sessions.length > 0;
    sessions.forEach((s) => {
      const li = document.createElement("li");
      const kind = s.kind || (s.walking ? "walking" : "sitting");
      li.textContent = `${s.at} — ${s.minutes} min ${kind}`;
      list.appendChild(li);
    });
  }

  // ---------- Recitation counter ----------
  // One tap is one recitation. The ensō fills around once per mala round of
  // 108, and a bell marks each completed round.
  const MALA = 108;
  const reciteText = document.getElementById("reciteText");
  const reciteBtn = document.getElementById("reciteBtn");
  const reciteEnso = document.getElementById("reciteEnso");
  const reciteCount = document.getElementById("reciteCount");
  const reciteRound = document.getElementById("reciteRound");
  const reciteSound = document.getElementById("reciteSound");
  const reciteHide = document.getElementById("reciteHide");

  RECITATIONS.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.label;
    reciteText.appendChild(opt);
  });

  function currentRecitation() {
    return RECITATIONS.find((r) => r.id === settings.recite.id) || RECITATIONS[0];
  }

  function loadReciteForm() {
    reciteText.value = currentRecitation().id;
    reciteSound.checked = settings.recite.sound;
    reciteHide.checked = settings.recite.hideCount;
  }

  function saveReciteForm() {
    settings.recite = { id: reciteText.value, sound: reciteSound.checked, hideCount: reciteHide.checked };
    saveSettings();
    renderRecite();
  }
  [reciteText, reciteSound, reciteHide].forEach((el) => el.addEventListener("change", saveReciteForm));

  // A short wooden knock, like the wooden fish (mokugyo) that keeps time
  // for chanting.
  function knock() {
    const ctx = ensureAudio();
    const volume = settings.bell.volume;
    if (volume <= 0) return;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = volume * 0.5;
    out.connect(ctx.destination);
    [
      [420, 1, 0.14],
      [930, 0.35, 0.06],
    ].forEach(([freq, gain, decay]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 1.06, t0);
      osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.03);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      osc.connect(g).connect(out);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    });
  }

  // Sitting and reciting log to today during November, otherwise to the
  // day picked in the date bar.
  function loggingDay() {
    return novDay(todayISO()) ? todayISO() : selected;
  }

  function recitedCount(iso, id) {
    return getDay(iso).recitations[id] || 0;
  }

  function changeRecitation(delta) {
    const id = currentRecitation().id;
    const iso = loggingDay();
    const next = Math.max(0, recitedCount(iso, id) + delta);
    updateDay(iso, (rec) => {
      rec.recitations = { ...rec.recitations, [id]: next };
      if (next > 0) rec.practices.recite = true;
    });
    return next;
  }

  reciteBtn.addEventListener("click", () => {
    const count = changeRecitation(1);
    if (count % MALA === 0) strikeBell();
    else if (settings.recite.sound) knock();
    renderRecite();
  });

  document.getElementById("reciteUndoBtn").addEventListener("click", () => {
    changeRecitation(-1);
    renderRecite();
  });

  function renderRecite() {
    const r = currentRecitation();
    const original = document.getElementById("reciteOriginal");
    original.textContent = r.original;
    original.lang = r.lang;
    original.hidden = !r.original;
    const reading = document.getElementById("reciteReading");
    reading.textContent = r.reading;
    reading.hidden = !r.reading;
    document.getElementById("reciteNote").textContent = r.note;

    const iso = loggingDay();
    const count = recitedCount(iso, r.id);
    const intoRound = count % MALA;
    reciteEnso.dataset.progress = String(count && !intoRound ? 1 : intoRound / MALA);
    window.Ink.redraw(reciteEnso);
    const hide = settings.recite.hideCount;
    reciteCount.textContent = hide ? "" : String(count);
    const rounds = Math.floor(count / MALA);
    reciteRound.textContent = hide
      ? "Tap the circle with each recitation."
      : `${rounds} round${rounds === 1 ? "" : "s"} of ${MALA}${intoRound ? `, ${intoRound} into the next` : ""} · ${iso}`;

    const list = document.getElementById("reciteList");
    const recs = getDay(selected).recitations;
    list.innerHTML = "";
    const entries = RECITATIONS.filter((x) => recs[x.id]);
    document.getElementById("reciteEmpty").hidden = entries.length > 0;
    entries.forEach((x) => {
      const li = document.createElement("li");
      li.textContent = hide ? x.label : `${x.label} — ${recs[x.id]}`;
      list.appendChild(li);
    });
  }

  // ---------- Calendar ----------
  function renderCalendar() {
    const year = settings.year;
    document.getElementById("calTitle").textContent = `November ${year}`;
    const grid = document.getElementById("calGrid");
    grid.innerHTML = "";
    const firstDow = new Date(year, NOVEMBER, 1).getDay();
    for (let i = 0; i < firstDow; i++) {
      grid.appendChild(document.createElement("span"));
    }
    const today = todayISO();
    for (let day = 1; day <= DAYS_IN_NOVEMBER; day++) {
      const iso = novISO(day);
      const rec = days[iso];
      const cell = document.createElement("button");
      cell.className = "cal-cell";
      if (iso === selected) cell.classList.add("selected");
      if (iso === today) cell.classList.add("today");
      const moon = moonEvent(year, day);
      const dots = [];
      if (rec && rec.diary && rec.diary.trim()) dots.push('<span class="dot dot-diary"></span>');
      if (rec && rec.meals && rec.meals.length) dots.push('<span class="dot dot-meal"></span>');
      if (rec && rec.sitMinutes > 0) dots.push('<span class="dot dot-sit"></span>');
      const obs = observances(year, day);
      cell.innerHTML = `
        <span class="cal-num">${day}${moon ? `<span class="moon moon-${moon}" title="${moon} moon"></span>` : ""}</span>
        ${obs.length ? '<span class="obs-mark"></span>' : ""}
        ${obs.map((o) => `<span class="cal-tag">${o.short}</span>`).join("")}
        <span class="cal-dots">${dots.join("")}</span>
      `;
      cell.title = [THEMES[day - 1].title, ...obs.map((o) => o.name)].join(" · ");
      cell.addEventListener("click", () => {
        selected = iso;
        renderDateBar();
        renderCalendar();
      });
      grid.appendChild(cell);
    }
    renderCalendarDetail();
  }

  function renderCalendarDetail() {
    const n = novDay(selected);
    const rec = getDay(selected);
    const theme = THEMES[n - 1];
    const mood = MOODS.find((m) => m.value === rec.mood);
    const done = PRACTICES.filter((p) => rec.practices[p.id]).map((p) => p.label);
    const obs = observances(settings.year, n);
    const recited = RECITATIONS.filter((r) => rec.recitations[r.id]).map((r) =>
      settings.recite.hideCount ? r.reading || r.label : `${rec.recitations[r.id]} ${r.reading || r.label}`
    );
    const detail = document.getElementById("calDetail");
    detail.innerHTML = `
      <p class="eyebrow">${["Day " + n, ...obs.map((o) => o.name)].map(escapeHtml).join(" · ")}</p>
      <h2>${escapeHtml(theme.title)}</h2>
      <p class="muted">
        ${rec.sitMinutes || 0} min meditation · ${rec.meals.length} meal${rec.meals.length === 1 ? "" : "s"}
        · ${rec.bells || 0} bell${rec.bells === 1 ? "" : "s"}${mood ? " · feeling " + mood.label.toLowerCase() : ""}
      </p>
      ${done.length ? `<p>${escapeHtml(done.join(" · "))}</p>` : ""}
      ${recited.length ? `<p>Recited: ${escapeHtml(recited.join(" · "))}</p>` : ""}
      ${rec.intention ? `<p><em>Intention:</em> ${escapeHtml(rec.intention)}</p>` : ""}
      ${rec.diary ? `<p class="diary-snip">${escapeHtml(rec.diary)}</p>` : ""}
    `;
    const open = document.createElement("button");
    open.textContent = "Open this day";
    open.addEventListener("click", () => showView("today"));
    detail.appendChild(open);
  }

  // ---------- Month summary ----------
  function monthRecords() {
    const out = [];
    for (let day = 1; day <= DAYS_IN_NOVEMBER; day++) {
      const iso = novISO(day);
      if (days[iso]) out.push({ day, iso, rec: getDay(iso) });
    }
    return out;
  }

  function renderMonth() {
    const recs = monthRecords();
    let minutes = 0;
    let sessions = 0;
    let meals = 0;
    let plantMeals = 0;
    let mindfulMeals = 0;
    let diaryDays = 0;
    let moodSum = 0;
    let moodCount = 0;
    let recitations = 0;
    const practiceCounts = {};
    PRACTICES.forEach((p) => (practiceCounts[p.id] = 0));

    recs.forEach(({ rec }) => {
      minutes += rec.sitMinutes || 0;
      sessions += rec.sessions.length;
      meals += rec.meals.length;
      plantMeals += rec.meals.filter((m) => m.plant).length;
      mindfulMeals += rec.meals.filter((m) => m.pause).length;
      if (rec.diary.trim()) diaryDays++;
      recitations += Object.values(rec.recitations).reduce((a, b) => a + b, 0);
      if (rec.mood) {
        moodSum += rec.mood;
        moodCount++;
      }
      PRACTICES.forEach((p) => {
        if (rec.practices[p.id]) practiceCounts[p.id]++;
      });
    });

    // Streaks of days with any practice, up to today (or the whole month).
    const todayN = novDay(todayISO());
    const lastDay = todayN || (parseISO(todayISO()) > new Date(settings.year, NOVEMBER, 1) ? DAYS_IN_NOVEMBER : 0);
    let current = 0;
    let longest = 0;
    let running = 0;
    for (let day = 1; day <= lastDay; day++) {
      if (wasPracticed(days[novISO(day)])) {
        running++;
        longest = Math.max(longest, running);
      } else {
        running = 0;
      }
    }
    current = running;

    const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
    const avgMood = moodCount ? MOODS[Math.round(moodSum / moodCount) - 1].label : "—";
    const stats = [
      { label: "Meditation hrs", num: (minutes / 60).toFixed(1) },
      { label: "Timed sessions", num: sessions },
      { label: "Diary entries", num: diaryDays },
      { label: "Meals logged", num: meals },
      { label: "Plant-based", num: pct(plantMeals, meals) },
      { label: "Paused before eating", num: pct(mindfulMeals, meals) },
      { label: "Usual mood", num: avgMood },
      { label: "Recitations", num: settings.recite.hideCount ? (recitations ? "✓" : "—") : recitations },
      { label: "Current streak", num: current },
      { label: "Longest streak", num: longest },
    ];
    document.getElementById("statGrid").innerHTML = stats
      .map((s) => `<div class="stat-box"><div class="num">${s.num}</div><div class="label">${s.label}</div></div>`)
      .join("");

    const denom = Math.max(1, lastDay);
    document.getElementById("practiceStats").innerHTML = PRACTICES.map((p) => {
      const value = Math.min(100, Math.round((practiceCounts[p.id] / denom) * 100));
      return `
        <div class="practice-row">
          <span class="name">${p.label}</span>
          <div class="practice-bar-track"><div class="practice-bar-fill" style="width:${value}%"></div></div>
          <span class="pct">${practiceCounts[p.id]}/${denom}</span>
        </div>`;
    }).join("");

    document.getElementById("diaryPreview").textContent = buildDiaryMarkdown();
    document.getElementById("yearInput").value = settings.year;
  }

  function buildDiaryMarkdown() {
    let out = `# Desert Zendo November ${settings.year}\n\n`;
    monthRecords().forEach(({ day, iso, rec }) => {
      if (!wasPracticed(rec) && !rec.gratitude && !rec.intention) return;
      const theme = THEMES[day - 1];
      out += `## Day ${day} — ${iso} — ${theme.title}\n\n`;
      const mood = MOODS.find((m) => m.value === rec.mood);
      if (mood) out += `Mood: ${mood.label}\n`;
      if (rec.sitMinutes) out += `Meditation: ${rec.sitMinutes} min\n`;
      const done = PRACTICES.filter((p) => rec.practices[p.id]).map((p) => p.label);
      if (done.length) out += `Practice: ${done.join(", ")}\n`;
      const recited = RECITATIONS.filter((r) => rec.recitations[r.id]);
      if (recited.length) out += `Recited: ${recited.map((r) => `${r.reading || r.label} (${rec.recitations[r.id]})`).join(", ")}\n`;
      if (rec.meals.length) out += `Meals: ${rec.meals.map((m) => `${m.type.toLowerCase()} (${m.what})`).join("; ")}\n`;
      if (rec.diary.trim()) out += `\n*${theme.prompt}*\n\n${rec.diary.trim()}\n`;
      if (rec.gratitude.trim()) out += `\n**Grateful for:**\n${rec.gratitude.trim()}\n`;
      if (rec.intention.trim()) out += `\n**Intention:** ${rec.intention.trim()}\n`;
      out += `\n`;
    });
    return out;
  }

  // On claude.ai the page can't start downloads itself; the `downloads`
  // capability asks the viewer to save the file instead.
  async function downloadFile(filename, content, mime) {
    const downloads =
      window.claude && typeof window.claude.use === "function" ? await window.claude.use("downloads") : null;
    if (downloads) {
      try {
        await downloads.save({ filename, data: content });
      } catch (err) {
        if (err && err.code !== "declined") {
          document.getElementById("backupStatus").textContent = "Couldn't save the file here.";
        }
      }
      return;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  document.getElementById("exportDiaryBtn").addEventListener("click", () => {
    downloadFile(`desert-zendo-november-${settings.year}.md`, buildDiaryMarkdown(), "text/markdown");
  });

  // ---------- Settings ----------
  document.getElementById("saveYearBtn").addEventListener("click", () => {
    const year = Number(document.getElementById("yearInput").value);
    if (!year) return;
    settings.year = year;
    saveSettings();
    selected = clampToNovember(todayISO());
    renderHeader();
    renderDateBar();
    renderMonth();
  });

  document.getElementById("exportDataBtn").addEventListener("click", () => {
    const payload = { settings, days };
    downloadFile("desert-zendo-november-backup.json", JSON.stringify(payload, null, 2), "application/json");
  });

  document.getElementById("importDataInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (payload.settings) settings = withDefaults(payload.settings);
        if (payload.days) replaceAllDays(payload.days);
        saveSettings();
        refreshAll();
        document.getElementById("backupStatus").textContent = "Import successful.";
      } catch (err) {
        document.getElementById("backupStatus").textContent = "Import failed: invalid file.";
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  function replaceAllDays(newDays) {
    Object.keys(days).forEach((iso) => {
      if (!newDays[iso]) writeRemote("day-" + iso, null);
    });
    days = newDays;
    writeLocal(STORAGE.days, days);
    Object.keys(days).forEach((iso) => writeRemote("day-" + iso, days[iso]));
  }

  // Dialogs don't show inside claude.ai, so deleting takes a second tap.
  const clearDataBtn = document.getElementById("clearDataBtn");
  let clearArmed = null;
  clearDataBtn.addEventListener("click", () => {
    if (!clearArmed) {
      clearDataBtn.textContent = "Tap again to delete everything";
      clearArmed = setTimeout(() => {
        clearArmed = null;
        clearDataBtn.textContent = "Clear all data";
      }, 5000);
      return;
    }
    clearTimeout(clearArmed);
    clearArmed = null;
    clearDataBtn.textContent = "Clear all data";
    replaceAllDays({});
    writeRemote("settings", null);
    removeLocal(STORAGE.settings);
    removeLocal(STORAGE.days);
    settings = withDefaults(null);
    refreshAll();
    document.getElementById("backupStatus").textContent = "All data deleted.";
  });

  function refreshAll() {
    loadBellForm();
    loadSitForm();
    loadReciteForm();
    if (!sit) showIdleTimer();
    applyCardsOpen();
    selected = clampToNovember(selected);
    renderHeader();
    renderDateBar();
    renderActive();
  }

  // ---------- Init ----------
  applyCardsOpen();
  loadBellForm();
  loadSitForm();
  loadReciteForm();
  showIdleTimer();
  renderHeader();
  renderDateBar();
  renderToday();
  connectRemote();
})();
