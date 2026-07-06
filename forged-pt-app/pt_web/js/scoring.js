// ---------------------------------------------------------------------------
// Reference PT test scoring. Linear interpolation between published min/max
// anchor points. Labeled everywhere in the UI as "reference scoring" - not
// an official system of record.
// ---------------------------------------------------------------------------

const Scoring = {
  _interp(value, min, max, minScore, maxScore, inverted) {
    let v = value;
    if (inverted) {
      // lower raw value (time) = higher score
      if (v <= min) return maxScore;
      if (v >= max) return minScore;
      const pct = (v - min) / (max - min);
      return Math.round(maxScore - pct * (maxScore - minScore));
    } else {
      if (v <= min) return minScore;
      if (v >= max) return maxScore;
      const pct = (v - min) / (max - min);
      return Math.round(minScore + pct * (maxScore - minScore));
    }
  },

  scoreApft({ gender, pushups, situps, runSeconds }) {
    const t = SEED_PT_SCORING.apft.events;
    const pKey = gender === "female" ? "pushups_female" : "pushups_male";
    const sKey = gender === "female" ? "situps_female" : "situps_male";
    const rKey = gender === "female" ? "run_seconds_female" : "run_seconds_male";

    const pushupScore = this._interp(pushups, t[pKey].min, t[pKey].max, t[pKey].minScore, t[pKey].maxScore, false);
    const situpScore = this._interp(situps, t[sKey].min, t[sKey].max, t[sKey].minScore, t[sKey].maxScore, false);
    const runScore = this._interp(runSeconds, t[rKey].min, t[rKey].max, t[rKey].minScore, t[rKey].maxScore, true);

    const total = pushupScore + situpScore + runScore;
    const pass = pushupScore >= SEED_PT_SCORING.apft.passScore
      && situpScore >= SEED_PT_SCORING.apft.passScore
      && runScore >= SEED_PT_SCORING.apft.passScore;

    return { pushupScore, situpScore, runScore, total, maxTotal: SEED_PT_SCORING.apft.maxTotal, pass };
  },

  scoreAcft(rawByEventKey) {
    const events = SEED_PT_SCORING.acft.events;
    const results = {};
    let total = 0;
    let pass = true;
    for (const ev of events) {
      const raw = rawByEventKey[ev.key];
      if (raw === undefined || raw === null || raw === "") {
        results[ev.key] = { name: ev.name, score: null };
        pass = false;
        continue;
      }
      const score = this._interp(Number(raw), ev.min, ev.max, ev.minScore, ev.maxScore, !!ev.inverted);
      results[ev.key] = { name: ev.name, raw, score };
      total += score;
      if (score < SEED_PT_SCORING.acft.passScorePerEvent) pass = false;
    }
    return { events: results, total, maxTotal: SEED_PT_SCORING.acft.maxTotal, pass };
  },
};
