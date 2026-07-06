// ---------------------------------------------------------------------------
// Progress: weight, measurements, photos, performance metrics, PT test scoring.
// ---------------------------------------------------------------------------

async function screenProgress(root) {
  const profile = Auth.currentProfile;
  const content = el(`<div class="screen"></div>`);
  root.appendChild(renderShell("progress", content));

  const [weightLogs, measurements, photos, ptResults] = await Promise.all([
    DB.getAllByProfile("weightLogs", profile.id),
    DB.getAllByProfile("measurements", profile.id),
    DB.getAllByProfile("progressPhotos", profile.id),
    DB.getAllByProfile("ptTestResults", profile.id),
  ]);
  weightLogs.sort((a, b) => a.date.localeCompare(b.date));

  content.innerHTML = `
    <h1>Progress</h1>
    <div class="row-buttons">
      <button id="logWeightBtn" class="btn-primary small">+ Weight</button>
      <button id="logMeasureBtn" class="btn-secondary small">+ Measurements</button>
      <button id="logPhotoBtn" class="btn-secondary small">📷 Photo</button>
      <button id="logPtBtn" class="btn-secondary small">🎖️ Log PT Test</button>
    </div>

    <h2>Weight Trend</h2>
    <canvas id="weightChart" width="600" height="200" class="chart"></canvas>

    <h2>PT Test History</h2>
    <div class="list" id="ptList"></div>

    <h2>Progress Photos</h2>
    <div class="photo-grid" id="photoGrid"></div>
  `;

  drawLineChart(content.querySelector("#weightChart"), weightLogs.map((w) => ({ x: w.date, y: w.weight })));

  content.querySelector("#ptList").innerHTML = ptResults.length === 0 ? `<p class="muted">No PT tests logged.</p>` :
    ptResults.sort((a, b) => b.date.localeCompare(a.date)).map((r) => `
      <div class="list-row">
        <div>
          <strong>${r.testType.toUpperCase()}</strong>
          <div class="muted">${r.date}${r.score ? ` · Score: ${r.score.total}/${r.score.maxTotal} (${r.score.pass ? "PASS" : "below min"})` : ""}</div>
        </div>
      </div>
    `).join("");

  content.querySelector("#photoGrid").innerHTML = photos.length === 0 ? `<p class="muted">No progress photos yet.</p>` :
    photos.sort((a, b) => b.date.localeCompare(a.date)).map((p) => `
      <div class="photo-cell"><img src="${p.photo}" /><span>${p.date}</span></div>
    `).join("");

  content.querySelector("#logWeightBtn").addEventListener("click", () => openWeightModal(() => router()));
  content.querySelector("#logMeasureBtn").addEventListener("click", () => openMeasurementModal(() => router()));
  content.querySelector("#logPhotoBtn").addEventListener("click", () => openProgressPhotoModal(() => router()));
  content.querySelector("#logPtBtn").addEventListener("click", () => openPtTestModal(() => router()));
}

function openWeightModal(onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Log weight</h3>
        <form id="wForm" class="form">
          <input name="weight" type="number" step="0.1" placeholder="Weight" required />
          <select name="unit"><option value="lb">lb</option><option value="kg">kg</option></select>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelW">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelW").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#wForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    await DB.put("weightLogs", {
      id: "weight_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      weight: Number(f.weight.value),
      unit: f.unit.value,
    });
    dlg.remove();
    onSaved();
  });
  document.body.appendChild(dlg);
}

function openMeasurementModal(onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Log measurements (in/cm)</h3>
        <form id="mForm" class="form grid2">
          <input name="chest" placeholder="Chest" />
          <input name="waist" placeholder="Waist" />
          <input name="hips" placeholder="Hips" />
          <input name="arms" placeholder="Arms" />
          <input name="thighs" placeholder="Thighs" />
          <input name="neck" placeholder="Neck" />
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelM">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelM").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#mForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    await DB.put("measurements", {
      id: "measure_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      chest: f.chest.value, waist: f.waist.value, hips: f.hips.value,
      arms: f.arms.value, thighs: f.thighs.value, neck: f.neck.value,
    });
    dlg.remove();
    onSaved();
  });
  document.body.appendChild(dlg);
}

function openProgressPhotoModal(onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal">
        <h3>Progress photo</h3>
        <form id="pForm" class="form">
          <input name="photo" type="file" accept="image/*" capture="environment" required />
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="cancelP">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);
  dlg.querySelector("#cancelP").addEventListener("click", () => dlg.remove());
  dlg.querySelector("#pForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = e.target.photo.files[0];
    if (!file) return;
    const photoData = await fileToDataUrl(file);
    await DB.put("progressPhotos", {
      id: "photo_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      photo: photoData,
    });
    dlg.remove();
    onSaved();
  });
  document.body.appendChild(dlg);
}

