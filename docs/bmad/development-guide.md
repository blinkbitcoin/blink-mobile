# Blink Mobile Development Guide

## Prerequisites

### Required Software
- **Nix** with flakes support ([Install](https://github.com/DeterminateSystems/nix-installer))
- **direnv** hooked up to your shell
- **Xcode** (iOS development, macOS only)
- **Android Studio** (Android development)
- **Docker** (optional, for local backend)

### Node.js
The project requires Node.js >= 20. This is automatically provided by Nix flakes.

## Environment Setup

### 1. Clone Repository
```bash
git clone git@github.com:GaloyMoney/blink-mobile.git
cd blink-mobile
```

### 2. Initialize Nix Environment
```bash
direnv allow
```

This command:
- Downloads all dependencies via Nix
- Sets up Node.js runtime
- Configures Android SDK and creates emulator AVD
- Builds Ruby for native dependencies
- Validates Xcode version (macOS)

### 3. Install Dependencies
```bash
yarn install
```

This also runs `pod install` for iOS on macOS.

## Running the Application

### iOS Development (macOS only)

1. **Start Metro bundler:**
   ```bash
   yarn start
   ```

2. **Run on iOS Simulator:**
   ```bash
   yarn ios
   ```

**One-liner with tmux:**
```bash
tmux new-session -d -s mySession 'yarn start' \; split-window -h 'yarn ios' \; attach-session -d -t mySession
```

### Android Development

1. **Start Metro bundler:**
   ```bash
   yarn start
   ```

2. **Start Android emulator:**
   ```bash
   make emulator
   ```

3. **Run on Android:**
   ```bash
   yarn android
   ```

**One-liner with tmux:**
```bash
tmux new-session -d -s mySession 'yarn start' \; split-window -h 'sleep 3 && yarn android' \; select-pane -t 0 \; split-window -v 'make emulator' \; attach-session -d -t mySession
```

## Development Commands

### Essential Commands

| Command | Description |
|---------|-------------|
| `yarn start` | Start Metro development server |
| `yarn ios` | Run on iOS simulator |
| `yarn android` | Run on Android emulator |
| `yarn check-code` | Run all code quality checks |
| `yarn test` | Run unit tests |

### Code Quality

| Command | Description |
|---------|-------------|
| `yarn tsc:check` | TypeScript compilation check |
| `yarn eslint:check` | ESLint validation |
| `yarn eslint:fix` | Auto-fix ESLint issues |
| `yarn check:translations` | Verify translation files |
| `yarn check:codegen` | Verify GraphQL codegen |
| `yarn graphql-check` | Validate GraphQL operations |

### Code Generation

| Command | Description |
|---------|-------------|
| `yarn dev:codegen` | Generate GraphQL types and hooks |
| `yarn update-translations` | Update i18n types and files |
| `yarn fonts` | Link font assets to native projects |

### Testing

| Command | Description |
|---------|-------------|
| `yarn test` | Run unit tests with Jest |
| `yarn coverage` | Run tests with coverage |
| `yarn e2e:build [config]` | Build for E2E testing |
| `yarn e2e:test [config]` | Run E2E tests |

**E2E Test Configurations:**
- `ios.sim.debug` - iOS Simulator debug build
- `android.emu.debug` - Android Emulator debug build

### Utility Commands

| Command | Description |
|---------|-------------|
| `yarn storybook` | Start Storybook server |
| `yarn cache:clear` | Clear all caches |
| `yarn adb` | Configure ADB port forwarding |
| `yarn bundle-visualizer` | Analyze bundle size |

## Development Workflow

### Before Committing

Always run the full check:
```bash
yarn check-code
```

This validates:
1. TypeScript compilation
2. ESLint rules
3. Translation file consistency
4. GraphQL codegen freshness
5. GraphQL operation validity

### Adding Translation Keys

1. Add new key to `app/i18n/en/index.ts`
2. Run `yarn update-translations`
3. Key is now available with type safety

**Warning:** Never edit files in `app/i18n/raw-i18n/` directly.

### Modifying GraphQL Operations

1. Update queries/mutations in source files
2. Run `yarn dev:codegen`
3. Import generated hooks from `@app/graphql/generated`

### Adding New Fonts

1. Add font files to `app/assets/fonts/`
2. Run `yarn fonts`
3. Fonts appear in `ios/GaloyApp/Info.plist` and `android/app/src/main/assets/fonts/`

## Working with Backend

### Backend Instances

Configure in `app/config/galoy-instances.ts`:

| Instance | GraphQL URL | Purpose |
|----------|-------------|---------|
| Main | `https://api.blink.sv/graphql` | Production |
| Staging | `https://api.staging.blink.sv/graphql` | Testing |
| Local | `http://localhost:4455/graphql` | Development |

### Local Backend Setup

1. Clone the backend repository:
   ```bash
   cd ..
   git clone git@github.com:GaloyMoney/galoy.git blink
   ```

2. Follow backend setup instructions
3. Run `make tilt-up` in backend directory
4. Use "Local" instance in app

## Testing

### Unit Tests

```bash
yarn test                 # All tests
yarn test --watch         # Watch mode
yarn test [pattern]       # Filter by name
```

Tests are located in `__tests__/` with `.spec.ts` or `.spec.tsx` extensions.

### Component Testing (Storybook)

1. **Start Storybook server:**
   ```bash
   yarn storybook
   ```

2. **Enable in app:**
   Set `SHOW_STORYBOOK` to `true` in `index.js`

3. **Reload app** and navigate stories

Stories are in `*.stories.tsx` files alongside components.

### E2E Testing (Detox)

**iOS:**
```bash
yarn e2e:build ios.sim.debug
yarn e2e:test ios.sim.debug
```

**Android:**
```bash
yarn e2e:build android.emu.debug
yarn e2e:test android.emu.debug
```

**With local backend:**
1. Start backend: `make tilt-up`
2. Keep `yarn start` running
3. Run E2E tests

### E2E Testing (Appium - Legacy)

```bash
npm install -g appium@next
appium driver install uiautomator2
appium driver install xcuitest

yarn start:appium
yarn test:e2e:android  # or yarn test:e2e:ios
```

## Debugging

### React Native Debugger

1. Disable Hermes in Android: Set `hermesEnabled=false` in `android/gradle.properties`
2. Install [react-native-debugger](https://github.com/jhen0409/react-native-debugger)
3. Open debugger and connect

### Chrome DevTools

1. Open app on device/simulator
2. Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
3. Select "Debug with Chrome"

### Apollo DevTools

Use react-native-debugger which includes Apollo DevTools for:
- Viewing GraphQL cache
- Inspecting queries/mutations
- Monitoring subscriptions

## Code Style

### TypeScript

- Strict mode enabled
- Path alias: `@app/*` → `app/*`
- No implicit any

### Component Structure

```typescript
// ComponentName.tsx
import { ... } from "..."

// Types
type Props = {
  // ...
}

// Component
export const ComponentName: React.FC<Props> = ({ ... }) => {
  // hooks
  // logic
  // return JSX
}

// Styles (if using makeStyles)
const useStyles = makeStyles(({ colors }) => ({
  // ...
}))
```

### Test Files

- Unit tests: `__tests__/**/*.spec.ts(x)`
- Stories: `**/*.stories.tsx`
- E2E tests: `e2e/**/*.e2e.ts`

## Troubleshooting

### Metro Issues
```bash
yarn cache:clear
yarn start --reset-cache
```

### iOS Build Issues
```bash
cd ios
pod deintegrate
pod install --repo-update
```

### Android Build Issues
```bash
cd android
./gradlew clean
```

### Xcode Version Issues
If direnv warns about Xcode version:
```bash
xcodes install 16.4
xcodes runtimes install "iOS 18.5"
```

### Appium Issues
```bash
yarn appium-doctor
```

## External Libraries

### Local Development with galoy-client

Since Metro doesn't support `yarn link`, use [yalc](https://www.npmjs.com/package/yalc):

**Add local dependency:**
```bash
# In galoy-client: yalc publish
npx yalc add @blinkbitcoin/blink-client
```

**Remove before committing:**
```bash
npx yalc remove @blinkbitcoin/blink-client
```

## Platform Notes

### M1 Mac Notes

The app builds for x86_64 simulators. For newer iOS versions:
1. Open Xcode in Rosetta mode
2. Choose an x86_64 simulator
3. Build from Xcode

### NFC Support

NFC payments supported on compatible devices. Platform availability:
- iOS: iPhone 7 and later
- Android: Devices with NFC capability

---

*Generated by BMAD Document Project Workflow*
