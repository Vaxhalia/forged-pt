// ---------------------------------------------------------------------------
// IndexedDB layer. Everything lives on-device; nothing ever leaves the browser.
// Object stores map roughly 1:1 to the tables in the original spec.
// ---------------------------------------------------------------------------

const DB_NAME = "forged_pt_db";
const DB_VERSION = 1;

const STORES = [
  "profiles",         // local accounts
  "exercises",         // exercise library (starter + user-added)
  "programs",           // workout programs (preset + custom)
  "programExercises",  // exercise entries within a program/day
  "sessions",          // completed/in-progress workout sessions
  "sessionLogs",       // per-exercise results within a session
  "foods",             // food/nutrition database
  "mealPlans",         // military-style structured meal plans
  "mealLogs",          // day-to-day logged meals/food entries
  "weightLogs",        // body weight over time
  "measurements",      // body measurements over time
  "progressPhotos",    // progress photo metadata (+ blob)
  "ptTestResults",     // APFT/ACFT test attempts + scores
  "settings",          // per-profile app settings (theme, targets, reminders)
];

let _db = null;
let _engine = null; // "indexeddb" | "localstorage", set once detection completes

// Chrome (and some other browsers) refuse to open IndexedDB at all on
// file:// pages - the open() request neither succeeds nor errors, it just
// hangs forever. We race it against a short timeout and, if IndexedDB isn't
// usable, silently switch every DB method below to a localStorage-backed
// engine with the exact same interface. This is what makes double-clicking
// index.html directly (no local server) work reliably.
function openDb() {
  return new Promise((resolve) => {
    if (_engine === "localstorage") return resolve(null);
    if (_db) return resolve(_db);

    if (!("indexedDB" in window)) {
      _engine = "localstorage";
      return resolve(null);
    }

    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      _engine = "localstorage";
      console.warn("IndexedDB did not respond (common on file:// pages) - using on-device localStorage fallback instead.");
      resolve(null);
    }, 1200);

    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            const os = db.createObjectStore(store, { keyPath: "id" });
            if (store !== "settings" && store !== "profiles") {
              os.createIndex("profileId", "profileId", { unique: false });
            }
            if (["sessions", "mealLogs", "weightLogs", "measurements", "progressPhotos", "ptTestResults"].includes(store)) {
              os.createIndex("date", "date", { unique: false });
            }
          }
        }
      };

      req.onsuccess = (e) => {
        if (settled) { e.target.result.close(); return; }
        settled = true;
        clearTimeout(fallbackTimer);
        _db = e.target.result;
        _engine = "indexeddb";
        resolve(_db);
      };

      req.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(fallbackTimer);
        _engine = "localstorage";
        console.warn("IndexedDB error - using on-device localStorage fallback instead.", e.target && e.target.error);
        resolve(null);
      };
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(fallbackTimer);
        _engine = "localstorage";
        resolve(null);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// localStorage fallback engine. Each store is one JSON blob keyed by record
// id, stored under localStorage key "fpt_store_<storeName>". Same shape of
// data as the IndexedDB path, just persisted synchronously under the hood.
// ---------------------------------------------------------------------------

function lsKey(storeName) {
  return "fpt_store_" + storeName;
}
function lsReadStore(storeName) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(storeName)) || "{}");
  } catch {
    return {};
  }
}
function lsWriteStore(storeName, dataObj) {
  try {
    localStorage.setItem(lsKey(storeName), JSON.stringify(dataObj));
    return true;
  } catch (err) {
    // Most likely a quota overflow - typically from a large embedded video/photo.
    throw new Error(
      "Local storage is full (this fallback mode has a small on-device limit, roughly 5-10MB total). " +
      "Try a smaller video/photo, delete some old entries, or run this app via a local server " +
      "(see README) to use the much larger IndexedDB storage instead."
    );
  }
}

