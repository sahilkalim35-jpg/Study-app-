# Study Ledger

A study time tracker (Subject > Chapter > Task) with a live timer, today's log, and analytics.

## Option A — Get the APK without installing anything (recommended)

1. Create a new GitHub repo and push this folder to it.
2. Go to the repo's **Actions** tab → the "Build Android APK" workflow will run automatically on push (or click **Run workflow** manually).
3. When it finishes (~3-5 min), open the workflow run → download the **study-ledger-debug-apk** artifact.
4. Unzip it, transfer `app-debug.apk` to your phone, and install it (allow "install from unknown sources" if asked).

## Option B — Build locally

Requirements: Node.js 18+, Android Studio (for the Android SDK), a JDK.

```bash
npm install
npm run build          # builds the web app into /dist
npx cap add android    # adds the android/ folder (first time only)
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

Or open the `android/` folder in Android Studio and hit Run/Build APK from there.

## Notes

- Data is stored in the device's local storage (per-app), so it stays even if you close the app. It does **not** sync across devices.
- To change the app icon/name, edit `capacitor.config.json` (name) and use `npx capacitor-assets generate` for icons.
- This is a **debug** build (fine for personal use / sideloading). For a signed release APK to publish on Play Store, you'd need to set up signing keys — ask if you want help with that.
