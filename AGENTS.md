# NIYA employee app

This is React DOM + TypeScript + Vite, packaged with Capacitor for Android and iOS. Keep the native `android/` and `ios/` projects as versioned source.

Read [PRODUCT.md](PRODUCT.md) before changing journeys or employee-visible data. Read [DESIGN.md](DESIGN.md) before changing screens or styling. Read [docs/employee-app-platform.md](docs/employee-app-platform.md) before changing authentication, storage, native plugins, networking or release configuration.

Use `package.json` for commands. Run typecheck, lint and tests covering a change; run a production build for UI or build changes. Report web checks and native/device checks separately.

Employee access is enforced by the backend. Keep tokens in the established storage adapter and use employee-scoped APIs. Preserve the application's `com.niyacovr.employee` identifier. Add native functionality through Capacitor plugins and their native setup.
