// ---------------------------------------------------------------------------
// Workouts: exercise library, preset/custom programs, coach-mode player.
// ---------------------------------------------------------------------------

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function parseMMSS(str) {
  if (!str) return 0;
  const parts = String(str).split(":").map((n) => Number(n) || 0);
  if (parts.length === 1) return parts[0];
  return parts[0] * 60 + parts[1];
}

// Spreads a day-level time budget across every set in that day as a pacing
// suggestion. Time-based/distance-based exercises get a slightly larger share
// (they inherently take longer to execute per set) than pure reps exercises.
// Every value this produces remains user-editable afterward.
function distributeDayTime(day, totalSeconds) {
  const weight = (entry) => {
    if (entry.type === "time") return 1.4;
    if (entry.type === "distance") return 1.6;
    return 1.0;
  };
  const totalWeightedSets = day.exercises.reduce((sum, e) => sum + (e.sets || 1) * weight(e), 0);
  if (totalWeightedSets <= 0) return;
  const perWeightedSetSeconds = totalSeconds / totalWeightedSets;
  day.exercises.forEach((entry) => {
    const raw = perWeightedSetSeconds * weight(entry);
    entry.targetSeconds = Math.max(10, Math.round(raw / 5) * 5);
  });
}

// Which weekdays (0=Sun..6=Sat) get a training slot for a given days/week count.
const WEEKDAY_PATTERNS = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

// Builds a full day-by-day roster spanning the whole program length, cycling
// through the program's day templates repeatedly - deliberately NOT capped
// to the number of day templates, so the whole duration is visible at once.
function generateProgramSchedule(program, weeks, daysPerWeek, startDateStr) {
  const clampedDpw = Math.min(7, Math.max(1, Math.round(daysPerWeek) || program.days.length || 3));
  const pattern = WEEKDAY_PATTERNS[clampedDpw] || WEEKDAY_PATTERNS[3];
  const start = startDateStr ? new Date(startDateStr + "T00:00:00") : new Date();
  start.setHours(0, 0, 0, 0);

  const schedule = [];
  let dayIndexCounter = 0;
  const totalDays = Math.max(1, weeks) * 7;
  for (let d = 0; d < totalDays; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);
    if (pattern.includes(date.getDay())) {
      schedule.push({
        id: "sched_" + uuidv4(),
        date: fmtDate(date),
        dayIndex: dayIndexCounter % program.days.length,
        sessionId: null,
      });
      dayIndexCounter++;
    }
  }
  return schedule;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

async function screenWorkoutsHub(root) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"><div class="loading">Loading…</div></div>`);
  root.appendChild(renderShell("workouts", content));

  const programs = await DB.getAllByProfile("programs", profile.id);

  content.innerHTML = `
    <h1>Train</h1>
    <div class="row-buttons">
      <a href="#/workouts/library" class="btn-secondary">Exercise Library</a>
      <a href="#/workouts/builder" class="btn-secondary">Build Custom Routine</a>
    </div>
    <h2>Your Programs</h2>
    <div class="list" id="programList"></div>
  `;

  const listEl = content.querySelector("#programList");
  if (programs.length === 0) {
    listEl.innerHTML = `<p class="muted">No programs yet. Complete onboarding or build a custom routine.</p>`;
  }
  programs.forEach((p) => {
    const card = el(`
      <div class="program-card">
        <div class="program-card-header">
          <button class="program-name-btn">
            <h3>${escapeHtml(p.name)} ${p.isDefault ? `<span class="tag">⭐ Recommended</span>` : ""}</h3>
            <p class="muted">${p.category} · ${p.days.length} day(s) · tap to view</p>
          </button>
        </div>
        <div class="program-days"></div>
      </div>
    `);
    card.querySelector(".program-name-btn").addEventListener("click", () => {
      location.hash = `#/workouts/program?id=${p.id}`;
    });
    const daysEl = card.querySelector(".program-days");
    p.days.forEach((day, idx) => {
      const btn = el(`<button class="btn-primary small">${escapeHtml(day.name)}</button>`);
      btn.addEventListener("click", () => startSession(p, idx));
      daysEl.appendChild(btn);
    });
    listEl.appendChild(card);
  });
}

