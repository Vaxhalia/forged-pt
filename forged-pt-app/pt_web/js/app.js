// ---------------------------------------------------------------------------
// App shell: hash router + top-level screen rendering.
// Feature-specific rendering lives in workouts.js / nutrition.js / progress.js
// ---------------------------------------------------------------------------

const root = document.getElementById("app");

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function fmtDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function isIOS() {
  return /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalonePWA() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
}

function toast(msg, isError = false) {
  const t = el(`<div class="toast ${isError ? "toast-error" : ""}">${msg}</div>`);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2600);
}

function appName() {
  const p = Auth.currentProfile;
  return (p && p.customAppName && p.customAppName.trim()) || "FORGED PT";
}

function brandHtml() {
  const name = appName();
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1) {
    const last = parts.pop();
    return `${escapeHtml(parts.join(" "))} <span class="brand-sub">${escapeHtml(last)}</span>`;
  }
  return `<span class="brand-sub">${escapeHtml(name)}</span>`;
}

async function applyProfileTheme() {
  const p = Auth.currentProfile;
  document.body.classList.remove("theme-calisthenics", "theme-military");
  document.body.classList.add(p && p.theme === "military" ? "theme-military" : "theme-calisthenics");
  const scheme = (p && p.colorScheme) || "system";
  document.body.classList.remove("scheme-light", "scheme-dark");
  if (scheme !== "system") document.body.classList.add("scheme-" + scheme);
  const scale = (p && p.textScale) || 1.0;
  document.documentElement.style.setProperty("--text-scale", scale);

  if (p && p.accentColor) document.documentElement.style.setProperty("--accent", p.accentColor);
  else document.documentElement.style.removeProperty("--accent");
  if (p && p.accentColor2) document.documentElement.style.setProperty("--accent-2", p.accentColor2);
  else document.documentElement.style.removeProperty("--accent-2");

  document.title = appName() + " — Offline Training";

  const bgLayer = document.getElementById("bgLayer");
  if (p && p.customBackground) {
    bgLayer.style.backgroundImage = `url(${p.customBackground})`;
    const blurPct = p.backgroundBlur === undefined || p.backgroundBlur === null ? 60 : p.backgroundBlur;
    const px = (blurPct / 100) * 22;
    bgLayer.style.filter = `blur(${px}px)`;
    bgLayer.style.opacity = "1";
    document.body.classList.add("has-custom-bg");
  } else {
    bgLayer.style.backgroundImage = "";
    bgLayer.style.opacity = "0";
    document.body.classList.remove("has-custom-bg");
  }
}

// --------------------------- ROUTER ---------------------------------------

function getRoutes() {
  return {
    "/login": screenLogin,
    "/onboarding": screenOnboarding,
    "/home": screenHome,
    "/workouts": screenWorkoutsHub,
    "/workouts/library": screenExerciseLibrary,
    "/workouts/builder": screenRoutineBuilder,
    "/workouts/program": screenProgramDetail,
    "/workouts/session": screenSessionPlayer,
    "/nutrition": screenNutrition,
    "/progress": screenProgress,
    "/profile": screenProfile,
    "/settings": screenSettings,
    "/lock": screenPinLock,
  };
}

async function router() {
  const hash = location.hash.replace("#", "") || "/login";
  const [path, query] = hash.split("?");
  const params = new URLSearchParams(query || "");

  // Auth gate
  if (!Auth.currentProfile) {
    await Auth.resumeSession();
  }
  if (!Auth.currentProfile && path !== "/login") {
    location.hash = "#/login";
    return;
  }
  if (Auth.currentProfile && !Auth.unlocked && path !== "/lock") {
    location.hash = "#/lock";
    return;
  }
  if (Auth.currentProfile && Auth.unlocked && !Auth.currentProfile.onboarded && path !== "/onboarding" && path !== "/lock") {
    location.hash = "#/onboarding";
    return;
  }

  const handler = getRoutes()[path] || screenHome;
  root.innerHTML = "";
  await applyProfileTheme();
  await handler(root, params);
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await seedIfEmpty();
    registerServiceWorker();
    await router();
  } catch (err) {
    console.error("Startup failed:", err);
    renderFatalError(err);
  }
});

