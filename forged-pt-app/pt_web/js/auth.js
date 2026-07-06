// ---------------------------------------------------------------------------
// Local-only account system. No network calls, no server, ever.
// Passwords are hashed with PBKDF2 (Web Crypto) + a random per-profile salt.
// Multiple profiles can exist on one device/browser.
// ---------------------------------------------------------------------------

const Auth = {
  currentProfile: null,
  unlocked: false, // whether the PIN/biometric-equivalent gate has been passed this session

  async _hash(password, saltHex) {
    const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const saltHexOut = bytesToHex(salt);

    if (window.crypto && window.crypto.subtle) {
      try {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits(
          { name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" },
          keyMaterial,
          256
        );
        return { hashHex: bytesToHex(new Uint8Array(bits)), saltHex: saltHexOut };
      } catch (err) {
        console.warn("Web Crypto PBKDF2 failed, falling back to pure-JS hashing:", err);
      }
    }
    // No Web Crypto (not a secure context - e.g. plain http:// on a LAN, which
    // is the realistic way to reach this app from iOS Safari). Fall back to a
    // pure-JS stretched hash so accounts still work everywhere.
    return { hashHex: fallbackStretchedHash(password, saltHexOut), saltHex: saltHexOut };
  },

  async listProfiles() {
    const all = await DB.getAll("profiles");
    return all.map((p) => ({ id: p.id, username: p.username, hasPin: !!p.pinHash, createdAt: p.createdAt, theme: p.theme }));
  },

  async createProfile(username, password) {
    const existing = await DB.getAll("profiles");
    if (existing.some((p) => p.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("That username already exists on this device.");
    }
    const { hashHex, saltHex } = await this._hash(password);
    const profile = {
      id: "profile_" + uuidv4(),
      username,
      passwordHash: hashHex,
      passwordSalt: saltHex,
      pinHash: null,
      pinSalt: null,
      createdAt: new Date().toISOString(),
      onboarded: false,
      theme: "calisthenics",
      colorScheme: "system",
      textScale: 1.0,
    };
    await DB.put("profiles", profile);
    // default per-profile settings row
    await DB.put("settings", {
      id: "settings_" + profile.id,
      profileId: profile.id,
      dailyCalorieTarget: 2400,
      proteinTarget: 170,
      carbTarget: 250,
      fatTarget: 75,
      workoutReminders: true,
      mealReminders: true,
      reminderTimes: { workout: "17:00", meals: ["08:00", "12:30", "18:30"] },
    });
    this.currentProfile = profile;
    this.unlocked = true;
    return profile;
  },

  async login(username, password) {
    const all = await DB.getAll("profiles");
    const profile = all.find((p) => p.username.toLowerCase() === username.toLowerCase());
    if (!profile) throw new Error("No profile with that username on this device.");
    const { hashHex } = await this._hash(password, profile.passwordSalt);
    if (hashHex !== profile.passwordHash) throw new Error("Incorrect password.");
    this.currentProfile = profile;
    this.unlocked = true;
    sessionStorage.setItem("forged_pt_active_profile", profile.id);
    return profile;
  },

  async setPin(pin) {
    if (!this.currentProfile) throw new Error("No active profile.");
    const { hashHex, saltHex } = await this._hash(pin);
    this.currentProfile.pinHash = hashHex;
    this.currentProfile.pinSalt = saltHex;
    await DB.put("profiles", this.currentProfile);
  },

  async verifyPin(pin) {
    if (!this.currentProfile || !this.currentProfile.pinHash) return false;
    const { hashHex } = await this._hash(pin, this.currentProfile.pinSalt);
    const ok = hashHex === this.currentProfile.pinHash;
    if (ok) this.unlocked = true;
    return ok;
  },

  async removePin() {
    if (!this.currentProfile) throw new Error("No active profile.");
    this.currentProfile.pinHash = null;
    this.currentProfile.pinSalt = null;
    await DB.put("profiles", this.currentProfile);
    this.unlocked = true;
  },

  // Deletes every record owned by this profile across all stores.
  // Global/builtin records (profileId === "global") are left untouched.
  async _wipeProfileData(profileId) {
    for (const store of STORES) {
      if (store === "profiles") continue;
      if (store === "settings") {
        await DB.delete("settings", "settings_" + profileId);
        continue;
      }
      const recs = await DB.getAllByProfile(store, profileId);
      for (const r of recs) {
        if (r.profileId === "global") continue; // safety: never touch shared library items
        await DB.delete(store, r.id);
      }
    }
  },

  // Wipes all training/nutrition/progress data but keeps the account and
  // password intact, and sends the user back through onboarding.
  async resetProfileData() {
    if (!this.currentProfile) throw new Error("No active profile.");
    const id = this.currentProfile.id;
    await this._wipeProfileData(id);
    await DB.put("settings", {
      id: "settings_" + id,
      profileId: id,
      dailyCalorieTarget: 2400,
      proteinTarget: 170,
      carbTarget: 250,
      fatTarget: 75,
      workoutReminders: true,
      mealReminders: true,
      reminderTimes: { workout: "17:00", meals: ["08:00", "12:30", "18:30"] },
    });
    this.currentProfile.onboarded = false;
    this.currentProfile.fitnessTier = null;
    this.currentProfile.initialAssessment = null;
    await DB.put("profiles", this.currentProfile);
  },

  // Permanently deletes the account itself plus all of its data.
  async deleteAccount() {
    if (!this.currentProfile) throw new Error("No active profile.");
    const id = this.currentProfile.id;
    await this._wipeProfileData(id);
    await DB.delete("profiles", id);
    this.logout();
  },


  lock() {
    this.unlocked = false;
  },

  logout() {
    this.currentProfile = null;
    this.unlocked = false;
    sessionStorage.removeItem("forged_pt_active_profile");
  },

  async resumeSession() {
    const id = sessionStorage.getItem("forged_pt_active_profile");
    if (!id) return null;
    const profile = await DB.get("profiles", id);
    if (!profile) return null;
    this.currentProfile = profile;
    // Still require PIN unlock if one is set, even on resume.
    this.unlocked = !profile.pinHash;
    return profile;
  },

  async getSettings() {
    if (!this.currentProfile) return null;
    return DB.get("settings", "settings_" + this.currentProfile.id);
  },

  async updateSettings(patch) {
    const current = await this.getSettings();
    const merged = { ...current, ...patch };
    await DB.put("settings", merged);
    return merged;
  },
};

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