async function screenProgramDetail(root, params) {
  const id = params.get("id");
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("workouts", content));

  const program = await DB.get("programs", id);
  if (!program) {
    content.innerHTML = `<p class="muted">Program not found.</p><a href="#/workouts" class="btn-link">← Back</a>`;
    return;
  }
  const allExercises = await DB.getAll("exercises");
  const exMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));
  const profile = Auth.currentProfile;

  // Auto-generate a full-duration calendar the first time this program is
  // viewed, using its known length/cadence (or sensible fallbacks) so the
  // whole plan is visible immediately without an extra setup step.
  if (!program.schedule || program.schedule.length === 0) {
    const weeks = program.programLengthWeeks || (profile.bio && profile.bio.programLengthWeeks) || 4;
    const dpw = (profile.bio && profile.bio.daysPerWeek) || program.days.length || 3;
    program.schedule = generateProgramSchedule(program, weeks, dpw);
    program.programLengthWeeks = program.programLengthWeeks || weeks;
    await DB.put("programs", program);
  }

  content.innerHTML = `
    <div class="screen-header">
      <a href="#/workouts" class="btn-link">← Back</a>
    </div>
    <h1>${escapeHtml(program.name)} ${program.isDefault ? `<span class="tag">⭐ Recommended</span>` : ""}</h1>
    <p class="muted">
      ${escapeHtml(program.category)} · ${program.days.length} day type(s)
      ${program.programLengthWeeks ? ` · ${program.programLengthWeeks}-week program` : ""}
      ${program.intensityLabel ? `<span class="intensity-badge intensity-${program.intensityLabel}">${program.intensityLabel.replace("-", " ")} intensity</span>` : ""}
    </p>
    <div class="row-buttons">
      <button id="editProgBtn" class="btn-secondary small">✏️ Edit program</button>
      <button id="deleteProgBtn" class="btn-danger small">🗑 Delete program</button>
      <button id="calSettingsBtn" class="btn-secondary small">🔧 Calendar settings</button>
    </div>

    <div id="calSettingsPanel" class="settings-group" style="display:none">
      <form id="calSettingsForm" class="form">
        <label>Program length (weeks)
          <input name="weeks" type="number" min="1" max="52" value="${program.programLengthWeeks || 4}" />
        </label>
        <label>Training days per week
          <input name="daysPerWeek" type="number" min="1" max="7" value="${(profile.bio && profile.bio.daysPerWeek) || program.days.length}" />
        </label>
        <p class="finePrint">Regenerating replaces the calendar below (completed days already logged stay in your session history either way, but their calendar checkmarks will reset).</p>
        <button type="submit" class="btn-danger small">Regenerate calendar</button>
      </form>
    </div>

    <h2>Day Templates</h2>
    <div id="daysList"></div>

    <h2>Calendar — Full Plan</h2>
    <p class="muted">${program.schedule.length} session(s) scheduled${program.programLengthWeeks ? ` over ${program.programLengthWeeks} week(s)` : ""}.</p>
    <div id="calendarList"></div>
  `;

  const daysList = content.querySelector("#daysList");
  program.days.forEach((day, idx) => {
    const dayEl = el(`
      <div class="program-detail-day">
        <div class="day-block-header">
          <h3>${escapeHtml(day.name)}</h3>
          <button class="btn-secondary small startDayBtn">▶ Start (unscheduled)</button>
        </div>
        ${day.targetTotalSeconds ? `<p class="muted">Target session length: ${formatMMSS(day.targetTotalSeconds)}</p>` : ""}
        <div class="day-ex-list"></div>
      </div>
    `);
    const exListEl = dayEl.querySelector(".day-ex-list");
    day.exercises.forEach((entry) => {
      const ex = exMap[entry.exerciseId] || { name: "?" };
      const targetText = entry.type === "time"
        ? formatMMSS(entry.targetSeconds || 30)
        : entry.type === "distance"
        ? `${entry.targetDistance || 1} mi/km`
        : `${entry.targetReps || 10} reps${entry.targetSeconds ? ` (~${formatMMSS(entry.targetSeconds)} pace)` : ""}`;
      exListEl.appendChild(el(`
        <div class="program-detail-ex">
          <span>${escapeHtml(ex.name)} · ${entry.sets || 1} set(s)</span>
          <span class="muted">${targetText}</span>
        </div>
      `));
    });
    dayEl.querySelector(".startDayBtn").addEventListener("click", () => startSession(program, idx));
    daysList.appendChild(dayEl);
  });

  renderCalendar();

  function renderCalendar() {
    const calendarList = content.querySelector("#calendarList");
    calendarList.innerHTML = "";
    const today = fmtDate();
    const sorted = [...program.schedule].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = sorted[0]?.date || today;

    const weeksMap = {};
    sorted.forEach((entry) => {
      const dayDiff = Math.round((new Date(entry.date) - new Date(firstDate)) / 86400000);
      const weekNum = Math.floor(dayDiff / 7) + 1;
      (weeksMap[weekNum] = weeksMap[weekNum] || []).push(entry);
    });

    Object.keys(weeksMap).sort((a, b) => a - b).forEach((weekNum) => {
      const weekEl = el(`<div class="cal-week"><h3>Week ${weekNum}</h3><div class="cal-week-days"></div></div>`);
      const daysWrap = weekEl.querySelector(".cal-week-days");
      weeksMap[weekNum].forEach((entry) => {
        const dayTemplate = program.days[entry.dayIndex] || { name: "?", exercises: [] };
        const exerciseSummary = dayTemplate.exercises
          .map((e) => (exMap[e.exerciseId] || { name: "?" }).name)
          .join(", ");
        const completed = !!entry.sessionId;
        const isPast = entry.date < today;
        const isToday = entry.date === today;
        const status = completed ? "completed" : isPast ? "missed" : isToday ? "today" : "upcoming";
        const statusLabel = { completed: "✅ Completed", missed: "⚠️ Missed", today: "▶ Today", upcoming: "Upcoming" }[status];

        const row = el(`
          <div class="cal-day-row cal-status-${status}">
            <div class="cal-day-date">${formatDateLabel(entry.date)}</div>
            <div class="cal-day-info">
              <strong>${escapeHtml(dayTemplate.name)}</strong>
              <div class="muted cal-day-exercises">${escapeHtml(exerciseSummary)}</div>
            </div>
            <div class="cal-day-status">${statusLabel}</div>
            <div class="cal-day-actions"></div>
          </div>
        `);
        const actionsEl = row.querySelector(".cal-day-actions");
        if (status === "today" || status === "upcoming") {
          const startBtn = el(`<button class="btn-primary small">▶ Start</button>`);
          startBtn.addEventListener("click", () => startSession(program, entry.dayIndex, entry.id));
          actionsEl.appendChild(startBtn);
        } else if (status === "missed") {
          const startBtn = el(`<button class="btn-secondary small">Do it now</button>`);
          startBtn.addEventListener("click", () => startSession(program, entry.dayIndex, entry.id));
          const rescheduleBtn = el(`<button class="btn-secondary small">🔁 Reschedule</button>`);
          rescheduleBtn.addEventListener("click", () => openRescheduleModal(program, entry, renderCalendar));
          actionsEl.appendChild(startBtn);
          actionsEl.appendChild(rescheduleBtn);
        }
        daysWrap.appendChild(row);
      });
      calendarList.appendChild(weekEl);
    });
  }

  content.querySelector("#calSettingsBtn").addEventListener("click", () => {
    const panel = content.querySelector("#calSettingsPanel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  content.querySelector("#calSettingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const weeks = Number(e.target.weeks.value) || 4;
    const dpw = Number(e.target.daysPerWeek.value) || program.days.length;
    if (!confirm("Regenerate the calendar? This resets completion checkmarks for the schedule (your logged sessions themselves are kept in Progress history).")) return;
    program.programLengthWeeks = weeks;
    program.schedule = generateProgramSchedule(program, weeks, dpw);
    await DB.put("programs", program);
    toast("Calendar regenerated.");
    router();
  });

  content.querySelector("#editProgBtn").addEventListener("click", () => {
    location.hash = `#/workouts/builder?edit=${program.id}`;
  });
  content.querySelector("#deleteProgBtn").addEventListener("click", async () => {
    if (!confirm(`Delete "${program.name}"? This can't be undone.`)) return;
    await DB.delete("programs", program.id);
    toast("Program deleted.");
    location.hash = "#/workouts";
  });
}

