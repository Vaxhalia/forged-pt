// ---------------------------------------------------------------------------
// Nutrition: macro/calorie tracking, meal photo logging, military meal plans.
// ---------------------------------------------------------------------------

async function screenNutrition(root) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("nutrition", content));

  const settings = await Auth.getSettings();
  const foods = [...(await DB.getAll("foods"))];
  const today = fmtDate();
  let mealLogs = (await DB.getAllByProfile("mealLogs", profile.id)).filter((m) => m.date === today);

  content.innerHTML = `
    <h1>Fuel</h1>
    <div class="macro-summary" id="macroSummary"></div>
    <div class="row-buttons">
      <button id="logMealBtn" class="btn-primary small">+ Log food</button>
      <button id="logPhotoBtn" class="btn-secondary small">📷 Log meal photo</button>
      <a href="#" id="plansLink" class="btn-secondary small">Meal Plans</a>
      <a href="#" id="targetsLink" class="btn-secondary small">Set Targets</a>
    </div>
    <h2>Today's Log</h2>
    <div class="list" id="mealList"></div>
  `;

  function renderSummary() {
    const totals = mealLogs.reduce((acc, m) => {
      acc.calories += m.calories || 0;
      acc.protein += m.protein || 0;
      acc.carbs += m.carbs || 0;
      acc.fat += m.fat || 0;
      return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    content.querySelector("#macroSummary").innerHTML = `
      ${macroBar("Calories", totals.calories, settings.dailyCalorieTarget, "kcal")}
      ${macroBar("Protein", totals.protein, settings.proteinTarget, "g")}
      ${macroBar("Carbs", totals.carbs, settings.carbTarget, "g")}
      ${macroBar("Fat", totals.fat, settings.fatTarget, "g")}
    `;
  }

  function macroBar(label, value, target, unit) {
    const pct = Math.min(100, Math.round((value / (target || 1)) * 100));
    return `
      <div class="macro-row">
        <div class="macro-label"><span>${label}</span><span>${Math.round(value)} / ${target} ${unit}</span></div>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  function renderMealList() {
    const listEl = content.querySelector("#mealList");
    listEl.innerHTML = mealLogs.length === 0 ? `<p class="muted">No entries yet today.</p>` :
      mealLogs.map((m) => `
        <div class="list-row">
          <div>
            ${m.photo ? `<img src="${m.photo}" class="meal-thumb" />` : ""}
            <strong>${escapeHtml(m.foodName)}</strong>
            <div class="muted">${m.calories} kcal · P${m.protein}g C${m.carbs}g F${m.fat}g</div>
          </div>
          <button class="btn-icon deleteMealBtn" data-id="${m.id}">✕</button>
        </div>
      `).join("");
    listEl.querySelectorAll(".deleteMealBtn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await DB.delete("mealLogs", btn.dataset.id);
        mealLogs = mealLogs.filter((m) => m.id !== btn.dataset.id);
        renderSummary();
        renderMealList();
      });
    });
  }

  content.querySelector("#logMealBtn").addEventListener("click", () => {
    openFoodLogger(foods, async (entry) => {
      mealLogs.push(entry);
      renderSummary();
      renderMealList();
    });
  });

  content.querySelector("#logPhotoBtn").addEventListener("click", () => openPhotoMealLogger(async (entry) => {
    mealLogs.push(entry);
    renderSummary();
    renderMealList();
  }));

  content.querySelector("#plansLink").addEventListener("click", async (e) => {
    e.preventDefault();
    openMealPlansModal();
  });
  content.querySelector("#targetsLink").addEventListener("click", async (e) => {
    e.preventDefault();
    openTargetsModal(settings, () => { renderSummary(); });
  });

  renderSummary();
  renderMealList();
}

function openFoodLogger(foods, onLogged) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Log food</h3>
        <input id="foodSearch" placeholder="Search foods…" />
        <div class="list scrollable" id="foodResults"></div>
        <div id="qtyArea" style="display:none">
          <label>Servings: <input id="servingQty" type="number" min="0.25" step="0.25" value="1" /></label>
          <button id="confirmLog" class="btn-primary">Add to log</button>
        </div>
        <button id="closeFoodLog" class="btn-secondary">Close</button>
        <hr/>
        <details>
          <summary>Add a custom food</summary>
          <form id="customFoodForm" class="form">
            <input name="name" placeholder="Food name" required />
            <input name="calories" type="number" placeholder="Calories" required />
            <input name="protein" type="number" placeholder="Protein (g)" required />
            <input name="carbs" type="number" placeholder="Carbs (g)" required />
            <input name="fat" type="number" placeholder="Fat (g)" required />
            <button type="submit" class="btn-secondary small">Save custom food</button>
          </form>
        </details>
      </div>
    </div>
  `);

  let selected = null;
  const resultsEl = dlg.querySelector("#foodResults");
  function renderResults(q) {
    const matches = foods.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
    resultsEl.innerHTML = matches.map((f) => `
      <div class="list-row food-pick" data-id="${f.id}">
        <div><strong>${escapeHtml(f.name)}</strong><div class="muted">${f.calories} kcal / ${f.servingSize}${f.servingUnit}</div></div>
      </div>
    `).join("");
    resultsEl.querySelectorAll(".food-pick").forEach((row) => {
      row.addEventListener("click", () => {
        selected = foods.find((f) => f.id === row.dataset.id);
        dlg.querySelector("#qtyArea").style.display = "block";
      });
    });
  }
  dlg.querySelector("#foodSearch").addEventListener("input", (e) => renderResults(e.target.value));
  renderResults("");

  dlg.querySelector("#confirmLog").addEventListener("click", async () => {
    if (!selected) return;
    const qty = Number(dlg.querySelector("#servingQty").value) || 1;
    const entry = {
      id: "meallog_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      foodName: `${selected.name} (x${qty})`,
      calories: Math.round(selected.calories * qty),
      protein: Math.round(selected.protein * qty),
      carbs: Math.round(selected.carbs * qty),
      fat: Math.round(selected.fat * qty),
      loggedAt: new Date().toISOString(),
    };
    await DB.put("mealLogs", entry);
    onLogged(entry);
    dlg.remove();
    toast("Logged.");
  });

  dlg.querySelector("#customFoodForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const food = {
      id: "food_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      name: f.name.value,
      servingSize: 1,
      servingUnit: "serving",
      calories: Number(f.calories.value),
      protein: Number(f.protein.value),
      carbs: Number(f.carbs.value),
      fat: Number(f.fat.value),
      builtin: false,
    };
    await DB.put("foods", food);
    foods.push(food);
    renderResults(dlg.querySelector("#foodSearch").value);
    e.target.reset();
    toast("Custom food saved.");
  });

  dlg.querySelector("#closeFoodLog").addEventListener("click", () => dlg.remove());
  document.body.appendChild(dlg);
}

