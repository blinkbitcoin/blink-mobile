# Local Development Settings for Claude

## Android Emulator Settings

When running the Android emulator for this project:

### Prerequisites
- Java 17 is required (installed via Homebrew)
- ANDROID_HOME is set to `/Users/andrejstacks/Library/Android/sdk`

### Emulator Configuration
- **AVD Name**: `Medium_Phone_API_36.1`
- **GPU**: Use `-gpu host` for better performance on Apple Silicon

### Running Android Locally

1. Start Metro bundler:
   ```bash
   yarn start
   ```

2. Start the emulator:
   ```bash
   emulator -avd Medium_Phone_API_36.1 -gpu host -no-boot-anim
   ```

3. Run the app:
   ```bash
   yarn android
   ```

4. (Optional) Set up ADB port forwarding for local backend:
   ```bash
   yarn adb
   ```

### Notes
- The project expects a `.env` file in the root for environment variables (managed by react-native-config)
- For first-time setup, ADB server may need to be started manually: `adb start-server`
