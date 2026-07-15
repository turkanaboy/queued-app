# Queued Native Mobile Store Readiness Checklist

Status legend:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked or requires external account/device/dashboard access

## 1. Stabilize Current Web App

- `[x]` Fix current lint errors.
- `[x]` Quiet remaining hook dependency lint warnings with explicit legacy-effect annotations.
- `[x]` Confirm production web build succeeds.
- `[ ]` Smoke test every route: login, setup, friends, shared list, add recommendation, queued, collection, profile, trivia, parties.
- `[!]` Confirm Supabase migrations are applied cleanly in production.
- `[!]` Rotate exposed-looking keys from `.env.local`.
- `[!]` Move all private keys to Supabase function secrets or server-only environments.
- `[x]` Confirm no service-role or private API key can ever ship to the client bundle.
- `[x]` Add a basic release build check covering build and lint.
- `[x]` Review production bundle size and code-splitting options.

## 2. Choose Native Wrapper Path

Recommended path for this repo: Capacitor.

- `[x]` Add Capacitor dependencies.
- `[x]` Configure app ID, app name, and web output directory.
- `[x]` Generate native `android/` project.
- `[x]` Generate native `ios/` project.
- `[x]` Add a repeatable Capacitor sync command.
- `[x]` Configure Vite/mobile wrapper compatibility if needed.
- `[x]` Install/configure JDK 21 for Android builds.
- `[x]` Build local Android debug APK.
- `[~]` Run the app locally in Android Studio or emulator. APK installs and launches on an Android emulator via `adb`; Android Studio workflow not yet verified.
- `[!]` Run the app locally in Xcode on macOS.

## 3. Mobile Auth And Deep Links

- `[!]` Choose the production HTTPS domain for verified Android App Links and iOS Universal Links. The current `queued://` scheme is a development fallback, not the store-release callback.
- `[!]` Configure the production HTTPS callback in Supabase Auth after the domain is chosen. Keep `queued://auth/callback` only for local/native development testing.
- `[x]` Add the iOS custom URL scheme as a development fallback.
- `[x]` Add the Android custom URL scheme as a development fallback.
- `[x]` Restrict native magic-link handling to exact PKCE code callbacks; implicit token callbacks are rejected.
- `[!]` Test fresh login on a real iOS device.
- `[!]` Test fresh login on a real Android device.
- `[!]` Test invite links and party invite links from email/text into the native app.

## 4. App Shell And Mobile UX

- `[x]` Add native splash screen.
- `[x]` Add app icons for all iOS/Android sizes.
- `[ ]` Confirm safe-area handling on notched devices.
- `[ ]` Confirm keyboard behavior on login/setup/search forms.
- `[ ]` Confirm scroll behavior on long lists and sheets.
- `[ ]` Check offline/poor-network loading states.
- `[ ]` Check empty states.
- `[x]` Search source for obvious mojibake/broken text patterns.
- `[ ]` Audit mobile tap targets.
- `[ ]` Test dark/light system appearance behavior, even if app stays dark.

## 5. Backend And Security

- `[x]` Review Supabase RLS policies and remove direct group state-transition writes.
- `[x]` Confirm anonymous users cannot read private recommendation/list/profile data through local regression checks.
- `[x]` Confirm friend-only/private list behavior works as intended through policy review and local database tests.
- `[x]` Confirm edge functions validate auth tokens.
- `[x]` Confirm service-role functions expose only authenticated, owner-scoped operations.
- `[x]` Add atomic rate limiting for media search.
- `[x]` Add atomic rate limiting for bot recommendations.
- `[x]` Add atomic rate limiting for trivia generation/submission.
- `[ ]` Add rate limiting or abuse protection for invites.
- `[x]` Add authenticated account data export and permanent account deletion.

## 6. Store Compliance

- `[!]` Write privacy policy.
- `[!]` Write terms of service or basic user agreement.
- `[!]` Prepare App Store privacy nutrition labels.
- `[!]` Prepare Google Play Data Safety form.
- `[!]` Disclose collected data: email, profile/username, recommendations, ratings/statuses, friend/social interactions, and usage-derived app content.
- `[!]` Confirm whether affiliate links require disclosure.
- `[!]` Confirm TMDB attribution requirements.
- `[!]` Confirm any book/music/game data providers' attribution requirements.

## 7. Native Platform Configuration

### iOS

- `[!]` Apple Developer account.
- `[ ]` Bundle identifier.
- `[!]` Signing certificates/profiles.
- `[!]` Add Associated Domains after the production HTTPS domain is chosen.
- `[ ]` App icons.
- `[ ]` Launch screen.
- `[!]` TestFlight build.
- `[!]` App Store screenshots.
- `[!]` App Review notes/demo account if needed.

### Android

- `[!]` Google Play Developer account.
- `[ ]` Application ID.
- `[!]` Keystore/signing config.
- `[ ]` Adaptive icon.
- `[ ]` Splash screen.
- `[!]` Add verified App Links after the production HTTPS domain is chosen.
- `[!]` Internal testing release.
- `[!]` Play Store screenshots.
- `[!]` Data Safety form.
- `[!]` Content rating questionnaire.

## 8. Testing Before Submission