function openRescheduleModal(program, entry, onDone) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Reschedule missed day</h3>
        <p class="muted">"${escapeHtml(program.days[entry.dayIndex]?.name || "")}" was scheduled for ${formatDateLabel(entry.date)}.</p>
        <form id="rescheduleForm" class="form">
          <label>New date
            <input name="newDate" type="date" min="${fmtDate()}" required />
          </label>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelReschedule">Cancel</button>
            <button type="submit" class="btn-primary">Reschedule</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelReschedule").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#rescheduleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newDate = e.target.newDate.value;
    if (!newDate) return;
    entry.date = newDate;
    await DB.put("programs", program);
    dlg.remove();
    toast("Rescheduled.");
    onDone();
  });
  document.body.appendChild(dlg);
}

async function startSession(program, dayIndex, scheduleEntryId) {
  const profile = Auth.currentProfile;
  const day = program.days[dayIndex];
  const session = {
    id: "session_" + uuidv4(),
    profileId: profile.id,
    programId: program.id,
    programName: program.name,
    dayName: day.name,
    dayIndex,
    scheduleEntryId: scheduleEntryId || null,
    date: fmtDate(),
    status: "in_progress",
    exercises: day.exercises.map((ex) => ({ ...ex, completedSets: [] })),
    startedAt: new Date().toISOString(),
  };
  await DB.put("sessions", session);
  location.hash = `#/workouts/session?id=${session.id}`;
}

