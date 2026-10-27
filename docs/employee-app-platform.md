# Employee app platform decision

Date: 19 October 2026  
Status: approved and implemented; verification below distinguishes build checks from release testing

## Decision

Build the employee interface with React DOM, TypeScript and Vite. Serve the same UI in a browser and package its build into Capacitor 8 Android and iOS apps. Preserve the existing application identifier, `com.niyacovr.employee`.

The employee product mainly needs forms, cover details, documents and status journeys. Sharing those screens across web and mobile reduces the number of UI implementations to maintain. Capacitor provides a path to device features when those journeys need them.

The previous React Native Community CLI implementation and the existing backend employee APIs informed the migration. Profile, Family and Cover remain the first-release scope; the [product document](../PRODUCT.md) is authoritative for current and future journeys.

## Alternatives considered

| Option | Tradeoff |
| --- | --- |
| React Native Community CLI | Shares Android/iOS UI and offers native components; a browser UI needs additional work. |
| React Native Web | Can share React Native components across three platforms; platform libraries and navigation still need compatibility work. |
| React web + Capacitor, selected | Shares the browser UI directly with native packages; device integration and WebView behaviour require platform testing. |

This choice reduces UI duplication. It still requires mobile signing, platform permissions, native builds, store distribution and tests on each platform.

## Boundary between app and backend

The app uses the existing API surface:

- `POST /api/employee/app/auth/otp/request`
- `POST /api/employee/app/auth/otp/verify`
- `GET /api/employee/app/overview`

The backend resolves the employee identity and authorises the overview. Phone ambiguity, inactive records and cross-company access remain backend decisions. This migration does not change OTP limits, provider credentials or backend business rules.

The overview supplies the current company, profile, family and cover data. A capability manifest is a future extension for additional modules; the current API has no invented entitlement field. Visibility in the UI is a convenience and never an authorisation boundary.

## Tokens and medical data

Use `@aparajita/capacitor-secure-storage` for the native access token: Keychain on iOS and encrypted storage backed by Android Keystore on Android. The browser token lives in memory only. Refreshing the browser page requires another sign-in. Signing out removes the saved native token and in-memory state.

Android backup and cleartext traffic are disabled in the application manifest.

Avoid persistent medical-data caches and service workers in this release. Reload an authorised overview from the API after sign-in. Keep tokens, phone numbers and medical data out of application logs and analytics.

The native storage namespace differs from the earlier React Native app. Existing testers may need to sign in again after installing the migrated build. Browser refresh sign-in is an intentional first-release tradeoff; persistent browser sessions would need a separately designed backend session, such as an HttpOnly cookie flow.

## Network configuration

`VITE_API_BASE_URL` is a build-time public API origin, without an `/api` suffix. Production browser and all native builds use the intended HTTPS API. Leave the value unset for browser development through the Vite `/api` proxy to `http://localhost:4000`. Native development also enforces HTTPS and needs a reachable HTTPS development server or tunnel.

Backend `CORS_ORIGINS` must explicitly allow the deployed web origin and the bundled native origins, `capacitor://localhost` on iOS and `https://localhost` on Android. Add them to the existing comma-separated origins for the deployed environment instead of adding a wildcard. The build inserts a Content Security Policy meta tag that allows connections to the app origin and the configured API; the hosting server should supply the remaining deployment security headers.

Release apps load bundled assets. Keep `server.url` unset for production. This implementation has no native HTTP transport exception.

## Native ownership

Commit the Capacitor configuration and generated Android/iOS source projects. Ignore dependencies, build outputs and copied web bundles; regenerate those with the build and sync commands. Configure signing identities, provisioning and secrets outside the repository.

The baseline toolchains are a Node version satisfying `package.json` (`^22.22.2 || >=24.15.0`), Android SDK 36 with JDK 21, and Xcode 26+. Targets start at Android API 24 and iOS 15. Plugin and Capacitor upgrades can change these requirements, so check the linked primary documentation when upgrading.

Camera, location, push notifications, employee file picking and explicit e-card sharing are future implementation work. Each needs a plugin choice, a browser behaviour, permission handling and a real-device check before becoming an available product action.

## Deployment and release

For the web, build and host `dist/` over HTTPS. Current hash routes avoid server-side route rewrites. Set the correct API address, security headers and explicit backend CORS origins for that deployment.

For Android/iOS, build the web bundle, run Capacitor sync, build the native project, then sign and distribute it. Shipping a new web deployment does not replace assets already bundled in an installed app. Changes to bundled UI or native plugins require the appropriate native release. Policy data and wording fetched from the backend continue to update through their existing backend workflow.

Before a production release, record results for:

