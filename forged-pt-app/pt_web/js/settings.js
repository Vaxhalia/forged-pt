// ---------------------------------------------------------------------------
// Settings: theme/accessibility, PIN lock, reminders, backup/restore, profiles.
// ---------------------------------------------------------------------------

async function screenSettings(root) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("settings", content));
  const settings = await Auth.getSettings();

  content.innerHTML = `
    <h1>Settings</h1>

    <h2>Appearance</h2>
    <div class="settings-group">
      <label>Theme
        <select id="themeSelect">
          <option value="calisthenics" ${profile.theme !== "military" ? "selected" : ""}>Calisthenics (primary)</option>
          <option value="military" ${profile.theme === "military" ? "selected" : ""}>Military</option>
        </select>
      </label>
      <label>Color mode
        <select id="schemeSelect">
          <option value="system" ${(!profile.colorScheme || profile.colorScheme === "system") ? "selected" : ""}>System</option>
          <option value="light" ${profile.colorScheme === "light" ? "selected" : ""}>Light</option>
          <option value="dark" ${profile.colorScheme === "dark" ? "selected" : ""}>Dark</option>
        </select>
      </label>
      <label>Text size: <span id="scaleLabel">${Math.round((profile.textScale || 1) * 100)}%</span>
        <input id="scaleRange" type="range" min="0.85" max="1.4" step="0.05" value="${profile.textScale || 1}" />
      </label>
    </div>

    <h2>Branding</h2>
    <div class="settings-group">
      <label>App name
        <input id="appNameInput" value="${escapeHtml(profile.customAppName || "")}" placeholder="FORGED PT" />
      </label>
      <div class="color-swatch-row">
        <label>Primary color <input id="accentColorInput" type="color" value="${profile.accentColor || "#ff6b35"}" /></label>
        <label>Secondary color <input id="accentColor2Input" type="color" value="${profile.accentColor2 || "#2ec4b6"}" /></label>
      </div>
      <button id="resetBrandingBtn" class="btn-secondary small">Reset to theme defaults</button>
    </div>

    <h2>Background</h2>
    <div class="settings-group">
      <p class="muted">${profile.customBackground ? "A custom background image is active." : "Using the default theme background."}</p>
      <div class="row-buttons">
        <label class="file-label btn-secondary small">📷 Upload background image
          <input id="bgUpload" type="file" accept="image/*" />
        </label>
        ${profile.customBackground ? `<button id="removeBgBtn" class="btn-danger small">Remove background image</button>` : ""}
      </div>
      ${profile.customBackground ? `
        <label>Background blur: <span id="blurLabel">${profile.backgroundBlur ?? 60}%</span>
          <input id="blurRange" type="range" min="0" max="100" step="5" value="${profile.backgroundBlur ?? 60}" />
        </label>
      ` : ""}
      <p class="finePrint">Large images may not persist if this browser is running in the small localStorage fallback mode (see Settings notice, or README). Photos under a few MB are safest.</p>
    </div>

    <h2>Security</h2>
    <div class="settings-group">
      <p class="muted">${profile.pinHash ? "PIN lock is enabled." : "No PIN set — app unlocks immediately after login."}</p>
      <div class="row-buttons">
        <button id="setPinBtn" class="btn-secondary small">${profile.pinHash ? "Change PIN" : "Enable PIN lock"}</button>
        ${profile.pinHash ? `<button id="removePinBtn" class="btn-danger small">Disable PIN lock</button>` : ""}
      </div>
    </div>

    <h2>Reminders</h2>
    <div class="settings-group">
      <label><input type="checkbox" id="workoutReminder" ${settings.workoutReminders ? "checked" : ""} /> Workout reminders</label>
      <label><input type="checkbox" id="mealReminder" ${settings.mealReminders ? "checked" : ""} /> Meal logging reminders</label>
      <p class="finePrint">Browser notifications fire while the app is open/installed; grant permission when prompted.</p>
      <button id="enableNotifs" class="btn-secondary small">Enable browser notifications</button>
    </div>

    <h2>Backup</h2>
    <div class="settings-group">
      <p class="muted">Export everything (all profiles, all data) to a single file you can move between your PC and phone.</p>
      <button id="exportBtn" class="btn-primary small">Export backup file</button>
      <label class="file-label btn-secondary small">Import backup file
        <input id="importFile" type="file" accept="application/json" />
      </label>
    </div>

    <h2>Account</h2>
    <div class="settings-group">
      <button id="viewProfileBtn" class="btn-secondary small">👤 View / Edit Profile</button>
      <button id="switchProfileBtn" class="btn-secondary small">Switch profile</button>
      <button id="logoutBtn" class="btn-secondary small">Log out</button>
    </div>

    <h2>Danger Zone</h2>
    <div class="settings-group danger-zone">
      <div>
        <strong>Reset all training data</strong>
        <p class="muted">Wipes workouts, nutrition logs, progress, and custom programs/exercises/foods. Keeps your username and password, and sends you back through onboarding.</p>
        <button id="resetDataBtn" class="btn-danger small">Reset data</button>
      </div>
      <hr/>
      <div>
        <strong>Delete this account</strong>
        <p class="muted">Permanently deletes this profile and all of its data from this device. Cannot be undone.</p>
        <button id="deleteAccountBtn" class="btn-danger small">Delete account</button>
      </div>
    </div>
  `;

  content.querySelector("#themeSelect").addEventListener("change", async (e) => {
    profile.theme = e.target.value;
    await DB.put("profiles", profile);
    applyProfileTheme();
  });
  content.querySelector("#schemeSelect").addEventListener("change", async (e) => {
    profile.colorScheme = e.target.value;
    await DB.put("profiles", profile);
    applyProfileTheme();
  });
  content.querySelector("#scaleRange").addEventListener("input", async (e) => {
    profile.textScale = Number(e.target.value);
    content.querySelector("#scaleLabel").textContent = Math.round(profile.textScale * 100) + "%";
    await DB.put("profiles", profile);
    applyProfileTheme();
  });

  content.querySelector("#setPinBtn").addEventListener("click", () => {
    const dlg = el(`
      <div class="modal-backdrop">
        <div class="modal">
          <h3>${profile.pinHash ? "Change PIN" : "Set PIN"}</h3>
          <form id="pinSetForm" class="form">
            <input name="pin" type="password" inputmode="numeric" minlength="4" placeholder="New PIN (4+ digits)" required />
            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="cancelPinSet">Cancel</button>
              <button type="submit" class="btn-primary">Save</button>
            </div>
          </form>
        </div>
      </div>
    `);
    dlg.querySelector("#cancelPinSet").addEventListener("click", () => dlg.remove());
    dlg.querySelector("#pinSetForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      await Auth.setPin(e.target.pin.value);
      dlg.remove();
      toast("PIN saved.");
      router();
    });
    document.body.appendChild(dlg);
  });

  content.querySelector("#workoutReminder").addEventListener("change", async (e) => {
    await Auth.updateSettings({ workoutReminders: e.target.checked });
  });
  content.querySelector("#mealReminder").addEventListener("change", async (e) => {
    await Auth.updateSettings({ mealReminders: e.target.checked });
  });
  content.querySelector("#enableNotifs").addEventListener("click", async () => {
    if (!("Notification" in window)) return toast("Notifications aren't supported in this browser.", true);
    if (isIOS() && !isStandalonePWA()) {
      toast("On iPhone, notifications only work after you Add to Home Screen and open the app from there (a Safari limitation).", true);
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      toast("Notifications enabled.");
      scheduleReminders(settings);
    } else {
      toast("Permission not granted.", true);
    }
  });

  content.querySelector("#exportBtn").addEventListener("click", async () => {
    const dump = await DB.exportAll();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `forged-pt-backup-${fmtDate()}.json`;
    a.click();
    toast("Backup downloaded.");
  });

  content.querySelector("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const dump = JSON.parse(text);
      if (!confirm("This will replace ALL current data on this device with the backup file. Continue?")) return;
      await DB.importAll(dump);
      toast("Backup restored. Reloading…");
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      toast("Invalid backup file: " + err.message, true);
    }
  });

  content.querySelector("#appNameInput").addEventListener("change", async (e) => {
    profile.customAppName = e.target.value.trim() || null;
    await DB.put("profiles", profile);
    applyProfileTheme();
    router();
  });
  content.querySelector("#accentColorInput").addEventListener("change", async (e) => {
    profile.accentColor = e.target.value;
    await DB.put("profiles", profile);
    applyProfileTheme();
  });
  content.querySelector("#accentColor2Input").addEventListener("change", async (e) => {
    profile.accentColor2 = e.target.value;
    await DB.put("profiles", profile);
    applyProfileTheme();
  });
  content.querySelector("#resetBrandingBtn").addEventListener("click", async () => {
    profile.customAppName = null;
    profile.accentColor = null;
    profile.accentColor2 = null;
    await DB.put("profiles", profile);
    applyProfileTheme();
    toast("Branding reset to defaults.");
    router();
  });

  const blurRange = content.querySelector("#blurRange");
  if (blurRange) {
    blurRange.addEventListener("input", async (e) => {
      profile.backgroundBlur = Number(e.target.value);
      content.querySelector("#blurLabel").textContent = profile.backgroundBlur + "%";
      applyProfileTheme();
    });
    blurRange.addEventListener("change", async () => {
      await DB.put("profiles", profile);
    });
  }

  content.querySelector("#viewProfileBtn").addEventListener("click", () => {
    location.hash = "#/profile";
  });

  content.querySelector("#bgUpload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      profile.customBackground = await fileToDataUrl(file);
      await DB.put("profiles", profile);
      applyProfileTheme();
      toast("Background updated.");
      router();
    } catch (err) {
      toast("Couldn't save that image: " + err.message, true);
    }
  });
  const removeBgBtn = content.querySelector("#removeBgBtn");
  if (removeBgBtn) {
    removeBgBtn.addEventListener("click", async () => {
      profile.customBackground = null;
      await DB.put("profiles", profile);
      applyProfileTheme();
      toast("Background removed.");
      router();
    });
  }

  const removePinBtn = content.querySelector("#removePinBtn");
  if (removePinBtn) {
    removePinBtn.addEventListener("click", async () => {
      if (!confirm("Disable PIN lock? You'll be able to open the app without a PIN next time.")) return;
      await Auth.removePin();
      toast("PIN lock disabled.");
      router();
    });
  }

  content.querySelector("#resetDataBtn").addEventListener("click", async () => {
    if (!confirm("This wipes ALL workouts, nutrition logs, progress, and custom programs/exercises/foods for this account. Your username and password are kept. This can't be undone. Continue?")) return;
    await Auth.resetProfileData();
    toast("Data reset. Redirecting to onboarding…");
    location.hash = "#/onboarding";
  });

  content.querySelector("#deleteAccountBtn").addEventListener("click", async () => {
    if (!confirm(`Permanently delete the account "${profile.username}" and all of its data from this device? This can't be undone.`)) return;
    if (!confirm("Are you absolutely sure? This is the final confirmation.")) return;
    await Auth.deleteAccount();
    toast("Account deleted.");
    location.hash = "#/login";
  });

  content.querySelector("#switchProfileBtn").addEventListener("click", () => {
    Auth.logout();
    location.hash = "#/login";
  });
  content.querySelector("#logoutBtn").addEventListener("click", () => {
    Auth.logout();
    location.hash = "#/login";
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Offline install just won't be available over file:// or non-secure origins; app still works.
    });
  }
}

function scheduleReminders(settings) {
  // Best-effort in-page reminders (fires only while the app/tab is open).
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (settings.workoutReminders) {
    checkAndNotifyAt(settings.reminderTimes?.workout || "17:00", "Workout time", "Your training session is scheduled now.");
  }
  if (settings.mealReminders) {
    (settings.reminderTimes?.meals || []).forEach((t) => checkAndNotifyAt(t, "Meal check-in", "Don't forget to log your meal."));
  }
}

function checkAndNotifyAt(timeStr, title, body) {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  let delay = target - now;
  if (delay < 0) delay += 24 * 60 * 60 * 1000;
  setTimeout(() => {
    new Notification(title, { body });
    checkAndNotifyAt(timeStr, title, body); // reschedule for next day, while tab stays open
  }, delay);
}