function openPhotoMealLogger(onLogged) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Log meal photo</h3>
        <form id="photoForm" class="form">
          <input name="name" placeholder="Meal description" required />
          <label class="file-label">📷 Photo
            <input name="photo" type="file" accept="image/*" capture="environment" />
          </label>
          <div class="grid2">
            <input name="calories" type="number" placeholder="Est. calories" />
            <input name="protein" type="number" placeholder="Protein (g)" />
            <input name="carbs" type="number" placeholder="Carbs (g)" />
            <input name="fat" type="number" placeholder="Fat (g)" />
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelPhoto">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelPhoto").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#photoForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    let photoData = null;
    if (f.photo.files[0]) photoData = await fileToDataUrl(f.photo.files[0]);
    const entry = {
      id: "meallog_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      foodName: f.name.value,
      photo: photoData,
      calories: Number(f.calories.value) || 0,
      protein: Number(f.protein.value) || 0,
      carbs: Number(f.carbs.value) || 0,
      fat: Number(f.fat.value) || 0,
      loggedAt: new Date().toISOString(),
    };
    await DB.put("mealLogs", entry);
    onLogged(entry);
    dlg.remove();
    toast("Meal photo logged.");
  });
  document.body.appendChild(dlg);
}

async function openMealPlansModal() {
  const plans = (await DB.getAll("mealPlans"));
  const foods = await DB.getAll("foods");
  const foodMap = Object.fromEntries(foods.map((f) => [f.id, f]));
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal wide">
        <h3>Military-style Meal Plans</h3>
        <div class="list scrollable">
          ${plans.map((p) => `
            <div class="plan-card">
              <h4>${escapeHtml(p.name)}</h4>
              <p class="muted">${p.targetCalories} kcal · P${p.targetProtein} C${p.targetCarbs} F${p.targetFat}</p>
              <ul>
                ${p.meals.map((m) => `<li><strong>${escapeHtml(m.name)}:</strong> ${m.items.map((id) => foodMap[id]?.name || id).join(", ")}</li>`).join("")}
              </ul>
              <button class="btn-primary small applyPlanBtn" data-id="${p.id}">Set as today's targets</button>
            </div>
          `).join("")}
        </div>
        <button id="closePlans" class="btn-secondary">Close</button>
      </div>
    </div>
  `);
  dlg.querySelectorAll(".applyPlanBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const plan = plans.find((p) => p.id === btn.dataset.id);
      await Auth.updateSettings({
        dailyCalorieTarget: plan.targetCalories,
        proteinTarget: plan.targetProtein,
        carbTarget: plan.targetCarbs,
        fatTarget: plan.targetFat,
      });
      toast(`Applied "${plan.name}" targets.`);
      dlg.remove();
      router();
    });
  });
  dlg.querySelector("#closePlans").addEventListener("click", () => dlg.remove());
  document.body.appendChild(dlg);
}

function openTargetsModal(settings, onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Daily Targets</h3>
        <form id="targetsForm" class="form">
          <label>Calories <input name="cal" type="number" value="${settings.dailyCalorieTarget}" /></label>
          <label>Protein (g) <input name="protein" type="number" value="${settings.proteinTarget}" /></label>
          <label>Carbs (g) <input name="carbs" type="number" value="${settings.carbTarget}" /></label>
          <label>Fat (g) <input name="fat" type="number" value="${settings.fatTarget}" /></label>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelTargets">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelTargets").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#targetsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const updated = await Auth.updateSettings({
      dailyCalorieTarget: Number(f.cal.value),
      proteinTarget: Number(f.protein.value),
      carbTarget: Number(f.carbs.value),
      fatTarget: Number(f.fat.value),
    });
    Object.assign(settings, updated);
    dlg.remove();
    onSaved();
    toast("Targets updated.");
  });
  document.body.appendChild(dlg);
}
