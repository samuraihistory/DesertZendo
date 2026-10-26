(function () {
  "use strict";

  const { THEMES, PRACTICES, MOODS, MEAL_TYPES, BELL_INVITATIONS } = window.NHN_DATA;

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
    };
    if (!saved) return base;
    return {
      ...base,
      ...saved,
      bell: { ...base.bell, ...(saved.bell || {}) },
      cardsOpen: { ...base.cardsOpen, ...(saved.cardsOpen || {}) },
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
    document.getElementById("themeEyebrow").textContent = `Day ${n} · ${parseISO(selected).toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
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

  function strikeBell(delaySec = 0) {
    const ctx = ensureAudio();
    const volume = settings.bell.volume;
    if (volume <= 0) return;
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
  }

  function strikeBells(count, spacingSec = 5) {
    for (let i = 0; i < count; i++) strikeBell(i * spacingSec);
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
  const sitLength = document.getElementById("sitLength");
  const sitInterval = document.getElementById("sitInterval");
  const breathPace = document.getElementById("breathPace");
  const sitWalking = document.getElementById("sitWalking");
  const sitStartBtn = document.getElementById("sitStartBtn");
  const sitStopBtn = document.getElementById("sitStopBtn");
  const breathCircle = document.getElementById("breathCircle");
  const breathText = document.getElementById("breathText");
  const sitStatus = document.getElementById("sitStatus");

  let sit = null; // { start, end, interval, nextInterval, tick, breath, wakeLock }

  function formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function showIdleTimer() {
    timerDisplay.textContent = formatClock((Number(sitLength.value) || 0) * 60000);
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

  sitStartBtn.addEventListener("click", async () => {
    const minutes = Number(sitLength.value) || 0;
    if (minutes <= 0) return;
    ensureAudio();
    strikeBell();
    const start = Date.now();
    const interval = Number(sitInterval.value) * 60000;
    sit = {
      start,
      end: start + minutes * 60000,
      interval,
      nextInterval: interval ? start + interval : Infinity,
      walking: sitWalking.checked,
    };
    sit.breath = startBreathGuide(Number(breathPace.value));
    sit.tick = setInterval(onSitTick, 250);
    sit.wakeLock = await requestWakeLock();
    sitStartBtn.disabled = true;
    sitStopBtn.disabled = false;
    sitStatus.textContent = "";
    onSitTick();
  });

  sitStopBtn.addEventListener("click", () => finishSit(true));

  function onSitTick() {
    const now = Date.now();
    timerDisplay.textContent = formatClock(sit.end - now);
    if (now >= sit.end) {
      finishSit(false);
      return;
    }
    if (now >= sit.nextInterval) {
      strikeBell();
      sit.nextInterval += sit.interval;
    }
  }

  function finishSit(early) {
    const minutes = Math.round((Date.now() - sit.start) / 60000);
    clearInterval(sit.tick);
    clearInterval(sit.breath);
    if (sit.wakeLock) sit.wakeLock.release().catch(() => {});
    const walking = sit.walking;
    sit = null;
    breathCircle.classList.remove("expanded");
    breathText.textContent = "Ready";
    sitStartBtn.disabled = false;
    sitStopBtn.disabled = true;
    showIdleTimer();
    if (!early) strikeBells(2);

    if (minutes < 1) {
      sitStatus.textContent = "Session under a minute — not logged.";
      return;
    }
    // Log to today when it's in November, otherwise to the selected day.
    const iso = novDay(todayISO()) ? todayISO() : selected;
    updateDay(iso, (rec) => {
      rec.sessions.push({ at: nowHHMM(), minutes, walking });
      rec.sitMinutes = (rec.sitMinutes || 0) + minutes;
      rec.practices[walking ? "walking" : "sitting"] = true;
    });
    sitStatus.textContent = `Logged ${minutes} min to ${iso}.`;
    renderSessions();
  }

  function renderSessions() {
    const list = document.getElementById("sessionList");
    const sessions = getDay(selected).sessions;
    list.innerHTML = "";
    document.getElementById("sessionEmpty").hidden = sessions.length > 0;
    sessions.forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.at} — ${s.minutes} min ${s.walking ? "walking" : "sitting"}`;
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
    const thanksgiving = thanksgivingDay(year);
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
      cell.innerHTML = `
        <span class="cal-num">${day}${moon ? `<span class="moon moon-${moon}" title="${moon} moon"></span>` : ""}</span>
        ${day === thanksgiving ? '<span class="cal-tag">Thanksgiving</span>' : ""}
        <span class="cal-dots">${dots.join("")}</span>
      `;
      cell.title = THEMES[day - 1].title;
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
    const detail = document.getElementById("calDetail");
    detail.innerHTML = `
      <p class="eyebrow">Day ${n}</p>
      <h2>${escapeHtml(theme.title)}</h2>
      <p class="muted">
        ${rec.sitMinutes || 0} min meditation · ${rec.meals.length} meal${rec.meals.length === 1 ? "" : "s"}
        · ${rec.bells || 0} bell${rec.bells === 1 ? "" : "s"}${mood ? " · feeling " + mood.label.toLowerCase() : ""}
      </p>
      ${done.length ? `<p>${escapeHtml(done.join(" · "))}</p>` : ""}
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
    const practiceCounts = {};
    PRACTICES.forEach((p) => (practiceCounts[p.id] = 0));

    recs.forEach(({ rec }) => {
      minutes += rec.sitMinutes || 0;
      sessions += rec.sessions.length;
      meals += rec.meals.length;
      plantMeals += rec.meals.filter((m) => m.plant).length;
      mindfulMeals += rec.meals.filter((m) => m.pause).length;
      if (rec.diary.trim()) diaryDays++;
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
    let out = `# Nhat Hanh November ${settings.year}\n\n`;
    monthRecords().forEach(({ day, iso, rec }) => {
      if (!wasPracticed(rec) && !rec.gratitude && !rec.intention) return;
      const theme = THEMES[day - 1];
      out += `## Day ${day} — ${iso} — ${theme.title}\n\n`;
      const mood = MOODS.find((m) => m.value === rec.mood);
      if (mood) out += `Mood: ${mood.label}\n`;
      if (rec.sitMinutes) out += `Meditation: ${rec.sitMinutes} min\n`;
      const done = PRACTICES.filter((p) => rec.practices[p.id]).map((p) => p.label);
      if (done.length) out += `Practice: ${done.join(", ")}\n`;
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
    downloadFile(`nhat-hanh-november-${settings.year}.md`, buildDiaryMarkdown(), "text/markdown");
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
    downloadFile("nhat-hanh-november-backup.json", JSON.stringify(payload, null, 2), "application/json");
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
    applyCardsOpen();
    selected = clampToNovember(selected);
    renderHeader();
    renderDateBar();
    renderActive();
  }

  // ---------- Init ----------
  applyCardsOpen();
  loadBellForm();
  showIdleTimer();
  renderHeader();
  renderDateBar();
  renderToday();
  connectRemote();
})();