- `[!]` Test on at least one real iPhone.
- `[!]` Test on at least one real Android phone.
- `[!]` Test first install.
- `[!]` Test logout/login.
- `[!]` Test magic link from email.
- `[!]` Test invite acceptance.
- `[!]` Test push/deep-link behavior if added.
- `[!]` Test Supabase session persistence after app close/reopen.
- `[!]` Test app update over existing install.
- `[!]` Test slow network.
- `[!]` Test no network.
- `[!]` Test account edge cases: no username, no friends, no recommendations, no platforms selected.

## 9. Release Readiness

- `[ ]` Add production environment checklist.
- `[ ]` Add app version/build number process.
- `[!]` Add crash/error monitoring.
- `[!]` Add analytics only if desired and disclosed.
- `[~]` Add authenticated in-app feedback routed to `info@myqueued.com`; app/function work is complete, but the configured `RESEND_API_KEY` must be allowed to send from the verified `myqueued.com` domain.
- `[!]` Add deletion/support instructions.
- `[!]` Prepare screenshots and store copy.
- `[!]` Submit first internal/beta build.
- `[!]` Fix beta findings.
- `[!]` Submit to App Store Review and Google Play Review.

## Current Milestone

The next milestone is repairing the one legacy migration-ledger version below, applying the pending migrations and Edge Functions, then choosing the production HTTPS domain and running the Capacitor build on physical iOS and Android devices.

## Database Deployment Preflight

The linked production schema already contains both changes that were historically recorded as version `20260607`. The local files are now consolidated as `20260607000000_games_and_trivia.sql` so clean installs have a sortable, unique version. Before the next production migration push, update only the migration ledger to reflect that existing schema state:

```powershell
npx.cmd supabase migration list --linked
npx.cmd supabase migration repair 20260607 --status reverted --linked
npx.cmd supabase migration repair 20260607000000 --status applied --linked
npx.cmd supabase migration list --linked
npx.cmd supabase db push --dry-run --linked
```

Do not run the repair until a current database backup exists and the first migration list still shows remote `20260607` plus local `20260607000000` as the only legacy mismatch. The repair changes migration history only; it must not be paired with manually re-running the consolidated SQL because those schema objects already exist remotely.

## Progress Log

- 2026-06-14: Added this checklist.
- 2026-06-14: Fixed blocking lint errors and added `npm run verify:release`.
- 2026-06-14: Confirmed `npm.cmd run verify:release` passes. Vite still reports a non-blocking chunk-size warning for the main JS bundle.
- 2026-06-14: Installed Capacitor, created `capacitor.config.json`, generated `android/` and `ios/`, and confirmed `npm.cmd run mobile:sync` works.
- 2026-06-14: Tried `android/gradlew.bat assembleDebug`; Gradle download worked, but Android compilation is blocked until the local Java runtime is upgraded from 17 to 21.
- 2026-06-14: Updated ESLint ignores so generated native folders and copied build assets do not break source linting.
- 2026-06-15: Added route-level lazy loading/code splitting. `npm.cmd run verify:release` passes, and the main JS output is split into page chunks instead of one large route bundle.
- 2026-06-15: Confirmed generated `dist`, Android web assets, and iOS web assets do not contain non-`VITE_` `.env.local` values such as service-role/provider API keys.
- 2026-06-15: Confirmed `npm.cmd run mobile:sync` passes after the route split.
- 2026-06-15: Confirmed local Java 21 is installed. Initially, `JAVA_HOME` still pointed at JDK 17, so Android builds needed a command-local override: `$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.11'; $env:Path="$env:JAVA_HOME\bin;$env:Path"; .\gradlew.bat assembleDebug`.
- 2026-06-15: Built Android debug APK successfully at `android/app/build/outputs/apk/debug/app-debug.apk`.
- 2026-06-15: Persisted user-level `JAVA_HOME` to `C:\Program Files\Java\jdk-21.0.11` and re-ran `android/gradlew.bat assembleDebug` successfully with JDK 21 active.
- 2026-06-15: Installed `app-debug.apk` onto Android emulator `emulator-5554` with `adb install -r`, launched `com.queued.app/.MainActivity`, and confirmed it became the focused foreground activity.
- 2026-06-15: Added `@capacitor/app`, registered `queued://auth/callback` on Android and iOS, and updated native login to request that redirect URL. The app handles both PKCE `code` callbacks and implicit `access_token`/`refresh_token` callbacks.
- 2026-06-15: Verified Android resolves `queued://auth/callback?code=test-code` into `com.queued.app/.MainActivity` on emulator `emulator-5554`. Real Supabase auth still requires adding `queued://auth/callback` to the project's Auth redirect allow-list.
- 2026-06-16: Added generated app icon and native splash assets using the Q monogram mark with the broader tagline, "Share what's worth your time." Source previews live in `docs/mockups/assets/`, and platform PNGs were written into Android and iOS resource folders.
- 2026-07-10: Hardened group RLS and vote integrity, made recommendation/trivia transitions atomic, added database-backed Edge Function quotas, pinned Edge dependencies, added account export/deletion, fixed native callback validation/listener cleanup/iOS package paths, disabled Android backups, and added focused database/auth regression checks. Verified the linked production schema already contains both legacy `20260607` changes, consolidated them into one canonical local timestamp, and documented the required one-time production ledger repair.
- 2026-07-15: Added an authenticated feedback modal on the user's Profile. Submissions are rate-limited and sent server-side through a Supabase Edge Function to `info@myqueued.com` without opening the user's email app. Resend rejected the setup delivery because the configured sending-only API key is not authorized for `feedback@myqueued.com`; the domain itself is already used by the separate magic-link mail configuration.
