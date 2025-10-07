# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `yarn check-code` - Run TypeScript check, ESLint, translation check, codegen check, and GraphQL validation
- `yarn test` - Run unit tests with Jest
- `yarn start` - Start Metro development server
- `yarn ios` - Run on iOS simulator
- `yarn android` - Run on Android emulator
- `make emulator` - Start Android emulator (Pixel_API_35)

### Code Quality and Validation
- `yarn tsc:check` - TypeScript compilation check
- `yarn eslint:check` - ESLint validation
- `yarn eslint:fix` - Auto-fix ESLint issues
- `yarn update-translations` - Update translation types and files
- `yarn dev:codegen` - Generate GraphQL types and operations

### Testing
- `yarn test` - Unit tests (run with `--runInBand --forceExit`)
- `yarn e2e:build android.emu.debug` - Build for Android E2E tests
- `yarn e2e:test android.emu.debug` - Run Android E2E tests
- `yarn e2e:build ios.sim.debug` - Build for iOS E2E tests
- `yarn e2e:test ios.sim.debug` - Run iOS E2E tests

### Development Environment Setup
The project uses Nix flakes for development environment:
1. Ensure Nix with flakes and direnv are installed
2. Run `direnv allow` to set up the environment
3. Run `yarn install` to install dependencies

## Project Architecture

### Core Structure
- **App Entry**: `app/app.tsx` - Main React component with provider hierarchy
- **Navigation**: `app/navigation/root-navigator.tsx` - React Navigation stack and tab navigators
- **GraphQL Client**: `app/graphql/client.tsx` - Apollo Client setup with authentication, caching, and WebSocket support
- **State Management**: `app/store/persistent-state/` - Persistent state using AsyncStorage
- **Internationalization**: `app/i18n/` - TypeSafe i18n with multiple language support

### Key Patterns
- **Provider Hierarchy**: App wraps multiple context providers (PersistentState, TypesafeI18n, GaloyClient, GaloyTheme, etc.)
- **GraphQL Architecture**: Uses Apollo Client with cache persistence, error handling, and retry logic
- **Navigation**: Stack-based navigation with authentication flow and main tab navigator (Home, People, Map, Earn)
- **Component Structure**: Atomic design with reusable components in `app/components/`
- **Screen Organization**: Feature-based screen organization in `app/screens/`

### Important Configurations
- **TypeScript**: Path mapping with `@app/*` alias pointing to `app/*`
- **GraphQL**: Code generation from `codegen.yml` creates typed hooks and operations
- **Testing**: Jest with React Native Testing Library and custom test utilities
- **Build**: React Native 0.76.9 with platform-specific configurations

### Authentication & Security
- Token-based authentication with Bearer tokens
- App Check integration for Firebase security
- Biometric authentication support
- Secure storage for sensitive data

### Development Workflow
1. Always run `yarn check-code` before committing
2. Use `yarn update-translations` when adding new translation keys
3. Run `yarn dev:codegen` when GraphQL schema changes
4. Follow existing component patterns and use TypeScript strictly
5. Test on both iOS and Android platforms

### Testing Strategy
- Unit tests in `__tests__/` with `.spec.ts` or `.spec.tsx` extensions
- E2E tests using Detox for native testing and Appium for cross-platform testing
- Component testing with Storybook (stories in `.stories.tsx` files)
- GraphQL mocking for isolated testing

### Localization
- Translation keys in `app/i18n/en/index.ts`
- TypeSafe i18n generates types automatically
- Support for 25+ languages with fallback to English
- Add new keys to English file, then run `yarn update-translations`

### Mobile-Specific Considerations
- Platform-specific code using `isIos` utility
- React Native asset management with custom fonts and SVG icons
- Deep linking and universal link support
- Push notifications via Firebase
- NFC payment support on compatible devices