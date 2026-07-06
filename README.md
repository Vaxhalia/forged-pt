# Forged PT — Offline Calisthenics & Military PT App

A fully offline training app: workout coach mode, nutrition/macro tracking, and
progress tracking (including APFT/ACFT reference scoring), built as a local
web app (HTML/CSS/JS) so it runs on **Windows, Android, and iPhone with no
build toolchain, no app store, and no internet connection required once
loaded**, matching the original spec's "simple installer, sideload, no app
stores, fully offline" goals as closely as a non-native app can.

Two deliverables, for two different situations:
- **`ForgedPT.html`** (single file) — for Windows or **Android**, where you
  can just open the file directly, no server needed.
- **`forged-pt-app.zip`** (multi-file) — for Windows with a local server, or
  for **iPhone/iOS**, which requires the app to be served over `http(s)://`
  rather than opened as a bare file (see the iOS section below — this is an
  iOS platform restriction, not a limitation of this app).


## Why a web app instead of a native Flutter/EXE/APK build

Building real native Windows `.exe` / Android `.apk` binaries requires SDKs
and compilers (Flutter/Android Studio/Visual Studio) that don't exist in this
sandbox, and downloading them requires access to package registries that
aren't reachable here. A local, installable web app was the closest thing I
could actually build **and verify runs correctly** in this environment —
every JS file has been syntax-checked and the app has been served and
smoke-tested locally.

All data stays in the browser's on-device storage (IndexedDB). Nothing is
ever sent over a network — the app makes zero network calls after the page
loads.

## Running it

### Windows
1. Copy this whole folder to your PC.
2. Double-click `index.html` — it opens in your default browser and works
   immediately, fully offline.
3. Optional, for an "installed app" feel: open the folder in Chrome or Edge
   (`File > Open File... > index.html`), then use the browser's **Install
   app** button in the address bar. This creates a real desktop shortcut and
   its own app window (no browser chrome), and Windows will treat it like an
   installed application, including its own icon and Start Menu entry.

### Android
1. Copy the folder onto the phone (USB transfer, or your own local file
   share — no internet needed) and open `index.html` in Chrome, **or**
   serve the folder from a tiny local server for the smoothest experience
   (see "Optional: local server" below) and open it that way.
2. Tap Chrome's menu → **Add to Home screen**. This installs it as a real
   app icon that launches full-screen, works offline, and behaves like a
   sideloaded APK from the user's perspective.

### iPhone / iOS (Safari)

iOS is more restrictive than Android here: as of iOS 18.5, Safari (and every
other iOS browser, since Apple requires them all to use WebKit) **no longer
runs JavaScript in a locally-opened HTML file at all** — tapping one just
opens a static, script-free preview. So the single-file trick that works on
Android doesn't work on iPhone; the app has to be served over an actual
`http://` or `https://` URL. Two ways to do that, easiest first:

**Option A — quick, same Wi-Fi network only:**
1. On your Windows PC, open this folder and run a tiny local server (Python
   is already on most PCs; if not, install it free from python.org):
   ```
   python -m http.server 8080
   ```
2. Find your PC's local IP address: on Windows, open Command Prompt and run
   `ipconfig`, then look for "IPv4 Address" (something like `192.168.1.23`).
3. On your iPhone, make sure it's on the **same Wi-Fi network**, then open
   Safari and go to `http://192.168.1.23:8080` (using your PC's actual IP).
4. The app loads and works fully offline from that point on in terms of your
   data (nothing is ever sent anywhere) — but your PC's server does need to
   be running each time you open it this way, since it's still loading the
   page itself over your home network.
5. Optional: tap the Share icon → **Add to Home Screen** for an app icon
   that opens full-screen.

**Option B — a real installed app, no PC required afterward:**
Deploy the `pt_web` folder once to any free static hosting service (e.g.
Netlify, GitHub Pages, Cloudflare Pages, Vercel — search "deploy static
site" + the service name for current steps; all of them support drag-and-
drop or a few clicks for a plain HTML/CSS/JS folder like this one, no
backend needed). That gives you a real `https://` URL. Open it once in
Safari, then Share → **Add to Home Screen**. After that first load, the
app is fully cached for offline use and behaves like a real installed app
— notifications, full offline support, and no PC needed again.

*Why not just email yourself the HTML file like on Android?* Because of the
Safari restriction above — there is currently no way to get Safari to
execute JavaScript from a file that isn't loaded via `http(s)://`. This is
an iOS platform restriction, not a limitation of this app.

*A note on notifications:* Safari only allows a site to ask for notification
permission if it's already running as an installed Home Screen app (iOS
16.4+) — a regular Safari tab can't request it at all. Add to Home Screen
first if you want workout/meal reminders on iPhone.

