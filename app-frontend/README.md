# Bike Surgeon customer app

React 19, TypeScript, Vite 7 and Tailwind 4, packaged for iOS and Android with Capacitor 8. App id: `com.bikesurgeon.customer`.

```bash
npm install
npm run dev                 # http://localhost:5173
```

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type check and production build to `dist/` |
| `npm run typecheck` | Type check only |
| `npm run ios:sync` / `npm run ios:open` | Build, copy into the iOS project, open Xcode |
| `npm run android:sync` / `npm run android:open` | Same for Android Studio |
| `npm run ios:device` | Build and install on a connected iPhone (needs an Apple ID in Xcode) |
| `npm run icons` | Regenerate app icons and splash screens from `assets/` |

## State of the app

Every screen in the agreed flow is built, including the in-between states: skeleton loading, empty first-time screens, approvals, payment and reviews. **Data comes from sample data inside `src/customer-app.tsx`, not from the API yet.** [Wiring the app to the API](../docs/06-frontend-integration.md) maps each screen to its endpoint.

The Profile screen has a **Test build** section to switch between a new and a returning sample customer. Set `VITE_TEST_TOOLS=off` (see `.env.example`) for store builds.

## Layout

| Path | Contents |
|---|---|
| `src/customer-app.tsx` | All screens and the sample data |
| `src/App.tsx` | Navigation stack, hardware back and swipe-back, theme |
| `src/native.ts` | Capacitor bridges: status bar, splash, haptics, back button, local storage |
| `src/bike-art.tsx`, `src/bike-catalog.ts` | Bike illustrations by body type, and the brand and model catalogue |
| `src/components/ui/` | shadcn/ui components |
| `src/*.css` | Styles (`customer.css` holds most of the app) |
| `public/` | Logos, fonts, the sample bay-camera clip |
| `ios/`, `android/` | Native projects. Web assets are copied in by `cap sync` and are not committed. |
