# EnergyOS Mobile

Native mobile client for EnergyOS, built with Expo, React Native, TypeScript, and Expo Router. It is isolated from the root web app with its own `package.json` and `package-lock.json`; the repository root does not define npm workspaces.

## Run on a physical Android phone with Expo Go

1. Install **Expo Go** on the phone.
2. Connect the phone and development computer to the same Wi-Fi network.
3. From this directory, install dependencies and start the LAN development server:

   ```sh
   npm install
   npx expo start --lan
   ```

4. Scan the terminal QR code with Expo Go.

If the phone cannot reach the computer over LAN, check the firewall/router isolation or use `npx expo start --tunnel`. No Android Studio, local Android SDK, or authored Kotlin/Java is required for this Expo Go workflow. iOS physical-device development with Expo Go requires a compatible iPhone; local iOS simulator builds require macOS.

## Project layout

- `src/app/` contains Expo Router routes and layouts.
- `src/components/`, `src/constants/`, and `src/hooks/` are starter-template code; the EnergyOS product UI will be introduced in later steps.
- `app.config.ts` contains Expo app configuration.

## Commands

```sh
npm start
npx expo start --lan
npx tsc --noEmit
```

Expo Go is being used for this bootstrap. A development build will be needed later only if a required native module or configuration is not included in Expo Go.