function openPtTestModal(onSaved) {
  const dlg = el(`
    <div class="modal-backdrop">
      <div class="modal wide">
        <h3>Log PT Test</h3>
        <div class="tabs">
          <button class="tab-btn active" data-tab="apft">APFT</button>
          <button class="tab-btn" data-tab="acft">ACFT</button>
        </div>
        <form id="apftForm" class="form pt-tab-content">
          <select name="gender">
            <option value="male" ${Auth.currentProfile.gender === "male" ? "selected" : ""}>Male</option>
            <option value="female" ${Auth.currentProfile.gender === "female" ? "selected" : ""}>Female</option>
          </select>
          <input name="pushups" type="number" placeholder="Push-ups" required />
          <input name="situps" type="number" placeholder="Sit-ups" required />
          <input name="runTime" placeholder="2-mile run (mm:ss)" required />
          <button type="submit" class="btn-primary">Score & save APFT</button>
        </form>
        <form id="acftForm" class="form pt-tab-content" style="display:none">
          <input name="deadlift_lb" type="number" placeholder="3RM Deadlift (lb)" />
          <input name="power_throw_m" type="number" step="0.1" placeholder="Power throw (m)" />
          <input name="hrp_reps" type="number" placeholder="Hand-release push-ups (reps)" />
          <input name="sdc_seconds" type="number" placeholder="Sprint-drag-carry (sec)" />
          <input name="plank_seconds" type="number" placeholder="Plank (sec)" />
          <input name="run_seconds" type="number" placeholder="2-mile run (sec)" />
          <button type="submit" class="btn-primary">Score & save ACFT</button>
        </form>
        <p class="finePrint">Reference scoring only — not an official military record.</p>
        <button id="closePt" class="btn-secondary">Close</button>
      </div>
    </div>
  `);

  dlg.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      dlg.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      dlg.querySelector("#apftForm").style.display = btn.dataset.tab === "apft" ? "flex" : "none";
      dlg.querySelector("#acftForm").style.display = btn.dataset.tab === "acft" ? "flex" : "none";
    });
  });

  dlg.querySelector("#apftForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const runParts = f.runTime.value.split(":").map(Number);
    const runSeconds = (runParts[0] || 0) * 60 + (runParts[1] || 0);
    const score = Scoring.scoreApft({
      gender: f.gender.value,
      pushups: Number(f.pushups.value),
      situps: Number(f.situps.value),
      runSeconds,
    });
    await DB.put("ptTestResults", {
      id: "ptresult_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      testType: "apft",
      raw: { pushups: f.pushups.value, situps: f.situps.value, runSeconds },
      score,
    });
    dlg.remove();
    onSaved();
    toast(`APFT scored: ${score.total}/${score.maxTotal}`);
  });

  dlg.querySelector("#acftForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const raw = {
      deadlift_lb: f.deadlift_lb.value, power_throw_m: f.power_throw_m.value,
      hrp_reps: f.hrp_reps.value, sdc_seconds: f.sdc_seconds.value,
      plank_seconds: f.plank_seconds.value, run_seconds: f.run_seconds.value,
    };
    const score = Scoring.scoreAcft(raw);
    await DB.put("ptTestResults", {
      id: "ptresult_" + uuidv4(),
      profileId: Auth.currentProfile.id,
      date: fmtDate(),
      testType: "acft",
      raw,
      score,
    });
    dlg.remove();
    onSaved();
    toast(`ACFT scored: ${score.total}/${score.maxTotal}`);
  });

  dlg.querySelector("#closePt").addEventListener("click", () => dlg.remove());
  document.body.appendChild(dlg);
}

// Minimal dependency-free line chart on <canvas>.
function drawLineChart(canvas, points) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height, pad = 30;
  ctx.clearRect(0, 0, w, h);
  const styles = getComputedStyle(document.body);
  ctx.strokeStyle = styles.getPropertyValue("--border").trim() || "#ccc";
  ctx.fillStyle = styles.getPropertyValue("--text-muted").trim() || "#888";
  ctx.font = "11px sans-serif";

  if (points.length === 0) {
    ctx.fillText("No data yet.", pad, h / 2);
    return;
  }
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys) - 2, maxY = Math.max(...ys) + 2;
  const stepX = (w - pad * 2) / Math.max(1, points.length - 1);

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.y - minY) / (maxY - minY || 1)) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = styles.getPropertyValue("--accent").trim() || "#3b82f6";
  ctx.lineWidth = 2;
  ctx.stroke();

  points.forEach((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.y - minY) / (maxY - minY || 1)) * (h - pad * 2);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = styles.getPropertyValue("--accent").trim() || "#3b82f6";
    ctx.fill();
  });

  ctx.fillStyle = styles.getPropertyValue("--text-muted").trim() || "#888";
  ctx.fillText(points[0].y.toFixed(1), 2, h - pad);
  ctx.fillText(points[points.length - 1].y.toFixed(1), w - 30, pad);
}
