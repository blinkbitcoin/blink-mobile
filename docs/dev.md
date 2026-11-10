# Development Environment
Developing the Blink  Mobile app for the Galoy Backend can be done in a variety of ways but the officially supported method is via [Nix Flake](../flake.nix) at the root of the repository.

## Prerequisites

Before you start, ensure you have the following installed on your system:

- [Nix (set up with Flakes)](https://github.com/DeterminateSystems/nix-installer) - Make sure you have flake support turned on
- [Direnv](https://direnv.net) - Hooked up to your shell
- [Docker](https://docs.docker.com/get-docker/) - Optional, only if you need the backend locally

Detailed setup process of individual components is documented in our central repository [here](https://github.com/GaloyMoney/galoy/blob/main/docs/DEVELOPMENT_ENVIRONMENT.md).

## Project Setup

Once Nix and direnv are set up, follow these steps to set up the blink-mobile project:

1. **Clone the Repository**: Clone the blink-mobile repository to your local machine using Git.

   ```bash
   git clone git@github.com:GaloyMoney/blink-mobile.git
   cd blink-mobile
   ```

1. **Allow Direnv to run it's contents**:

   ```bash
   direnv allow
   ```

   This would download all of the dependencies needed to work with the Galoy Mobile.
   This step sets up the NodeJS runtime, Android SDKs and creates the Emulator AVD for you in it's own separate chamber.
   It also builds Ruby which is needed for some dependencies.
   If you're on a Mac, it also lets you know if you're on an unsupported XCode version and gives you instructions on how to switch to a supported one.

1. **Install Node and Cocoapods(macOS) Dependencies**

   ```bash
   yarn install
   ```

### Card push provisioning SDK (optional)

Adding the Blink card to Apple Pay or Google Pay runs through the MeaWallet SDK (`@meawallet/react-native-mpp`), which lives in MeaWallet's private registry. Without access the app builds and runs the same, and the add to wallet button stays hidden.

With access, put the credentials and the configuration file Rain shared in `~/.config/blink/`:

- `meawallet-rn.env`, with `MEA_RN_USER` and `MEA_RN_PASSWORD` for the React Native package
- `mea_config`, the SDK configuration

Then run `yarn install` (or `yarn meawallet:install` on its own). It vendors the SDK to `vendor/meawallet/` and copies `mea_config` into the Android and iOS projects. None of those files are tracked by git. The SDK and its configuration go together: once either the credentials or `mea_config` is gone, the next install removes both. CI can pass `MEA_RN_USER`, `MEA_RN_PASSWORD` and `MEA_CONFIG_FILE` as environment variables instead, and the environment wins over the file for each of them.

When the registry cannot be reached or the package fails its checksum, the install goes on without the SDK, so `yarn install` still works offline. A release job that must ship the wallet sets `MEA_REQUIRED=1`, which turns any install that leaves the SDK out into a failure.

On a machine with access, `pod install` adds the `BlinkMeaConfig` and `meawallet-react-native-mpp` pods to `ios/Podfile.lock`. Never commit those lines: they belong to that machine alone, and the next contributor's `pod install` strips them again. `yarn check-code` (and `yarn check:podfile-lock` on its own) fails when the lock staged for commit carries them.

### Android Development

To run the application on Android:

1. **Start the Metro Development Server**:

   - Run `yarn start` in one terminal window. If `yarn start` fails on the first run, restart the command as it's a known issue.

1. **Start the Emulator**:
   - Run `make emulator` in one terminal. This starts the Android emulator. You can also BYOE (bring your own emulator) and run it from your Android Studio.

1. **Run the Application**:
   - In another terminal, run `yarn android`. If you encounter "error Failed to launch emulator," it's expected and won't exit the android build. Our emulator device will still be available to the Android Debug Bridge (adb).

If while running the app on the emulator, `yarn start` crashes, then just restart it and rerun the application.

<details>
<summary>TMUX One Liner</summary>

```bash
tmux new-session -d -s mySession 'yarn start' \; split-window -h 'sleep 3 && yarn android' \; select-pane -t 0 \; split-window -v 'make emulator' \; attach-session -d -t mySession
```

</details>

### iOS Development (Mac Only)

To run the application on iOS:

1. **Xcode and Simulator Setup**:
   - Make sure you have Xcode (and preferably on a version that direnv didn't complain to you about). If you don't you can download it using the `xcodes` CLI [see step](#xcode-and-simulator-setup-using-xcodes).
   - Make sure you have an XCode Simulator Runtime. You probably have it if you had XCode installed previously but you can verify it by running `open -a simulator`. If it fails, you probably don't have it and you can download it using `xcodes` as well [see step](#xcode-and-simulator-setup-using-xcodes).

1. **Start the Metro Development Server**:

   - Run `yarn start` in one terminal window.

1. **Run the Application**:
   - Run `yarn ios` to start the application on iOS.

<details>
<summary>TMUX One Liner</summary>

```bash
tmux new-session -d -s mySession 'yarn start' \; split-window -h 'yarn ios' \; attach-session -d -t mySession
```

</details>

### Happy Coding 🧑‍💻✨

---

##### XCode and Simulator Setup using xcodes

You can download XCode and Simulator blazingly fast and let the CLI do all of the set up for you hassle free.
Here are the commands that do it:

```bash
xcodes install 26.5 # Or whatever version direnv tells you about
xcodes runtimes install "iOS 26.5" # Or the latest iOS out there
```

Xcodes install for the first time prompts you for Apple ID and Password. This is because Apple's license for XCode prohibits distribution of XCode from other servers than their own. And downloads from it can only work if you are authenticated. Hence, to use XCode, you need an Apple ID.