window.addEventListener("error", (e) => {
  console.error("Uncaught error:", e.error || e.message);
  if (!root.hasChildNodes()) renderFatalError(e.error || new Error(e.message));
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason);
  if (!root.hasChildNodes()) renderFatalError(e.reason);
});

function renderFatalError(err) {
  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card wide">
        <div class="brand-lg">⚠️ Something went wrong</div>
        <p class="muted">The app hit an error during startup and couldn't load normally.</p>
        <p class="error" style="white-space: pre-wrap;">${escapeHtml((err && err.message) || String(err))}</p>
        <p class="finePrint">If this keeps happening, try running the app via a local server instead of opening the file directly (see README), or check the browser console (F12) for details.</p>
        <button class="btn-primary" onclick="location.reload()">Reload</button>
      </div>
    </div>
  `;
}

// --------------------------- SHELL / NAV -----------------------------------

function renderShell(activeTab, contentEl) {
  const p = Auth.currentProfile;
  const avatarHtml = p && p.bio && p.bio.avatar
    ? `<img src="${p.bio.avatar}" class="avatar-sm" />`
    : `👤`;
  const shell = el(`
    <div class="shell">
      <header class="topbar">
        <div class="brand">${brandHtml()}</div>
        <div class="topbar-actions">
          <button class="icon-btn" id="profileBtn" title="Profile">${avatarHtml}</button>
          <button class="icon-btn" id="lockBtn" title="Lock app">🔒</button>
        </div>
      </header>
      <main class="content" id="mainContent"></main>
      <nav class="bottomnav">
        <a href="#/home" class="nav-item ${activeTab === "home" ? "active" : ""}">🏠<span>Home</span></a>
        <a href="#/workouts" class="nav-item ${activeTab === "workouts" ? "active" : ""}">💪<span>Train</span></a>
        <a href="#/nutrition" class="nav-item ${activeTab === "nutrition" ? "active" : ""}">🍽️<span>Fuel</span></a>
        <a href="#/progress" class="nav-item ${activeTab === "progress" ? "active" : ""}">📈<span>Progress</span></a>
        <a href="#/settings" class="nav-item ${activeTab === "settings" ? "active" : ""}">⚙️<span>Settings</span></a>
      </nav>
    </div>
  `);
  shell.querySelector("#mainContent").appendChild(contentEl);
  shell.querySelector("#lockBtn").addEventListener("click", () => {
    Auth.lock();
    location.hash = "#/lock";
  });
  shell.querySelector("#profileBtn").addEventListener("click", () => {
    location.hash = "#/profile";
  });
  return shell;
}

// --------------------------- LOGIN / PROFILES -------------------------------

async function screenLogin(root) {
  const profiles = await Auth.listProfiles();

  const view = el(`
    <div class="auth-screen">
      <div class="auth-card">
        <div class="brand-lg">${brandHtml()}</div>
        <p class="muted">100% offline calisthenics & military PT training.</p>
        <div id="profileList" class="profile-list"></div>
        <hr/>
        <h3>New profile</h3>
        <form id="createForm" class="form">
          <input name="username" placeholder="Username" required minlength="3" />
          <input name="password" type="password" placeholder="Password" required minlength="6" />
          <button type="submit" class="btn-primary">Create local account</button>
        </form>
        <p class="finePrint">Accounts are stored only on this device. No internet connection is used or required.</p>
      </div>
    </div>
  `);

  const listEl = view.querySelector("#profileList");
  if (profiles.length === 0) {
    listEl.innerHTML = `<p class="muted">No profiles on this device yet — create one below.</p>`;
  } else {
    profiles.forEach((p) => {
      const row = el(`
        <div class="profile-row">
          <button class="profile-btn" data-id="${p.id}">${escapeHtml(p.username)}</button>
        </div>
      `);
      row.querySelector(".profile-btn").addEventListener("click", () => showLoginPrompt(p));
      listEl.appendChild(row);
    });
  }

  function showLoginPrompt(profile) {
    const dlg = el(`
      <div class="modal-backdrop">
        <div class="modal">
          <h3>Log in as ${escapeHtml(profile.username)}</h3>
          <form id="loginForm" class="form">
            <input name="password" type="password" placeholder="Password" required />
            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="cancelLogin">Cancel</button>
              <button type="submit" class="btn-primary">Log in</button>
            </div>
          </form>
          <p class="error" id="loginErr"></p>
        </div>
      </div>
    `);
    dlg.querySelector("#cancelLogin").addEventListener("click", () => dlg.remove());
    dlg.querySelector("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = e.target.password.value;
      try {
        await Auth.login(profile.username, password);
        dlg.remove();
        location.hash = "#/home";
      } catch (err) {
        dlg.querySelector("#loginErr").textContent = err.message;
      }
    });
    document.body.appendChild(dlg);
  }

  view.querySelector("#createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { username, password } = e.target;
    try {
      await Auth.createProfile(username.value.trim(), password.value);
      location.hash = "#/onboarding";
    } catch (err) {
      toast(err.message, true);
    }
  });

  root.appendChild(view);
}

async function screenPinLock(root) {
  const profile = Auth.currentProfile;
  if (!profile.pinHash) {
    Auth.unlocked = true;
    location.hash = profile.onboarded ? "#/home" : "#/onboarding";
    return;
  }
  const view = el(`
    <div class="auth-screen">
      <div class="auth-card">
        <div class="brand-lg">🔒 Locked</div>
        <p class="muted">Enter PIN for ${escapeHtml(profile.username)}</p>
        <form id="pinForm" class="form">
          <input name="pin" type="password" inputmode="numeric" placeholder="PIN" required />
          <button type="submit" class="btn-primary">Unlock</button>
        </form>
        <button id="switchProfile" class="btn-link">Switch profile</button>
        <p class="error" id="pinErr"></p>
      </div>
    </div>
  `);
  view.querySelector("#switchProfile").addEventListener("click", () => {
    Auth.logout();
    location.hash = "#/login";
  });
  view.querySelector("#pinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await Auth.verifyPin(e.target.pin.value);
    if (ok) location.hash = "#/home";
    else view.querySelector("#pinErr").textContent = "Incorrect PIN.";
  });
  root.appendChild(view);
}

// --------------------------- ONBOARDING -------------------------------------

async function screenOnboarding(root) {
  const answers = {
    gender: "male", pushups: "", situps: "", plank: "", runTime: "",
    age: "", bodyType: "unsure", activityLevel: "moderate", sleepHours: "7",
    waterCupsPerDay: "8", eatingPattern: "balanced",
    daysPerWeek: "3", minutesPerSession: "40", programLengthWeeks: "8",
    focusArea: "hybrid", goals: ["general_fitness"],
  };
  let step = 0;
  const totalSteps = 2;

  const shellEl = el(`
    <div class="auth-screen">
      <div class="auth-card wide">
        <div class="brand-lg">Initial Fitness Assessment</div>
        <p class="muted">A couple of quick steps to calibrate your starting plan. You can retest or edit any of this later from your Profile.</p>
        <div class="wizard-steps">
          <div class="wizard-step-dot ${step === 0 ? "active" : ""}"></div>
          <div class="wizard-step-dot"></div>
        </div>
        <div id="wizardBody"></div>
      </div>
    </div>
  `);
  root.appendChild(shellEl);
  const body = shellEl.querySelector("#wizardBody");
  const dots = shellEl.querySelectorAll(".wizard-step-dot");

  function updateDots() {
    dots.forEach((d, i) => d.classList.toggle("active", i === step));
  }

  function renderStep() {
    updateDots();
    if (step === 0) renderStepPhysical();
    else renderStepLifestyle();
  }

  function renderStepPhysical() {
    body.innerHTML = `
      <h3>Physical Assessment</h3>
      <form id="stepForm" class="form">
        <label>Gender (for PT scoring reference)
          <select name="gender">
            <option value="male" ${answers.gender === "male" ? "selected" : ""}>Male</option>
            <option value="female" ${answers.gender === "female" ? "selected" : ""}>Female</option>
          </select>
        </label>
        <label>Age
          <input name="age" type="number" min="14" max="90" value="${answers.age}" required />
        </label>
        <label>Max push-ups (2 min)
          <input name="pushups" type="number" min="0" value="${answers.pushups}" required />
        </label>
        <label>Max sit-ups (2 min)
          <input name="situps" type="number" min="0" value="${answers.situps}" required />
        </label>
        <label>Plank hold (seconds)
          <input name="plank" type="number" min="0" value="${answers.plank}" required />
        </label>
        <label>1.5-2 mile run time (mm:ss)
          <input name="runTime" placeholder="e.g. 14:30" value="${answers.runTime}" required />
        </label>
        <div class="wizard-nav">
          <span></span>
          <button type="submit" class="btn-primary">Next →</button>
        </div>
      </form>
    `;
    body.querySelector("#stepForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      Object.assign(answers, {
        gender: f.gender.value, age: f.age.value, pushups: f.pushups.value,
        situps: f.situps.value, plank: f.plank.value, runTime: f.runTime.value,
      });
      step = 1;
      renderStep();
    });
  }

  function renderStepLifestyle() {
    body.innerHTML = `
      <h3>Lifestyle &amp; Availability</h3>
      <form id="stepForm" class="form">
        <label>Body type
          <select name="bodyType">
            <option value="ectomorph" ${answers.bodyType === "ectomorph" ? "selected" : ""}>Ectomorph (lean/slight build)</option>
            <option value="mesomorph" ${answers.bodyType === "mesomorph" ? "selected" : ""}>Mesomorph (athletic build)</option>
            <option value="endomorph" ${answers.bodyType === "endomorph" ? "selected" : ""}>Endomorph (broader/higher body fat)</option>
            <option value="unsure" ${answers.bodyType === "unsure" ? "selected" : ""}>Not sure</option>
          </select>
        </label>
        <label>Typical daily activity level
          <select name="activityLevel">
            <option value="sedentary" ${answers.activityLevel === "sedentary" ? "selected" : ""}>Sedentary (desk job, little walking)</option>
            <option value="light" ${answers.activityLevel === "light" ? "selected" : ""}>Lightly active</option>
            <option value="moderate" ${answers.activityLevel === "moderate" ? "selected" : ""}>Moderately active</option>
            <option value="active" ${answers.activityLevel === "active" ? "selected" : ""}>Very active / physical job</option>
          </select>
        </label>
        <label>Average sleep (hours/night)
          <input name="sleepHours" type="number" min="3" max="12" step="0.5" value="${answers.sleepHours}" required />
        </label>
        <label>Water intake (cups/day, ~8oz each)
          <input name="waterCupsPerDay" type="number" min="0" max="30" value="${answers.waterCupsPerDay}" required />
        </label>
        <label>Eating pattern
          <select name="eatingPattern">
            <option value="irregular" ${answers.eatingPattern === "irregular" ? "selected" : ""}>Irregular / skip meals often</option>
            <option value="balanced" ${answers.eatingPattern === "balanced" ? "selected" : ""}>Balanced, regular meals</option>
            <option value="high_protein" ${answers.eatingPattern === "high_protein" ? "selected" : ""}>High-protein focus</option>
            <option value="calorie_restricted" ${answers.eatingPattern === "calorie_restricted" ? "selected" : ""}>Actively cutting calories</option>
            <option value="bulking" ${answers.eatingPattern === "bulking" ? "selected" : ""}>Eating surplus to gain size</option>
          </select>
        </label>
        <label>Days per week you can train
          <input name="daysPerWeek" type="number" min="2" max="6" value="${answers.daysPerWeek}" required />
        </label>
        <label>Minutes available per session
          <input name="minutesPerSession" type="number" min="10" max="120" value="${answers.minutesPerSession}" required />
        </label>
        <label>How long do you want this program to run for? (weeks)
          <input name="programLengthWeeks" type="number" min="1" max="52" value="${answers.programLengthWeeks}" required />
        </label>
        <label>Training focus
          <select name="focusArea">
            <option value="calisthenics" ${answers.focusArea === "calisthenics" ? "selected" : ""}>Calisthenics</option>
            <option value="military" ${answers.focusArea === "military" ? "selected" : ""}>Military PT prep</option>
            <option value="hybrid" ${answers.focusArea === "hybrid" ? "selected" : ""}>Hybrid (both)</option>
          </select>
        </label>
        <div class="field-group">Goals (pick as many as apply)
          <div class="checkbox-list">
            ${GOAL_OPTIONS.map((g) => `
              <label class="checkbox-row">
                <input type="checkbox" name="goals" value="${g.key}" ${answers.goals.includes(g.key) ? "checked" : ""} />
                ${g.label}
              </label>
            `).join("")}
          </div>
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn-secondary" id="backBtn">← Back</button>
          <button type="submit" class="btn-primary">Calibrate &amp; start training</button>
        </div>
      </form>
    `;
    body.querySelector("#backBtn").addEventListener("click", () => { step = 0; renderStep(); });
    body.querySelector("#stepForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const checkedGoals = Array.from(f.querySelectorAll('input[name="goals"]:checked')).map((c) => c.value);
      Object.assign(answers, {
        bodyType: f.bodyType.value, activityLevel: f.activityLevel.value, sleepHours: f.sleepHours.value,
        waterCupsPerDay: f.waterCupsPerDay.value, eatingPattern: f.eatingPattern.value,
        daysPerWeek: f.daysPerWeek.value, minutesPerSession: f.minutesPerSession.value,
        programLengthWeeks: f.programLengthWeeks.value,
        focusArea: f.focusArea.value, goals: checkedGoals.length ? checkedGoals : ["general_fitness"],
      });
      await finishOnboarding(answers);
    });
  }

  renderStep();
}

async function finishOnboarding(answers) {
  const pushups = Number(answers.pushups);
  const situps = Number(answers.situps);
  const plank = Number(answers.plank);
  const runParts = answers.runTime.split(":").map(Number);
  const runSeconds = (runParts[0] || 0) * 60 + (runParts[1] || 0);
  const gender = answers.gender;

  let tier = "beginner";
  if (pushups >= 40 && situps >= 45 && plank >= 90) tier = "advanced";
  else if (pushups >= 20 && situps >= 25 && plank >= 45) tier = "intermediate";

  const profile = Auth.currentProfile;
  profile.onboarded = true;
  profile.gender = gender;
  profile.fitnessTier = tier;
  profile.initialAssessment = { pushups, situps, plank, runSeconds, date: fmtDate() };
  profile.bio = {
    age: Number(answers.age) || null,
    bodyType: answers.bodyType,
    activityLevel: answers.activityLevel,
    sleepHours: Number(answers.sleepHours) || null,
    waterCupsPerDay: Number(answers.waterCupsPerDay) || null,
    eatingPattern: answers.eatingPattern,
    daysPerWeek: Number(answers.daysPerWeek) || 3,
    minutesPerSession: Number(answers.minutesPerSession) || 40,
    programLengthWeeks: Number(answers.programLengthWeeks) || 8,
    focusArea: answers.focusArea,
    goals: answers.goals && answers.goals.length ? answers.goals : ["general_fitness"],
    avatar: (profile.bio && profile.bio.avatar) || null,
  };
  await DB.put("profiles", profile);

  await DB.put("ptTestResults", {
    id: "ptresult_" + uuidv4(),
    profileId: profile.id,
    date: fmtDate(),
    testType: "baseline",
    raw: { pushups, situps, plank, runSeconds },
    note: "Initial onboarding assessment",
  });

  const curated = await generateCuratedProgram(profile);
  await generateStandardPresets(profile.id, tier);
  toast(`Calibrated as ${tier} (${curated.intensityLabel} intensity). Your personalized plan is ready.`);
  location.hash = "#/home";
}

// Builds ONE tailored program from the full onboarding questionnaire -
// this becomes the user's default/featured plan, but remains fully
// editable afterward via the routine builder like any other program.

// Per-goal training effects, averaged together when multiple goals are picked.
const GOAL_EFFECTS = {
  general_fitness: { repBase: 12, setBonus: 0 },
  strength: { repBase: 6, setBonus: 1 },
  fat_loss: { repBase: 16, setBonus: 0 },
  muscle_gain: { repBase: 10, setBonus: 1 },
  endurance: { repBase: 18, setBonus: 0 },
  pt_test_prep: { repBase: 20, setBonus: 0, forceMilitary: true },
};

// Short sessions + a short overall program length both push toward higher
// intensity (harder effort, less rest, tighter time budget); long sessions
// spread over a longer program length point toward a moderate, sustainable
// pace instead. Each factor is scored 0 (low intensity) to 1 (high intensity)
// and then combined.
function computeIntensityProfile(bio) {
  const minutes = Number(bio.minutesPerSession) || 40;
  const weeks = Number(bio.programLengthWeeks) || 8;

  const minuteScore = minutes <= 20 ? 1 : minutes <= 40 ? 0.7 : minutes <= 60 ? 0.4 : 0.15;
  const weekScore = weeks <= 4 ? 1 : weeks <= 8 ? 0.7 : weeks <= 12 ? 0.4 : 0.15;
  const combined = (minuteScore + weekScore) / 2;

  let label = "moderate";
  if (combined >= 0.75) label = "high";
  else if (combined <= 0.35) label = "low-moderate";

  return {
    label,
    restSeconds: label === "high" ? 10 : label === "low-moderate" ? 20 : 15,
    setMultiplier: label === "high" ? 1.15 : label === "low-moderate" ? 0.9 : 1.0,
    repMultiplier: label === "high" ? 1.1 : label === "low-moderate" ? 0.9 : 1.0,
  };
}

async function generateCuratedProgram(profile) {
  const bio = profile.bio || {};
  const tier = profile.fitnessTier || "beginner";
  const baseMultiplier = { beginner: 0.6, intermediate: 1.0, advanced: 1.5 }[tier];

  // Lifestyle-based volume adjustment, grounded in general ACSM-style guidance:
  // sedentary lifestyles and poor sleep both warrant a gentler initial ramp,
  // and beginners should see 48h between sessions hitting the same muscles.
  let lifestyleFactor = 1.0;
  if (bio.activityLevel === "sedentary") lifestyleFactor *= 0.85;
  if (bio.activityLevel === "light") lifestyleFactor *= 0.93;
  if (bio.sleepHours && bio.sleepHours < 6) lifestyleFactor *= 0.9;
  if (bio.age && bio.age >= 45) lifestyleFactor *= 0.9;

  const intensity = computeIntensityProfile(bio);
  const mult = baseMultiplier * lifestyleFactor * intensity.repMultiplier;
  const roundRep = (n) => Math.max(3, Math.round(n * mult));
  const roundSec = (n) => Math.max(15, Math.round((n * mult) / 5) * 5);

  const dayCount = Math.max(2, Math.min(5, Number(bio.daysPerWeek) || 3));
  const focus = bio.focusArea || "hybrid";
  const goals = (bio.goals && bio.goals.length ? bio.goals : ["general_fitness"]);
  const goalEffects = goals.map((g) => GOAL_EFFECTS[g] || GOAL_EFFECTS.general_fitness);
  const repBaseForGoal = goalEffects.reduce((sum, g) => sum + g.repBase, 0) / goalEffects.length;
  const avgSetBonus = goalEffects.reduce((sum, g) => sum + g.setBonus, 0) / goalEffects.length;
  const wantsMilitary = goalEffects.some((g) => g.forceMilitary);

  // Exercise pools tagged loosely by movement pattern, drawn from the seed library.
  const pools = {
    push: ["ex_pushup", "ex_diamond_pushup", "ex_pike_pushup", "ex_dips", "ex_hand_release_pushup"],
    pull: ["ex_pullup", "ex_chinup", "ex_inverted_row"],
    legs: ["ex_squat", "ex_lunge", "ex_pistol_squat", "ex_glute_bridge"],
    core: ["ex_plank", "ex_situp", "ex_hanging_leg_raise", "ex_mountain_climber", "ex_plank_acft"],
    military: ["ex_ruck_march", "ex_buddy_carry", "ex_bear_crawl", "ex_sprint_drag_carry", "ex_formation_run"],
    cardio: ["ex_two_mile_run", "ex_formation_run"],
  };
  const pick = (poolKey, n) => pools[poolKey].slice(0, n);

  // Choose a day template shape based on how many days/week are available.
  let dayShapes;
  if (dayCount <= 2) {
    dayShapes = [
      { label: "Full Body A", groups: ["push", "legs", "core"] },
      { label: "Full Body B", groups: ["pull", "legs", "cardio"] },
    ];
  } else if (dayCount === 3) {
    dayShapes = [
      { label: "Push", groups: ["push", "core"] },
      { label: "Pull", groups: ["pull", "core"] },
      { label: "Legs & Conditioning", groups: ["legs", "cardio"] },
    ];
  } else if (dayCount === 4) {
    dayShapes = [
      { label: "Push", groups: ["push"] },
      { label: "Pull", groups: ["pull"] },
      { label: "Legs", groups: ["legs"] },
      { label: "Conditioning & Core", groups: ["cardio", "core"] },
    ];
  } else {
    dayShapes = [
      { label: "Push", groups: ["push"] },
      { label: "Pull", groups: ["pull"] },
      { label: "Legs", groups: ["legs"] },
      { label: "Core", groups: ["core"] },
      { label: "Conditioning", groups: ["cardio"] },
    ];
  }

  // Weave in military-specific drills when the user asked for military/hybrid
  // focus, OR when APFT/ACFT prep was one of the selected goals.
  if (focus === "military" || focus === "hybrid" || wantsMilitary) {
    dayShapes[dayShapes.length - 1].groups.push("military");
  }

  const setsForGoal = Math.max(2, Math.round((3 + avgSetBonus) * intensity.setMultiplier));

  const days = dayShapes.map((shape, i) => {
    const exercises = [];
    shape.groups.forEach((groupKey) => {
      const ids = pick(groupKey, groupKey === "military" || groupKey === "cardio" ? 1 : 2);
      ids.forEach((exId) => {
        const ex = SEED_EXERCISES.find((e) => e.id === exId);
        if (!ex) return;
        const entry = { exerciseId: exId, sets: setsForGoal, restSeconds: intensity.restSeconds };
        if (ex.type === "time") entry.targetSeconds = roundSec(45);
        else if (ex.type === "distance") entry.targetDistance = groupKey === "military" ? 2 : 0.25;
        else entry.targetReps = roundRep(repBaseForGoal);
        exercises.push(entry);
      });
    });
    return { name: `Day ${i + 1} - ${shape.label}`, exercises };
  });

  // If the user told us how much time they have per session, auto-distribute
  // that time across each day's sets as a pacing suggestion (still editable).
  const minutesPerSession = Number(bio.minutesPerSession);
  if (minutesPerSession && minutesPerSession > 0) {
    days.forEach((day) => {
      day.targetTotalSeconds = minutesPerSession * 60;
      distributeDayTime(day, day.targetTotalSeconds);
    });
  }

  const programLengthWeeks = Number(bio.programLengthWeeks) || null;
  const categoryLabel = focus === "military" ? "military" : focus === "calisthenics" ? "calisthenics" : "hybrid";
  const program = {
    id: "program_" + uuidv4(),
    profileId: profile.id,
    name: "Your Personalized Plan",
    category: categoryLabel,
    builtin: true,
    isDefault: true,
    intensityLabel: intensity.label,
    programLengthWeeks,
    days,
  };
  await DB.put("programs", program);
  return program;
}

async function generateStandardPresets(profileId, tier) {
  const multiplier = { beginner: 0.6, intermediate: 1.0, advanced: 1.5 }[tier];
  const roundRep = (n) => Math.max(3, Math.round(n * multiplier));

  const calisthenicsProgram = {
    id: "program_" + uuidv4(),
    profileId,
    name: `Calisthenics Foundations (${tier})`,
    category: "calisthenics",
    builtin: true,
    days: [
      { name: "Day 1 - Push", exercises: [
        { exerciseId: "ex_pushup", targetReps: roundRep(15), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_pike_pushup", targetReps: roundRep(8), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_dips", targetReps: roundRep(8), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_plank", targetSeconds: roundRep(40), sets: 3, restSeconds: 45 },
      ]},
      { name: "Day 2 - Pull", exercises: [
        { exerciseId: "ex_pullup", targetReps: roundRep(6), sets: 3, restSeconds: 90 },
        { exerciseId: "ex_inverted_row", targetReps: roundRep(10), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_hanging_leg_raise", targetReps: roundRep(8), sets: 3, restSeconds: 60 },
      ]},
      { name: "Day 3 - Legs", exercises: [
        { exerciseId: "ex_squat", targetReps: roundRep(20), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_lunge", targetReps: roundRep(12), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_glute_bridge", targetReps: roundRep(15), sets: 3, restSeconds: 45 },
      ]},
    ],
  };

  const militaryProgram = {
    id: "program_" + uuidv4(),
    profileId,
    name: `Military PT Prep (${tier})`,
    category: "military",
    builtin: true,
    days: [
      { name: "Day 1 - APFT Focus", exercises: [
        { exerciseId: "ex_pushup", targetReps: roundRep(30), sets: 2, restSeconds: 60 },
        { exerciseId: "ex_situp", targetReps: roundRep(30), sets: 2, restSeconds: 60 },
        { exerciseId: "ex_two_mile_run", targetSeconds: 900, sets: 1, restSeconds: 0 },
      ]},
      { name: "Day 2 - ACFT Focus", exercises: [
        { exerciseId: "ex_hand_release_pushup", targetReps: roundRep(15), sets: 3, restSeconds: 60 },
        { exerciseId: "ex_plank_acft", targetSeconds: roundRep(60), sets: 2, restSeconds: 45 },
        { exerciseId: "ex_sprint_drag_carry", targetSeconds: 180, sets: 1, restSeconds: 0 },
      ]},
      { name: "Day 3 - Ruck", exercises: [
        { exerciseId: "ex_ruck_march", targetDistance: 4, sets: 1, restSeconds: 0 },
        { exerciseId: "ex_bear_crawl", targetDistance: 20, sets: 3, restSeconds: 60 },
      ]},
    ],
  };

  await DB.put("programs", calisthenicsProgram);
  await DB.put("programs", militaryProgram);
}

// --------------------------- HOME DASHBOARD ---------------------------------

async function screenHome(root) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"><div class="loading">Loading…</div></div>`);
  root.appendChild(renderShell("home", content));

  const [sessions, weightLogs, settings] = await Promise.all([
    DB.getAllByProfile("sessions", profile.id),
    DB.getAllByProfile("weightLogs", profile.id),
    Auth.getSettings(),
  ]);

  const today = fmtDate();
  const todaysMeals = (await DB.getAllByProfile("mealLogs", profile.id)).filter((m) => m.date === today);
  const caloriesToday = todaysMeals.reduce((s, m) => s + (m.calories || 0), 0);
  const recentSessions = sessions.filter((s) => s.status === "complete").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const lastWeight = weightLogs.sort((a, b) => b.date.localeCompare(a.date))[0];

  content.innerHTML = `
    <h1>Welcome back, ${escapeHtml(profile.username)}</h1>
    <p class="muted">Fitness tier: <strong>${profile.fitnessTier || "unrated"}</strong></p>

    <div class="card-grid">
      <div class="card">
        <h3>Today's Fuel</h3>
        <p class="big-stat">${caloriesToday} <span class="muted">/ ${settings.dailyCalorieTarget} kcal</span></p>
        <a href="#/nutrition" class="btn-secondary small">Log a meal</a>
      </div>
      <div class="card">
        <h3>Latest Weight</h3>
        <p class="big-stat">${lastWeight ? lastWeight.weight + " " + (lastWeight.unit || "lb") : "—"}</p>
        <a href="#/progress" class="btn-secondary small">Log weight</a>
      </div>
      <div class="card">
        <h3>Start Training</h3>
        <p class="muted">Jump into a program or build your own.</p>
        <a href="#/workouts" class="btn-primary small">Go to Train</a>
      </div>
    </div>

    <h2>Recent Sessions</h2>
    <div class="list">
      ${recentSessions.length === 0 ? `<p class="muted">No completed sessions yet.</p>` :
        recentSessions.map((s) => `<div class="list-row"><span>${escapeHtml(s.programName || "Custom session")}</span><span class="muted">${s.date}</span></div>`).join("")}
    </div>
  `;
}
