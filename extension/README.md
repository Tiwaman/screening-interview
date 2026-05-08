# Screening Interview — Browser Extension

MV3 side panel that lists prepared interviews and (in M5+) drives the live interview from inside Meet, Zoom, or Teams.

## Build

```bash
cd extension
npm install
npm run build
```

This produces a `dist/` folder.

## Load into Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** → select the `extension/dist` folder
4. Pin the extension to the toolbar
5. Click the icon → side panel opens on the right of any tab

## Connect to your account

1. In the web app, sign in and visit **/dashboard/extension**
2. Click **Generate** → copy the `sit_…` token
3. In the extension side panel, paste the token → **Connect**
4. The extension is now linked to your account and lists your interviews

## Dev workflow

`npm run dev` runs Vite in HMR mode. After the first dev build, you can keep using the loaded `dist/` (rebuild with `npm run build`) or load the dev output. For most M4-era work, the build → reload extension loop is fastest.

## What lands later

- **M5:** tab-audio capture and live STT inside the side panel
- **M6:** TTS / on-screen question delivery
- **M7:** real-time follow-up engine