1. Typecheck, lint, unit tests, web build and browser journeys.
2. Android and iOS native builds with the required SDKs and signing configuration.
3. Email and phone OTP on devices, invalid/expired OTP, sign-out, app restart and session expiry.
4. Native secure-token persistence and browser refresh sign-out.
5. Profile, family, cover, empty states, failed loads and retry with employee-scoped data.
6. Cross-company access checks at the API and employee premium/CD privacy.
7. Keyboard, safe areas, back navigation, text enlargement and interrupted networking.

Passing browser tests verifies browser behaviour. Simulator/device tests and production SMS approval remain separate evidence. No deployment or production-readiness claim follows from this architecture decision alone.

## Verification record: 20 October 2026

The following checks ran against the staged migration. API responses in automated browser journeys were mocked. No real email or SMS was sent.

| Check | Result | What it verifies |
| --- | --- | --- |
| TypeScript typecheck | Pass | Shared app types and build configuration. |
| ESLint | Pass | Configured source checks. |
| Production web build | Pass | The shared UI compiles with an explicit HTTPS API origin. |
| Vitest | 17/17 pass | API configuration, requests and session/storage behaviour with mocked native storage. |
| Playwright | 10/10 pass | Desktop and mobile browser sign-in, family/cover/profile, invalid OTP, session expiry, refresh sign-out and empty states using mocked APIs. |
| Unsigned iOS Simulator build | Pass, Xcode 27.1 | Native compilation and linking, including the secure-storage plugin; no app interaction was tested. |
| iPhone 17 / iOS 26.5 Simulator launch | Pass | The bundled app installed and opened its sign-in screen; no OTP, authenticated API or secure-storage interaction was tested. |
| Android `assembleDebug` | Pass, JDK 21.0.12 / SDK 36 / Gradle 8.14.3 | Native debug compilation and packaging, including the secure-storage plugin. |

Real-device OTP delivery, native token persistence/removal, keyboard, safe areas and back navigation still need testing. The deployed HTTPS API, exact CORS origins and approved production SMS setup also need environment verification. Push, camera and document integrations are future modules and have not been implemented or tested here.

## Migration record

The migration was prepared and checked in an isolated staging copy, then transferred into `NIYA_EMPLOYEE_APP`. Before replacement, a guard verified all 69 original source files against their recorded contents. Existing `.claude` and `.vscode` configuration was preserved.

The app's ignored `.migration-backups/` directory preserves:

- `before-capacitor-2026-10-20.tar.gz`: the pre-migration source archive, excluding `.git`, generated dependencies and build output.
- `before-capacitor-source-manifest.json`: the original source manifest used for the transfer check.
- `legacy-source/`: the original source files for comparison or manual recovery.

Keep this local recovery material until the migration has been reviewed and committed. It is not an off-machine backup or a source-control checkpoint. No commit, push or deployment was made by the migration.

## Primary references

- [Capacitor introduction](https://capacitorjs.com/docs)
- [Capacitor development workflow](https://capacitorjs.com/docs/basics/workflow)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Capacitor configuration](https://capacitorjs.com/docs/config)
- [Capacitor Android environment](https://capacitorjs.com/docs/android)
- [Capacitor iOS environment](https://capacitorjs.com/docs/ios)
- [React Native Web multi-platform guidance](https://necolas.github.io/react-native-web/docs/multi-platform/)
- [Capacitor secure-storage plugin](https://github.com/aparajita/capacitor-secure-storage)

## Manual e-card file integration — 27 October 2026

- Authenticated APIs: `GET /api/employee/app/ecards` and `GET /api/employee/app/ecards/:id/file`. Both recheck the active roster identity and corporate. No enrolment is required.
- Browser: a bearer-authenticated fetch downloads a PDF/PNG/JPEG as a temporary Blob URL; no persistent medical cache or service worker.
- Native: pinned official plugins `@capacitor/filesystem` 8.1.5 and `@capacitor/file-viewer` 2.0.4 open the downloaded file from the app's Cache directory. The app never sends its token in a URL or asks the viewer to fetch an authenticated URL.
- Cache cleanup is serialized and sign-out invalidates pending file operations. Startup cleans the dedicated `niya-ecards` directory before restoring sign-in. Storage/viewer failures remain visible. A previously downloaded or externally saved copy cannot be remotely revoked.
- iOS includes `PrivacyInfo.xcprivacy` in app resources, declaring FileTimestamp reason C617.1 for Filesystem. Android backup stays disabled. No broad storage permission is requested for the app-private cache.
- External HTTPS card links use an ordinary external navigation; Capacitor's existing navigation delegates open them through the OS. They are not embedded as remote images or fetched by the backend.

Plugin setup references: [Filesystem](https://capacitorjs.com/docs/apis/filesystem), [File Viewer](https://capacitorjs.com/docs/apis/file-viewer). Run Capacitor sync before each native build. Native document opening, viewer dismissal, link navigation and cache cleanup need device verification before release; browser downloads and native compilation are separate evidence.
