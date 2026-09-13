(function () {
  "use strict";

  const STORAGE = {
    settings: "angoSettings",
    days: "angoDays",
  };

  const PRACTICES = [
    { id: "kinhin", label: "Kinhin (walking meditation)" },
    { id: "study", label: "Study / reading" },
    { id: "samu", label: "Samu (work practice)" },
    { id: "liturgy", label: "Chanting / liturgy" },
    { id: "precepts", label: "Precepts reflection" },
  ];

  const MS_PER_DAY = 86400000;

  function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toISO(d);
  }

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

  function dayNumber(iso, startIso) {
    const diff = Math.round((parseISO(iso) - parseISO(startIso)) / MS_PER_DAY);
    return diff + 1;
  }

  function loadSettings() {
    const raw = localStorage.getItem(STORAGE.settings);
    if (raw) return JSON.parse(raw);
    return { startDate: todayISO(), lengthDays: 90 };
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  }

  function loadDays() {
    const raw = localStorage.getItem(STORAGE.days);
    return raw ? JSON.parse(raw) : {};
  }

  function saveDays(days) {
    localStorage.setItem(STORAGE.days, JSON.stringify(days));
  }

  function emptyDayRecord() {
    const practices = {};
    PRACTICES.forEach((p) => (practices[p.id] = false));
    return { zazenMinutes: 0, zazenSessions: 0, practices, journal: "" };
  }

  function wasPracticed(rec) {
    if (!rec) return false;
    if (rec.zazenMinutes > 0) return true;
    return PRACTICES.some((p) => rec.practices[p.id]);
  }

  let settings = loadSettings();
  let days = loadDays();

  // ---------- Tabs ----------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const views = document.querySelectorAll(".view");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      views.forEach((v) => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("view-" + btn.dataset.view).classList.add("active");
      if (btn.dataset.view === "history") renderHistory();
      if (btn.dataset.view === "summary") renderSummary();
    });
  });

  // ---------- Header day counter ----------
  function renderHeader() {
    const iso = todayISO();
    const n = dayNumber(iso, settings.startDate);
    const clamped = Math.max(0, Math.min(n, settings.lengthDays));
    let label;
    if (n < 1) label = `Ango begins ${settings.startDate}`;
    else if (n > settings.lengthDays) label = `Ango complete (${settings.lengthDays} days)`;
    else label = `Day ${n} of ${settings.lengthDays}`;
    document.getElementById("dayLabel").textContent = label;
    document.getElementById("progressFill").style.width =
      (clamped / settings.lengthDays) * 100 + "%";
  }

  // ---------- Today view ----------
  const logDateInput = document.getElementById("logDate");
  const zazenMinutesInput = document.getElementById("zazenMinutes");
  const zazenSessionsInput = document.getElementById("zazenSessions");
  const journalInput = document.getElementById("journal");
  const checklistFieldset = document.getElementById("practiceChecklist");
  const logDayNote = document.getElementById("logDayNote");

  PRACTICES.forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "checklist-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "practice-" + p.id;
    cb.dataset.practiceId = p.id;
    const label = document.createElement("label");
    label.setAttribute("for", cb.id);
    label.textContent = p.label;
    wrap.appendChild(cb);
    wrap.appendChild(label);
    checklistFieldset.appendChild(wrap);
  });

  function loadDayIntoForm(iso) {
    const rec = days[iso] || emptyDayRecord();
    zazenMinutesInput.value = rec.zazenMinutes || "";
    zazenSessionsInput.value = rec.zazenSessions || "";
    journalInput.value = rec.journal || "";
    PRACTICES.forEach((p) => {
      document.getElementById("practice-" + p.id).checked = !!rec.practices[p.id];
    });
    const n = dayNumber(iso, settings.startDate);
    if (n < 1) logDayNote.textContent = "before ango start";
    else if (n > settings.lengthDays) logDayNote.textContent = "after ango end";
    else logDayNote.textContent = `Day ${n}`;
  }

  logDateInput.addEventListener("change", () => loadDayIntoForm(logDateInput.value));

  document.getElementById("saveDayBtn").addEventListener("click", () => {
    const iso = logDateInput.value || todayISO();
    const rec = emptyDayRecord();
    rec.zazenMinutes = Number(zazenMinutesInput.value) || 0;
    rec.zazenSessions = Number(zazenSessionsInput.value) || 0;
    rec.journal = journalInput.value;
    PRACTICES.forEach((p) => {
      rec.practices[p.id] = document.getElementById("practice-" + p.id).checked;
    });
    days[iso] = rec;
    saveDays(days);
    const status = document.getElementById("saveStatus");
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  // ---------- History view ----------
  function renderHistory() {
    const body = document.getElementById("historyBody");
    const empty = document.getElementById("historyEmpty");
    body.innerHTML = "";
    const isoList = Object.keys(days).sort();
    empty.hidden = isoList.length > 0;
    isoList.forEach((iso) => {
      const rec = days[iso];
      const tr = document.createElement("tr");
      const n = dayNumber(iso, settings.startDate);
      const practiceCount = PRACTICES.filter((p) => rec.practices[p.id]).length;
      tr.innerHTML = `
        <td>${n}</td>
        <td>${iso}</td>
        <td>${rec.zazenMinutes || 0} min${rec.zazenSessions ? " / " + rec.zazenSessions + " sit" : ""}</td>
        <td>${practiceCount}/${PRACTICES.length}</td>
        <td class="journal-snip">${escapeHtml(rec.journal || "")}</td>
      `;
      tr.addEventListener("click", () => {
        document.querySelector('.tab-btn[data-view="today"]').click();
        logDateInput.value = iso;
        loadDayIntoForm(iso);
      });
      body.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Summary view ----------
  function renderSummary() {
    const isoList = Object.keys(days).sort();
    const todayN = dayNumber(todayISO(), settings.startDate);
    const relevantIso = isoList.filter((iso) => {
      const n = dayNumber(iso, settings.startDate);
      return n >= 1 && n <= settings.lengthDays;
    });

    let totalMinutes = 0;
    let totalSessions = 0;
    let loggedDays = 0;
    const practiceCounts = {};
    PRACTICES.forEach((p) => (practiceCounts[p.id] = 0));

    relevantIso.forEach((iso) => {
      const rec = days[iso];
      if (wasPracticed(rec)) loggedDays++;
      totalMinutes += rec.zazenMinutes || 0;
      totalSessions += rec.zazenSessions || 0;
      PRACTICES.forEach((p) => {
        if (rec.practices[p.id]) practiceCounts[p.id]++;
      });
    });

    // streaks over the full ango range up to today (or lengthDays if ango finished)
    const lastDayToCheck = Math.min(Math.max(todayN, 0), settings.lengthDays);
    let currentStreak = 0;
    let longestStreak = 0;
    let running = 0;
    for (let n = 1; n <= settings.lengthDays; n++) {
      const iso = toISO(new Date(parseISO(settings.startDate).getTime() + (n - 1) * MS_PER_DAY));
      const practiced = wasPracticed(days[iso]);
      if (practiced) {
        running++;
        longestStreak = Math.max(longestStreak, running);
      } else {
        running = 0;
      }
      if (n === lastDayToCheck) currentStreak = practiced ? running : 0;
    }

    const stats = [
      { label: "Days logged", num: loggedDays },
      { label: "Total zazen hrs", num: (totalMinutes / 60).toFixed(1) },
      { label: "Total sits", num: totalSessions },
      { label: "Current streak", num: currentStreak },
      { label: "Longest streak", num: longestStreak },
    ];

    const grid = document.getElementById("statGrid");
    grid.innerHTML = stats
      .map(
        (s) => `<div class="stat-box"><div class="num">${s.num}</div><div class="label">${s.label}</div></div>`
      )
      .join("");

    const denom = Math.max(1, relevantIso.length);
    const practiceStats = document.getElementById("practiceStats");
    practiceStats.innerHTML = PRACTICES.map((p) => {
      const pct = Math.round((practiceCounts[p.id] / denom) * 100);
      return `
        <div class="practice-row">
          <span class="name">${p.label}</span>
          <div class="practice-bar-track"><div class="practice-bar-fill" style="width:${pct}%"></div></div>
          <span class="pct">${pct}%</span>
        </div>`;
    }).join("");

    const journalText = buildJournalMarkdown();
    document.getElementById("journalPreview").textContent = journalText;
  }

  function buildJournalMarkdown() {
    const isoList = Object.keys(days).sort();
    let out = `# Ango Journal — starting ${settings.startDate}\n\n`;
    isoList.forEach((iso) => {
      const rec = days[iso];
      const n = dayNumber(iso, settings.startDate);
      out += `## Day ${n} — ${iso}\n`;
      out += `Zazen: ${rec.zazenMinutes || 0} min (${rec.zazenSessions || 0} sits)\n`;
      const done = PRACTICES.filter((p) => rec.practices[p.id]).map((p) => p.label);
      if (done.length) out += `Practice: ${done.join(", ")}\n`;
      if (rec.journal) out += `\n${rec.journal}\n`;
      out += `\n`;
    });
    return out;
  }

  function downloadFile(filename, content, mime) {
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

  document.getElementById("exportJournalBtn").addEventListener("click", () => {
    downloadFile("ango-journal.md", buildJournalMarkdown(), "text/markdown");
  });

  // ---------- Settings view ----------
  const startDateInput = document.getElementById("startDate");
  const lengthDaysInput = document.getElementById("lengthDays");

  function loadSettingsIntoForm() {
    startDateInput.value = settings.startDate;
    lengthDaysInput.value = settings.lengthDays;
  }

  document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    settings.startDate = startDateInput.value || settings.startDate;
    settings.lengthDays = Number(lengthDaysInput.value) || 90;
    saveSettings(settings);
    renderHeader();
    const status = document.getElementById("settingsStatus");
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });

  document.getElementById("exportDataBtn").addEventListener("click", () => {
    const payload = { settings, days };
    downloadFile("ango-backup.json", JSON.stringify(payload, null, 2), "application/json");
  });

  document.getElementById("importDataInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (payload.settings) settings = payload.settings;
        if (payload.days) days = payload.days;
        saveSettings(settings);
        saveDays(days);
        loadSettingsIntoForm();
        renderHeader();
        loadDayIntoForm(logDateInput.value);
        document.getElementById("backupStatus").textContent = "Import successful.";
      } catch (err) {
        document.getElementById("backupStatus").textContent = "Import failed: invalid file.";
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("clearDataBtn").addEventListener("click", () => {
    if (!confirm("This will permanently delete all logged days and settings. Continue?")) return;
    localStorage.removeItem(STORAGE.settings);
    localStorage.removeItem(STORAGE.days);
    settings = loadSettings();
    days = {};
    loadSettingsIntoForm();
    renderHeader();
    logDateInput.value = todayISO();
    loadDayIntoForm(todayISO());
  });

  // ---------- Init ----------
  logDateInput.value = todayISO();
  loadSettingsIntoForm();
  loadDayIntoForm(todayISO());
  renderHeader();
})();