const DB = {
  async put(storeName, obj) {
    const db = await openDb();
    if (!db) {
      const data = lsReadStore(storeName);
      data[obj.id] = obj;
      lsWriteStore(storeName, data);
      return obj;
    }
    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    return new Promise((resolve, reject) => {
      const r = store.put(obj);
      r.onsuccess = () => resolve(obj);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async putMany(storeName, items) {
    const db = await openDb();
    if (!db) {
      const data = lsReadStore(storeName);
      items.forEach((it) => (data[it.id] = it));
      lsWriteStore(storeName, data);
      return items;
    }
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, "readwrite");
      const store = t.objectStore(storeName);
      items.forEach((it) => store.put(it));
      t.oncomplete = () => resolve(items);
      t.onerror = (e) => reject(e.target.error);
    });
  },

  async get(storeName, id) {
    const db = await openDb();
    if (!db) {
      const data = lsReadStore(storeName);
      return data[id] || null;
    }
    const store = db.transaction(storeName).objectStore(storeName);
    return new Promise((resolve, reject) => {
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(storeName) {
    const db = await openDb();
    if (!db) {
      return Object.values(lsReadStore(storeName));
    }
    const store = db.transaction(storeName).objectStore(storeName);
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result || []);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllByProfile(storeName, profileId) {
    const db = await openDb();
    if (!db) {
      return Object.values(lsReadStore(storeName)).filter((rec) => rec.profileId === profileId);
    }
    const store = db.transaction(storeName).objectStore(storeName);
    return new Promise((resolve, reject) => {
      try {
        const idx = store.index("profileId");
        const r = idx.getAll(profileId);
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = (e) => reject(e.target.error);
      } catch (err) {
        // store has no profileId index (e.g. shared library) -> fall back to all
        this.getAll(storeName).then(resolve).catch(reject);
      }
    });
  },

  async delete(storeName, id) {
    const db = await openDb();
    if (!db) {
      const data = lsReadStore(storeName);
      delete data[id];
      lsWriteStore(storeName, data);
      return true;
    }
    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    return new Promise((resolve, reject) => {
      const r = store.delete(id);
      r.onsuccess = () => resolve(true);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(storeName) {
    const db = await openDb();
    if (!db) {
      lsWriteStore(storeName, {});
      return true;
    }
    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    return new Promise((resolve, reject) => {
      const r = store.clear();
      r.onsuccess = () => resolve(true);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async count(storeName) {
    const db = await openDb();
    if (!db) {
      return Object.keys(lsReadStore(storeName)).length;
    }
    const store = db.transaction(storeName).objectStore(storeName);
    return new Promise((resolve, reject) => {
      const r = store.count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = (e) => reject(e.target.error);
    });
  },

  async storageEngine() {
    await openDb();
    return _engine;
  },

  // Dump every store into one plain object - used for backup export.
  async exportAll() {
    const dump = { version: DB_VERSION, exportedAt: new Date().toISOString(), stores: {} };
    for (const store of STORES) {
      dump.stores[store] = await this.getAll(store);
    }
    return dump;
  },

  // Restore from a previously exported dump. Wipes and replaces each store.
  async importAll(dump) {
    if (!dump || !dump.stores) throw new Error("Invalid backup file.");
    for (const store of STORES) {
      if (!dump.stores[store]) continue;
      await this.clear(store);
      await this.putMany(store, dump.stores[store]);
    }
    return true;
  },
};

async function seedIfEmpty() {
  const exerciseCount = await DB.count("exercises");
  if (exerciseCount === 0) {
    await DB.putMany("exercises", SEED_EXERCISES.map((e) => ({ ...e, profileId: "global", builtin: true })));
  }
  const foodCount = await DB.count("foods");
  if (foodCount === 0) {
    await DB.putMany("foods", SEED_FOODS.map((f) => ({ ...f, profileId: "global", builtin: true })));
  }
  const planCount = await DB.count("mealPlans");
  if (planCount === 0) {
    await DB.putMany("mealPlans", SEED_MEAL_PLANS.map((p) => ({ ...p, profileId: "global", builtin: true })));
  }
}