async function screenExerciseLibrary(root) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("workouts", content));

  const exercises = await DB.getAllByProfile("exercises", profile.id).then(async (mine) => {
    const global = (await DB.getAll("exercises")).filter((e) => e.profileId === "global");
    return [...global, ...mine];
  });

  content.innerHTML = `
    <div class="screen-header">
      <a href="#/workouts" class="btn-link">← Back</a>
      <h1>Exercise Library</h1>
    </div>
    <div class="filter-row">
      <input id="searchBox" placeholder="Search exercises…" />
      <select id="catFilter">
        <option value="">All categories</option>
        <option value="calisthenics">Calisthenics</option>
        <option value="military">Military</option>
      </select>
      <button id="addExerciseBtn" class="btn-secondary small">+ Add custom exercise</button>
    </div>
    <div class="list" id="exList"></div>
  `;

  function render() {
    const q = content.querySelector("#searchBox").value.toLowerCase();
    const cat = content.querySelector("#catFilter").value;
    const filtered = exercises.filter((e) =>
      (!cat || e.category === cat) && (!q || e.name.toLowerCase().includes(q))
    );
    const listEl = content.querySelector("#exList");
    listEl.innerHTML = "";
    if (filtered.length === 0) {
      listEl.innerHTML = `<p class="muted">No matches.</p>`;
      return;
    }
    filtered.forEach((e) => {
      const row = el(`
        <div class="list-row">
          <div>
            <strong>${escapeHtml(e.name)}</strong>
            <div class="muted">${e.category} · ${e.muscleGroup} · ${e.equipment}</div>
          </div>
          <div class="list-row-actions">
            ${e.videoUrl ? `<span class="tag">has video</span>` : ""}
            <button class="btn-secondary small previewBtn">👁 Preview</button>
            <button class="btn-secondary small videoBtn">🎥 ${e.videoUrl ? "Change" : "Add"} video</button>
          </div>
        </div>
      `);
      row.querySelector(".previewBtn").addEventListener("click", () => openExercisePreview(e));
      row.querySelector(".videoBtn").addEventListener("click", () => openVideoAttachModal(e, exercises, render));
      listEl.appendChild(row);
    });
  }
  content.querySelector("#searchBox").addEventListener("input", render);
  content.querySelector("#catFilter").addEventListener("change", render);
  content.querySelector("#addExerciseBtn").addEventListener("click", () => openExerciseEditor(exercises, render));
  render();
}

