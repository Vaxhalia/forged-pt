// ---------------------------------------------------------------------------
// Profile: avatar, username, and biodata collected at onboarding (editable).
// ---------------------------------------------------------------------------

const BIO_LABELS = {
  bodyType: { ectomorph: "Ectomorph", mesomorph: "Mesomorph", endomorph: "Endomorph", unsure: "Not sure" },
  activityLevel: { sedentary: "Sedentary", light: "Lightly active", moderate: "Moderately active", active: "Very active" },
  eatingPattern: { irregular: "Irregular", balanced: "Balanced", high_protein: "High-protein", calorie_restricted: "Calorie-restricted", bulking: "Bulking" },
  focusArea: { calisthenics: "Calisthenics", military: "Military PT", hybrid: "Hybrid" },
};

async function screenProfile(root) {
  const profile = Auth.currentProfile;
  const bio = profile.bio || {};
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("settings", content));

  content.innerHTML = `
    <div class="screen-header">
      <a href="#/settings" class="btn-link">← Back</a>
      <h1>Profile</h1>
    </div>

    <div class="avatar-row">
      <img id="avatarPreview" class="avatar-lg" src="${bio.avatar || ""}" style="${bio.avatar ? "" : "display:none"}" />
      <div id="avatarPlaceholder" style="${bio.avatar ? "display:none" : ""}" class="avatar-lg" ></div>
      <div>
        <div class="row-buttons">
          <label class="file-label btn-secondary small">📷 ${bio.avatar ? "Change" : "Upload"} photo
            <input id="avatarUpload" type="file" accept="image/*" />
          </label>
          ${bio.avatar ? `<button id="removeAvatarBtn" class="btn-danger small">Remove</button>` : ""}
        </div>
        <h2 style="margin-top:8px">${escapeHtml(profile.username)}</h2>
        <p class="muted">Fitness tier: <strong>${profile.fitnessTier || "unrated"}</strong></p>
      </div>
    </div>

    ${profile.initialAssessment ? `
      <h2>Latest Assessment</h2>
      <div class="bio-stat-grid">
        <div class="bio-stat"><div class="label">Push-ups</div><div class="value">${profile.initialAssessment.pushups}</div></div>
        <div class="bio-stat"><div class="label">Sit-ups</div><div class="value">${profile.initialAssessment.situps}</div></div>
        <div class="bio-stat"><div class="label">Plank</div><div class="value">${profile.initialAssessment.plank}s</div></div>
        <div class="bio-stat"><div class="label">Run time</div><div class="value">${formatMMSS(profile.initialAssessment.runSeconds)}</div></div>
      </div>
      <button id="retestBtn" class="btn-secondary small">Retake assessment</button>
    ` : ""}

    <h2>Biodata</h2>
    <form id="bioForm" class="form">
      <label>Age
        <input name="age" type="number" min="14" max="90" value="${bio.age || ""}" />
      </label>
      <label>Body type
        <select name="bodyType">
          ${Object.entries(BIO_LABELS.bodyType).map(([k, v]) => `<option value="${k}" ${bio.bodyType === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </label>
      <label>Activity level
        <select name="activityLevel">
          ${Object.entries(BIO_LABELS.activityLevel).map(([k, v]) => `<option value="${k}" ${bio.activityLevel === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </label>
      <label>Average sleep (hours/night)
        <input name="sleepHours" type="number" min="3" max="12" step="0.5" value="${bio.sleepHours || ""}" />
      </label>
      <label>Water intake (cups/day)
        <input name="waterCupsPerDay" type="number" min="0" max="30" value="${bio.waterCupsPerDay || ""}" />
      </label>
      <label>Eating pattern
        <select name="eatingPattern">
          ${Object.entries(BIO_LABELS.eatingPattern).map(([k, v]) => `<option value="${k}" ${bio.eatingPattern === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </label>
      <label>Days per week available to train
        <input name="daysPerWeek" type="number" min="2" max="6" value="${bio.daysPerWeek || ""}" />
      </label>
      <label>Minutes available per session
        <input name="minutesPerSession" type="number" min="10" max="120" value="${bio.minutesPerSession || ""}" />
      </label>
      <label>Program length (weeks)
        <input name="programLengthWeeks" type="number" min="1" max="52" value="${bio.programLengthWeeks || ""}" />
      </label>
      <label>Training focus
        <select name="focusArea">
          ${Object.entries(BIO_LABELS.focusArea).map(([k, v]) => `<option value="${k}" ${bio.focusArea === k ? "selected" : ""}>${v}</option>`).join("")}
        </select>
      </label>
      <div class="field-group">Goals (pick as many as apply)
        <div class="checkbox-list">
          ${GOAL_OPTIONS.map((g) => `
            <label class="checkbox-row">
              <input type="checkbox" name="goals" value="${g.key}" ${(bio.goals || []).includes(g.key) ? "checked" : ""} />
              ${g.label}
            </label>
          `).join("")}
        </div>
      </div>
      <button type="submit" class="btn-primary">Save biodata</button>
    </form>
    <p class="finePrint">Changing your availability or focus here doesn't automatically rebuild your plan — visit Train → your program → Edit to adjust it, or retake the assessment for a fresh personalized plan.</p>
  `;

  content.querySelector("#avatarUpload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      profile.bio = profile.bio || {};
      profile.bio.avatar = dataUrl;
      await DB.put("profiles", profile);
      toast("Photo updated.");
      router();
    } catch (err) {
      toast("Couldn't save that image: " + err.message, true);
    }
  });
  const removeAvatarBtn = content.querySelector("#removeAvatarBtn");
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener("click", async () => {
      profile.bio = profile.bio || {};
      profile.bio.avatar = null;
      await DB.put("profiles", profile);
      toast("Photo removed.");
      router();
    });
  }

  const retestBtn = content.querySelector("#retestBtn");
  if (retestBtn) {
    retestBtn.addEventListener("click", () => {
      location.hash = "#/onboarding";
    });
  }

  content.querySelector("#bioForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const checkedGoals = Array.from(f.querySelectorAll('input[name="goals"]:checked')).map((c) => c.value);
    profile.bio = {
      ...profile.bio,
      age: Number(f.age.value) || null,
      bodyType: f.bodyType.value,
      activityLevel: f.activityLevel.value,
      sleepHours: Number(f.sleepHours.value) || null,
      waterCupsPerDay: Number(f.waterCupsPerDay.value) || null,
      eatingPattern: f.eatingPattern.value,
      daysPerWeek: Number(f.daysPerWeek.value) || null,
      minutesPerSession: Number(f.minutesPerSession.value) || null,
      programLengthWeeks: Number(f.programLengthWeeks.value) || null,
      focusArea: f.focusArea.value,
      goals: checkedGoals.length ? checkedGoals : ["general_fitness"],
    };
    await DB.put("profiles", profile);
    toast("Biodata saved.");
    router();
  });
}
