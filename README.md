# NIYA_APP

One React web app for the browser, Android and iOS. Vite builds the shared UI; Capacitor packages that build into the native apps. The application identifier remains `com.niyacovr.employee`.

The first release supports email or phone OTP sign-in and read-only profile, family and current cover. It uses the existing employee APIs and works independently of enrolment invitation links. See [PRODUCT.md](PRODUCT.md) for scope and [the platform decision](docs/employee-app-platform.md) for the migration, security model and release checks.

## Run locally

Use a Node version allowed by `package.json` (`^22.22.2 || >=24.15.0`), then:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The development server proxies `/api` to the backend at `http://localhost:4000`. Use a development backend with disposable data. For temporary phone OTP testing, the backend supports `EMPLOYEE_APP_SMS_MODE=console`; production SMS requires the approved NIYA provider configuration.

`VITE_API_BASE_URL` is a public API origin, never a credential. Leave it unset for browser development through the `/api` proxy. Deployed web and native builds need the intended HTTPS API origin, such as `https://api.example.com`, without an `/api` suffix. Create `.env.local` from `.env.example` and set the value before building. Vite embeds it at build time.

## Android and iOS

Install Android Studio with SDK 36 and JDK 21 for Android, or Xcode 26+ for iOS. The native targets support Android API 24+ and iOS 15+.

```sh
npm run cap:sync
npm run android
```

For iOS, run `npm run ios` on macOS with the Xcode toolchain. Configure development signing in Xcode for the selected team. Native projects belong in version control; generated web bundles and copied native web assets are ignored.

Use `npm run android:dev` or `npm run ios:dev` for a native development build. Configure `VITE_API_BASE_URL` to a reachable HTTPS development API first: native builds enforce HTTPS in development as well. `localhost` inside a phone points to that phone. A local browser can use the HTTP proxy; native testing needs a reachable HTTPS development server or tunnel.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The browser suite uses mocked employee API responses and sends no OTP or email. Native SDK builds and device checks remain separate release gates; passing a web build does not verify them. Consult the scripts in `package.json` for the current commands.

Results from the migration checks are recorded in the [verification record](docs/employee-app-platform.md#verification-record-20-october-2026).

## App icons

`assets/logo.png` is the existing NIYA logo used for the Android/iOS icons and splash assets. Regenerate them with the same pinned asset tool:

```sh
npm exec --yes --package=@capacitor/assets@3.0.5 -- capacitor-assets generate --assetPath assets --ios --android --iconBackgroundColor '#F8FAF9' --iconBackgroundColorDark '#F8FAF9' --splashBackgroundColor '#F8FAF9' --splashBackgroundColorDark '#F8FAF9'
```

## Deploy

Host `dist/` as static HTTPS content for the web. Hash routes keep the entry point usable without an application-server route rewrite. Allow the deployed web origin and the native origins in backend CORS; see the [deployment checklist](docs/employee-app-platform.md#deployment-and-release).

Android and iOS ship bundled web assets. Deploying the website does not update an installed mobile app. Rebuild, sync, sign and distribute a native release when its bundled UI or plugins change.