### Optional: local server (recommended, enables full offline installability)
Opening via `file://` works for basic use, but browsers restrict a couple of
web-app features (like the offline service worker and "Add to Home
screen"/"Install" prompts) to pages served over `http://localhost` or
`https://`. If you want the full installable-app experience:

```
# From inside this folder, with Python installed:
python -m http.server 8080
# then open http://localhost:8080 on the same device
```

On Android, you'd run this on a small local server app (e.g. Termux) or use
any lightweight static-file server; the important part is that it's served
from the device itself, not the internet.

### Turning this into a real distributable `.apk` / `.exe` later
If you eventually want an actual installer file to hand to other people
(matching the original "simple APK/EXE, sideload, no app store" plan), this
folder is a ready-made input for:
- **Windows:** wrap it with Electron or Tauri to produce a standalone `.exe`.
- **Android:** wrap it with Trusted Web Activity tooling (e.g. Bubblewrap /
  PWABuilder) to produce a standalone `.apk`.

Both of those require internet access and SDKs this sandbox doesn't have, so
that packaging step is left for you to run in a normal dev environment —
the app itself needs no code changes to support it.

## What's implemented

- **Accounts:** local-only username/password (PBKDF2-hashed, on-device),
  multiple profiles per device, optional PIN lock you can enable, change, or
  disable at any time, plus account-level "Reset all data" (wipes training
  history but keeps your login) and "Delete account" (removes everything)
  in Settings.
- **Onboarding:** a two-step questionnaire — physical assessment (push-ups,
  sit-ups, plank, run time, age) plus lifestyle & availability (body type,
  activity level, sleep, hydration, eating pattern, training days/week,
  minutes per session, **how many weeks you want the program to run**, focus
  area, and a **checklist of goals** you can combine freely (general fitness,
  strength, fat loss, muscle gain, endurance, APFT/ACFT prep). The answers
  calibrate a fitness tier and generate **"Your Personalized Plan"** — a
  curated program tailored to your availability and goals — alongside two
  general presets. Session length and program duration together calibrate an
  **intensity level** shown on the plan (short sessions + a short program run
  hotter and harder; longer sessions spread over a longer program settle into
  a sustainable moderate pace). The curated plan is fully editable afterward,
  and you can retake the assessment anytime from your Profile screen.
- **Workouts:** exercise library (calisthenics + military drills, seeded +
  user-extendable with custom exercises and uploaded video), preset programs,
  a custom routine builder, and a "coach mode" session player — voice cues
  (Web Speech API), a 5-second "Start Set" countdown before every set, a
  Recovery timer between sets, auto-advance between exercises, and optional
  background music (user-selected local audio file, mixed under the voice
  cues, removable mid-session). Every exercise in the library can be
  previewed (video + instructions) without adding it to anything, and you
  can attach/change/remove a video on any exercise — including the built-in
  ones — right from the library. Tapping a program's name opens a detail view
  with Edit and Delete there (programs can be renamed, have days
  added/removed, exercises added/edited/removed, or be deleted entirely),
  plus a **full-duration calendar roster** — every scheduled training day
  across the whole program length, not just one week's worth of templates,
  each marked Completed, Missed, Today, or Upcoming. Missed days can be
  rescheduled to a new date right from the calendar, and completing a
  session started from a scheduled slot automatically checks it off. You
  can set a target duration (mm:ss) per set/hold, or set a whole day's
  target length and let the app auto-distribute that time across every
  exercise's sets as a pacing suggestion — all values stay manually
  editable afterward.
- **Nutrition:** searchable food database (seeded + user-extendable),
  full macro/calorie logging against daily targets, meal-photo logging, and
  military-style structured meal plan templates you can apply as your daily
  targets.
- **Progress:** weight trend chart, body measurements, progress photos,
  and APFT/ACFT reference PT-test scoring (linear interpolation against
  published-style scoring anchors, clearly labeled as reference-only).
- **Profile:** a dedicated screen (tap the avatar icon in the top bar) with
  your photo, username, latest assessment stats, and all your biodata from
  onboarding — editable anytime.
- **Data:** everything lives in IndexedDB on-device (with an automatic
  localStorage fallback if IndexedDB isn't available, e.g. on `file://`
  pages). Password hashing and ID generation also have a pure-JS fallback for
  when Web Crypto isn't available — which happens on any page that isn't a
  "secure context," like plain `http://` on a local network (the realistic
  way to reach this app from iPhone; see the iOS section below). Both
  fallback paths are exercised and verified working in testing, not just
  theoretical. Settings screen has a one-click **Export backup** (single
  JSON file) and **Import backup**, so you can manually move your data
  between your PC and phone.
- **Accessibility/design:** light/dark mode, adjustable text size, a
  Calisthenics-primary / Military-secondary theme toggle, an optional custom
  background image with an adjustable blur (0-100%), and full branding
  customization — rename the app and pick your own primary/secondary colors
  in Settings → Branding.
- **Reminders:** in-app browser notifications for workout and meal-logging
  reminders (fire while the app/tab is open — see limitations below).

## Known limitations vs. the original spec (and why)

| Original ask | What you get instead | Why |
|---|---|---|
| True background OS notifications | Notifications while the app/tab is open, or shortly after via service worker | Web apps can't register OS-level alarms the way native apps can |
| Fingerprint/biometric unlock | PIN unlock only | Browsers don't expose device biometrics to web pages (WebAuthn could add a device-bound key as a future enhancement, but isn't wired up here) |
| Cross-device `.zip` backup | Cross-device `.json` backup, same manual "move the file yourself" workflow | Simpler and equally portable; no meaningful functionality lost |
| Native `.apk`/`.exe` installer | Installable web app (Chrome "Install"/"Add to Home screen") | No SDK/compiler available in this sandbox; see packaging note above for the real path to a native binary later |

## File structure

```
index.html              entry point
manifest.json            PWA install metadata
service-worker.js        offline caching
css/styles.css            all styling incl. themes
js/seed.js               starter exercise/food/scoring data
js/db.js                 IndexedDB layer
js/auth.js               local accounts + PIN
js/scoring.js             APFT/ACFT reference scoring
js/app.js                 router, shell, login, onboarding, home
js/workouts.js            library, routine builder, coach-mode player
js/nutrition.js            food logging, meal plans
js/progress.js             weight/measurements/photos/PT tests
js/settings.js             theme, PIN, reminders, backup/restore
icons/                     app icons
```