function openExercisePreview(ex) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${escapeHtml(ex.name)}</h3>
        <p class="muted">${escapeHtml(ex.category)} · ${escapeHtml(ex.muscleGroup || "")} · ${escapeHtml(ex.equipment || "")}</p>
        ${ex.videoUrl
          ? `<video src="${ex.videoUrl}" controls autoplay loop muted playsinline class="preview-video"></video>`
          : `<div class="ex-placeholder">🎥 No video attached yet</div>`}
        <p>${escapeHtml(ex.instructions || "No instructions added yet.")}</p>
        <button id="closePreview" class="btn-secondary">Close</button>
      </div>
    </div>
  `);
  dlg.querySelector("#closePreview").addEventListener("click", () => dlg.remove());
  document.body.appendChild(dlg);
}

function openVideoAttachModal(ex, exercisesArr, onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>${ex.videoUrl ? "Change" : "Add"} video — ${escapeHtml(ex.name)}</h3>
        ${ex.videoUrl ? `<video src="${ex.videoUrl}" controls class="preview-video"></video>` : ""}
        <form id="videoForm" class="form">
          <input name="video" type="file" accept="video/*" ${ex.videoUrl ? "" : "required"} />
          <div class="modal-actions">
            ${ex.videoUrl ? `<button type="button" class="btn-danger small" id="removeVideoBtn">Remove video</button>` : ""}
            <button type="button" class="btn-secondary" id="cancelVideo">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelVideo").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#videoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = e.target.video.files[0];
    if (!file) return;
    ex.videoUrl = await fileToDataUrl(file);
    await DB.put("exercises", ex);
    dlg.remove();
    onSaved();
    toast("Video attached.");
  });
  const removeBtn = dlg.querySelector("#removeVideoBtn");
  if (removeBtn) {
    removeBtn.addEventListener("click", async () => {
      ex.videoUrl = null;
      await DB.put("exercises", ex);
      dlg.remove();
      onSaved();
      toast("Video removed.");
    });
  }
  document.body.appendChild(dlg);
}

function openExerciseEditor(exercisesArr, onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>New custom exercise</h3>
        <form id="exForm" class="form">
          <input name="name" placeholder="Exercise name" required />
          <select name="category">
            <option value="calisthenics">Calisthenics</option>
            <option value="military">Military</option>
          </select>
          <input name="muscleGroup" placeholder="Target muscle group" />
          <input name="equipment" placeholder="Equipment (or 'none')" value="none" />
          <select name="type">
            <option value="reps">Reps-based</option>
            <option value="time">Time-based</option>
            <option value="distance">Distance-based</option>
            <option value="weight">Weight-based</option>
          </select>
          <label class="file-label">Attach video/animation (optional)
            <input name="video" type="file" accept="video/*" />
          </label>
          <textarea name="instructions" placeholder="Instructions"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelEx">Cancel</button>
            <button type="submit" class="btn-primary">Save exercise</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelEx").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#exForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    let videoDataUrl = null;
    if (f.video.files[0]) {
      videoDataUrl = await fileToDataUrl(f.video.files[0]);
    }
    const exercise = {
      id: "ex_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      name: f.name.value,
      category: f.category.value,
      muscleGroup: f.muscleGroup.value,
      equipment: f.equipment.value,
      type: f.type.value,
      instructions: f.instructions.value,
      videoUrl: videoDataUrl,
      builtin: false,
    };
    await DB.put("exercises", exercise);
    exercisesArr.push(exercise);
    dlg.remove();
    onSaved();
    toast("Exercise added.");
  });
  document.body.appendChild(dlg);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// --------------------------- ROUTINE BUILDER --------------------------------

async function screenRoutineBuilder(root, params) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("workouts", content));

  const exercises = [...(await DB.getAll("exercises"))].filter((e) => e.profileId === "global" || e.profileId === profile.id);

  const editId = params ? params.get("edit") : null;
  const existingProgram = editId ? await DB.get("programs", editId) : null;

  let days = existingProgram
    ? JSON.parse(JSON.stringify(existingProgram.days))
    : [{ name: "Day 1", exercises: [] }];

  content.innerHTML = `
    <div class="screen-header">
      <a href="#/workouts" class="btn-link">← Back</a>
      <h1>${existingProgram ? "Edit Program" : "Custom Routine Builder"}</h1>
    </div>
    <input id="progName" placeholder="Program name (e.g. My Ruck Prep)" value="${existingProgram ? escapeHtml(existingProgram.name) : ""}" />
    <select id="progCategory">
      <option value="calisthenics" ${existingProgram?.category === "calisthenics" ? "selected" : ""}>Calisthenics</option>
      <option value="military" ${existingProgram?.category === "military" ? "selected" : ""}>Military</option>
      <option value="hybrid" ${existingProgram?.category === "hybrid" ? "selected" : ""}>Hybrid</option>
    </select>
    <div id="daysContainer"></div>
    <div class="row-buttons">
      <button id="addDayBtn" class="btn-secondary small">+ Add day</button>
      <button id="saveProgBtn" class="btn-primary small">Save program</button>
      ${existingProgram ? `<button id="deleteProgBtn" class="btn-danger small">🗑 Delete program</button>` : ""}
    </div>
  `;

  const daysContainer = content.querySelector("#daysContainer");

  function renderDays() {
    daysContainer.innerHTML = "";
    days.forEach((day, dIdx) => {
      const dayEl = el(`
        <div class="day-block">
          <div class="day-block-header">
            <input class="day-name" value="${escapeHtml(day.name)}" />
            <button class="btn-danger small removeDayBtn" ${days.length <= 1 ? "disabled" : ""}>Remove day</button>
          </div>
          <div class="time-field">
            Day target length (mm:ss, optional):
            <input class="mmss-input dayTargetInput" value="${day.targetTotalSeconds ? formatMMSS(day.targetTotalSeconds) : ""}" placeholder="60:00" />
            <button class="btn-secondary small distributeBtn">Auto-distribute time</button>
          </div>
          <div class="ex-picker-row">
            <select class="exSelect">
              <option value="">+ Add exercise…</option>
              ${exercises.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join("")}
            </select>
          </div>
          <div class="day-exercises"></div>
        </div>
      `);
      dayEl.querySelector(".day-name").addEventListener("input", (e) => (day.name = e.target.value));
      dayEl.querySelector(".removeDayBtn").addEventListener("click", () => {
        if (days.length <= 1) return;
        if (!confirm(`Remove "${day.name}"?`)) return;
        days.splice(dIdx, 1);
        renderDays();
      });
      dayEl.querySelector(".dayTargetInput").addEventListener("change", (e) => {
        day.targetTotalSeconds = parseMMSS(e.target.value) || null;
      });
      dayEl.querySelector(".distributeBtn").addEventListener("click", () => {
        const seconds = parseMMSS(dayEl.querySelector(".dayTargetInput").value);
        if (!seconds || day.exercises.length === 0) {
          toast("Enter a day target length and add at least one exercise first.", true);
          return;
        }
        day.targetTotalSeconds = seconds;
        distributeDayTime(day, seconds);
        toast("Time distributed across sets — tweak any exercise below if needed.");
        renderDays();
      });
      dayEl.querySelector(".exSelect").addEventListener("change", (e) => {
        const exId = e.target.value;
        if (!exId) return;
        const ex = exercises.find((x) => x.id === exId);
        day.exercises.push({ exerciseId: exId, targetReps: 10, sets: 3, restSeconds: 10, type: ex.type });
        e.target.value = "";
        renderDays();
      });
      const exListEl = dayEl.querySelector(".day-exercises");
      day.exercises.forEach((de, eIdx) => {
        const ex = exercises.find((x) => x.id === de.exerciseId);
        const row = el(`
          <div class="day-ex-row">
            <strong>${escapeHtml(ex ? ex.name : "?")}</strong>
            <input type="number" min="1" value="${de.sets}" title="sets" class="tinyNum setsInput" />
            ${de.type === "distance"
              ? `<input type="number" min="0.1" step="0.1" value="${de.targetDistance || 1}" title="distance (mi/km)" class="tinyNum distInput" />`
              : de.type === "time"
              ? ""
              : `<input type="number" min="1" value="${de.targetReps || 10}" title="reps" class="tinyNum repsInput" />`}
            <span class="time-field">${de.type === "time" ? "Hold/duration:" : "Set duration (optional):"}
              <input class="mmss-input durationInput" value="${de.targetSeconds ? formatMMSS(de.targetSeconds) : ""}" placeholder="${de.type === "time" ? "00:30" : "--:--"}" />
            </span>
            <button class="btn-icon removeExBtn">✕</button>
          </div>
        `);
        row.querySelector(".setsInput").addEventListener("input", (e) => (de.sets = Number(e.target.value)));
        const repsInput = row.querySelector(".repsInput");
        if (repsInput) repsInput.addEventListener("input", (e) => (de.targetReps = Number(e.target.value)));
        const distInput = row.querySelector(".distInput");
        if (distInput) distInput.addEventListener("input", (e) => (de.targetDistance = Number(e.target.value)));
        row.querySelector(".durationInput").addEventListener("change", (e) => {
          const secs = parseMMSS(e.target.value);
          de.targetSeconds = secs || (de.type === "time" ? 30 : null);
        });
        row.querySelector(".removeExBtn").addEventListener("click", () => {
          day.exercises.splice(eIdx, 1);
          renderDays();
        });
        exListEl.appendChild(row);
      });
      daysContainer.appendChild(dayEl);
    });
  }
  renderDays();

  content.querySelector("#addDayBtn").addEventListener("click", () => {
    days.push({ name: `Day ${days.length + 1}`, exercises: [] });
    renderDays();
  });

  content.querySelector("#saveProgBtn").addEventListener("click", async () => {
    const name = content.querySelector("#progName").value.trim();
    if (!name) return toast("Give your program a name.", true);
    if (days.every((d) => d.exercises.length === 0)) return toast("Add at least one exercise.", true);
    const program = {
      id: existingProgram ? existingProgram.id : "program_" + uuidv4(),
      profileId: profile.id,
      name,
      category: content.querySelector("#progCategory").value,
      builtin: existingProgram ? existingProgram.builtin : false,
      days,
    };
    await DB.put("programs", program);
    toast(existingProgram ? "Program updated." : "Program saved.");
    location.hash = "#/workouts";
  });

  const deleteBtn = content.querySelector("#deleteProgBtn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (!confirm(`Delete "${existingProgram.name}"? This can't be undone.`)) return;
      await DB.delete("programs", existingProgram.id);
      toast("Program deleted.");
      location.hash = "#/workouts";
    });
  }
}

// --------------------------- SESSION PLAYER (COACH MODE) --------------------

let _sessionAudio = null;
let _sessionTtsEnabled = true;

async function screenSessionPlayer(root, params) {
  const sessionId = params.get("id");
  const session = await DB.get("sessions", sessionId);
  const content = el(`<div class="screen player-screen"></div>`);
  root.appendChild(renderShell("workouts", content));

  if (!session) {
    content.innerHTML = `<p>Session not found.</p>`;
    return;
  }

  const allExercises = await DB.getAll("exercises");
  const exMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));

  let currentIndex = 0;
  let currentSet = 1;
  let timerInterval = null;

  content.innerHTML = `
    <div class="screen-header">
      <a href="#/workouts" class="btn-link">✕ Exit</a>
      <h1>${escapeHtml(session.dayName)}</h1>
    </div>
    <div class="coach-controls">
      <label><input type="checkbox" id="ttsToggle" checked /> Voice cues</label>
      <label class="file-label">🎵 Background music
        <input type="file" id="musicFile" accept="audio/*" />
      </label>
      <button id="musicToggle" class="btn-secondary small" disabled>Play music</button>
      <button id="musicRemove" class="btn-danger small" disabled>Remove music</button>
    </div>
    <div id="playerBody"></div>
  `;

  content.querySelector("#ttsToggle").addEventListener("change", (e) => (_sessionTtsEnabled = e.target.checked));
  content.querySelector("#musicFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (_sessionAudio) { _sessionAudio.pause(); _sessionAudio = null; }
    _sessionAudio = new Audio(URL.createObjectURL(file));
    _sessionAudio.loop = true;
    _sessionAudio.volume = 0.35;
    content.querySelector("#musicToggle").disabled = false;
    content.querySelector("#musicToggle").textContent = "Play music";
    content.querySelector("#musicRemove").disabled = false;
  });
  content.querySelector("#musicToggle").addEventListener("click", (e) => {
    if (!_sessionAudio) return;
    if (_sessionAudio.paused) { _sessionAudio.play(); e.target.textContent = "Pause music"; }
    else { _sessionAudio.pause(); e.target.textContent = "Play music"; }
  });
  content.querySelector("#musicRemove").addEventListener("click", () => {
    if (_sessionAudio) { _sessionAudio.pause(); _sessionAudio = null; }
    content.querySelector("#musicFile").value = "";
    content.querySelector("#musicToggle").disabled = true;
    content.querySelector("#musicToggle").textContent = "Play music";
    content.querySelector("#musicRemove").disabled = true;
    toast("Music removed.");
  });

  function speak(text) {
    if (!_sessionTtsEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    window.speechSynthesis.speak(u);
  }

  const body = content.querySelector("#playerBody");

  function renderCurrent() {
    clearInterval(timerInterval);
    if (currentIndex >= session.exercises.length) {
      return renderComplete();
    }
    const entry = session.exercises[currentIndex];
    const ex = exMap[entry.exerciseId] || { name: "Exercise", instructions: "" };
    const totalSets = entry.sets || 1;

    const targetText = entry.type === "time"
      ? `Hold for ${formatMMSS(entry.targetSeconds || 30)}`
      : entry.type === "distance"
      ? `Target: ${entry.targetDistance || 1} mi/km`
      : `Target: ${entry.targetReps || 10} reps${entry.targetSeconds ? ` · pace ~${formatMMSS(entry.targetSeconds)}` : ""}`;

    body.innerHTML = `
      <div class="exercise-stage">
        <h2>${escapeHtml(ex.name)}</h2>
        <p class="muted">Set ${currentSet} of ${totalSets}</p>
        ${ex.videoUrl ? `<video src="${ex.videoUrl}" autoplay loop muted playsinline class="ex-video"></video>` : `<div class="ex-placeholder">🎥 No video attached</div>`}
        <p>${escapeHtml(ex.instructions || "")}</p>
        <div class="target-display">${targetText}</div>
        <div class="stage-actions">
          <button id="startSetBtn" class="btn-primary start-set-btn">▶ Start set</button>
          <button id="skipBtn" class="btn-secondary">Skip exercise</button>
        </div>
      </div>
    `;

    body.querySelector("#startSetBtn").addEventListener("click", () => runPreCountdown(entry, ex, totalSets));
    body.querySelector("#skipBtn").addEventListener("click", () => advanceExercise());
  }

  function runPreCountdown(entry, ex, totalSets) {
    clearInterval(timerInterval);
    let remaining = 5;
    body.innerHTML = `
      <div class="exercise-stage">
        <h2>${escapeHtml(ex.name)}</h2>
        <p class="muted">Get ready — Set ${currentSet} of ${totalSets}</p>
        <div class="pre-countdown" id="preCountdown">${remaining}</div>
      </div>
    `;
    speak(`Get ready. ${ex.name}. Set ${currentSet}.`);
    const display = body.querySelector("#preCountdown");
    timerInterval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timerInterval);
        speak("Go!");
        beginSet(entry, ex, totalSets);
        return;
      }
      display.textContent = remaining;
      if (remaining <= 3) speak(String(remaining));
    }, 1000);
  }

  function beginSet(entry, ex, totalSets) {
    clearInterval(timerInterval);
    const targetArea = el(`<div id="targetArea"></div>`);
    body.innerHTML = "";
    const stage = el(`
      <div class="exercise-stage">
        <h2>${escapeHtml(ex.name)}</h2>
        <p class="muted">Set ${currentSet} of ${totalSets}</p>
        ${ex.videoUrl ? `<video src="${ex.videoUrl}" autoplay loop muted playsinline class="ex-video"></video>` : `<div class="ex-placeholder">🎥 No video attached</div>`}
      </div>
    `);
    stage.appendChild(targetArea);
    const actions = el(`
      <div class="stage-actions">
        <button id="doneSetBtn" class="btn-primary">✓ Set complete</button>
      </div>
    `);
    stage.appendChild(actions);
    body.appendChild(stage);

    if (entry.type === "time") {
      let remainingSeconds = entry.targetSeconds || 30;
      targetArea.innerHTML = `<div class="timer-display" id="timerDisplay">${formatMMSS(remainingSeconds)}</div>`;
      const timerDisplay = targetArea.querySelector("#timerDisplay");
      timerInterval = setInterval(() => {
        remainingSeconds--;
        timerDisplay.textContent = formatMMSS(remainingSeconds);
        if (remainingSeconds === 3) speak("3, 2, 1");
        if (remainingSeconds <= 0) {
          clearInterval(timerInterval);
          speak("Time. Nice work.");
          completeSet(entry.targetSeconds || 30);
        }
      }, 1000);
      actions.style.display = "none"; // time-based sets complete automatically
    } else if (entry.type === "distance") {
      targetArea.innerHTML = `<div class="target-display">Target: ${entry.targetDistance || 1} mi/km</div>`;
    } else {
      targetArea.innerHTML = `<div class="target-display">Target: ${entry.targetReps || 10} reps</div>`;
      if (entry.targetSeconds) {
        // Optional pacing guide - purely informational, doesn't force completion.
        let paceRemaining = entry.targetSeconds;
        const paceEl = el(`<div class="pace-timer">Suggested pace: ${formatMMSS(paceRemaining)}</div>`);
        targetArea.appendChild(paceEl);
        timerInterval = setInterval(() => {
          paceRemaining--;
          if (paceRemaining <= 0) {
            clearInterval(timerInterval);
            paceEl.textContent = "Pace time's up — finish when ready.";
          } else {
            paceEl.textContent = `Suggested pace: ${formatMMSS(paceRemaining)}`;
          }
        }, 1000);
      }
    }

    const doneBtn = stage.querySelector("#doneSetBtn");
    if (doneBtn) {
      doneBtn.addEventListener("click", () => completeSet(entry.targetReps || entry.targetSeconds || entry.targetDistance));
    }
  }

  function completeSet(achieved) {
    clearInterval(timerInterval);
    const entry = session.exercises[currentIndex];
    entry.completedSets.push({ set: currentSet, achieved, timestamp: new Date().toISOString() });
    const totalSets = entry.sets || 1;
    if (currentSet < totalSets) {
      currentSet++;
      speak(`Recovery. ${entry.restSeconds || 10} seconds.`);
      renderRecovery(entry.restSeconds || 10, renderCurrent);
    } else {
      advanceExercise();
    }
  }

  function renderRecovery(seconds, onDone) {
    clearInterval(timerInterval);
    let remaining = seconds;
    body.innerHTML = `
      <div class="exercise-stage rest-stage">
        <h2>Recovery</h2>
        <div class="timer-display">${formatMMSS(remaining)}</div>
        <button id="skipRestBtn" class="btn-secondary">Skip recovery</button>
      </div>
    `;
    const display = body.querySelector(".timer-display");
    timerInterval = setInterval(() => {
      remaining--;
      display.textContent = formatMMSS(remaining);
      if (remaining <= 0) { clearInterval(timerInterval); onDone(); }
    }, 1000);
    body.querySelector("#skipRestBtn").addEventListener("click", () => { clearInterval(timerInterval); onDone(); });
  }

  function advanceExercise() {
    currentIndex++;
    currentSet = 1;
    renderCurrent();
  }

  async function renderComplete() {
    session.status = "complete";
    session.completedAt = new Date().toISOString();
    await DB.put("sessions", session);

    // If this session was started from a specific calendar slot, mark that
    // slot completed so the program's roster reflects it.
    if (session.scheduleEntryId) {
      const program = await DB.get("programs", session.programId);
      if (program && program.schedule) {
        const entry = program.schedule.find((e) => e.id === session.scheduleEntryId);
        if (entry) {
          entry.sessionId = session.id;
          await DB.put("programs", program);
        }
      }
    }

    speak("Workout complete. Great work.");
    if (_sessionAudio) { _sessionAudio.pause(); _sessionAudio = null; }
    body.innerHTML = `
      <div class="exercise-stage">
        <h2>🎉 Session complete</h2>
        <p class="muted">Logged to your progress history.</p>
        <a href="#/workouts" class="btn-primary">Back to Train</a>
        <a href="#/progress" class="btn-secondary">View Progress</a>
      </div>
    `;
  }

  renderCurrent();
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}
