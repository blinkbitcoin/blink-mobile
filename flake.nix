{
  description = "Galoy Mobile dev environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    nixpkgs-stable.url = "github:nixos/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
    android.url = "github:tadfisher/android-nixpkgs";
    ruby-nix.url = "github:bobvanderlinden/nixpkgs-ruby";
    ruby-nix.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = {
    self,
    nixpkgs,
    nixpkgs-stable,
    flake-utils,
    android,
    ruby-nix,
  }:
    {
      overlay = final: prev: {
        inherit (self.packages.${final.system}) android-sdk;
      };
    }
    // flake-utils.lib.eachSystem ["aarch64-darwin" "x86_64-darwin" "x86_64-linux"] (
      system: let
        overlays = [
          (self: super: {
            nodejs = super.nodejs_20;
            yarn = super.yarn.override {
              nodejs = super.nodejs_20;
            };
          })
        ];

        inherit (nixpkgs) lib;
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            self.overlay
            ruby-nix.overlays.default
          ];
        };

        pkgsStable = import nixpkgs-stable {
          inherit system;
        };

        nativeBuildInputs = with pkgs;
          [
            nodePackages.node-gyp
            yarn
            jdk17
            tilt
            alejandra
            gnumake
            docker-compose
            shellcheck
            shfmt
            vendir
            jq
            ytt

            # Overlays
            android-sdk
            nodejs
            pkgs."ruby-3.3.0"
            bundler
            fastlane
            scrcpy

            # Fix for `unf_ext` build issue
            gcc
          ]
          ++ lib.optionals stdenv.isDarwin [
            cocoapods
            watchman
            xcodes
            apple-sdk
          ];
      in {
        packages = {
          android-sdk = android.sdk.${system} (sdkPkgs:
            with sdkPkgs;
              [
                build-tools-35-0-0
                cmdline-tools-latest
                emulator
                platform-tools
                platforms-android-35
                ndk-27-3-13750724
                cmake-3-22-1
              ]
              ++ lib.optionals (system == "aarch64-darwin") [
                system-images-android-35-google-apis-arm64-v8a
                system-images-android-35-google-apis-playstore-arm64-v8a
              ]
              ++ lib.optionals (system == "x86_64-darwin" || system == "x86_64-linux") [
                system-images-android-35-google-apis-x86-64
                system-images-android-35-google-apis-playstore-x86-64
              ]);
        };

        devShells.default = pkgs.mkShell {
          inherit nativeBuildInputs;

          ANDROID_HOME = "${pkgs.android-sdk}/share/android-sdk";
          ANDROID_SDK_ROOT = "${pkgs.android-sdk}/share/android-sdk";
          JAVA_HOME = pkgs.jdk17.home;
          LD_LIBRARY_PATH = "${pkgs.stdenv.cc.cc.lib}/lib";

          shellHook = ''
            export HOST_PROJECT_PATH="$(pwd)"
            export COMPOSE_PROJECT_NAME=galoy-quickstart
            export GALOY_QUICKSTART_PATH="dev/vendor/galoy-quickstart"

            # Check if the AVD already exists
            if ! avdmanager list avd -c | grep -q Pixel_API_35; then
              # Determine ABI based on system architecture and create Pixel_API_35 Android Device
              if [ "${pkgs.stdenv.targetPlatform.system}" = "aarch64-darwin" ]; then ARCH="arm64-v8a"; else ARCH="x86_64"; fi
              echo no | avdmanager create avd --force -n Pixel_API_35 --abi "google_apis_playstore/$ARCH" --package "system-images;android-35;google_apis_playstore;$ARCH" --device 'pixel_8'
            fi

            XCODE_VERSION="16.4"
            XCODE_BUILD="16F6" # When updating xcode version, get it by running xcodes installed
            if [[ $(uname) == "Darwin" ]] && [ -z "$CI" ]; then
              sudo xcodes install $XCODE_VERSION 2>/dev/null
              sudo xcodes installed
              sudo xcodes select $XCODE_VERSION
              if ! sudo xcodes installed | grep "$XCODE_VERSION ($XCODE_BUILD) (Selected)" -q; then
                echo -e "\e[1;33m================================================\e[0m"
                echo -e "\e[1;33mXCode $XCODE_VERSION was not found or is not selected\e[0m"
                echo -e "\e[1;33mYou can install it with \e[0m\e[1;32mxcodes install $XCODE_VERSION\e[0m\e[1;33m and select it with \e[0m\e[1;32mxcodes select $XCODE_VERSION\e[0m\e[1;33m\e[0m"
                echo -e "\e[1;33miOS Builds might not work as expected if the right XCode Version is not being used\e[0m"
                echo -e "\e[1;33m================================================\e[0m"
              fi
            fi

            # Fix clang for XCode builds
            export PATH=$(echo $PATH | tr ':' '\n' | grep -v clang | paste -sd ':' -)

            # XCode needs to find this Node binary
            if [[ $(uname) == "Darwin" ]]; then
              echo "export NODE_BINARY=\"$(which node)\"" > ios/.xcode.env.local
              export DEVELOPER_DIR="$(xcodes installed | awk '/^[0-9]/ {print $NF}')/Contents/Developer"
              export PATH="$DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin:$DEVELOPER_DIR/usr/bin:$PATH"
            fi

            # Check and install Rosetta 2 on macOS to enable emulator support
            if [[ $(uname) == "Darwin" ]]; then
              processor_brand=$(/usr/sbin/sysctl -n machdep.cpu.brand_string)
              if [[ "$processor_brand" == *"Apple"* ]]; then
                echo "Apple Processor is present..."
                check_rosetta_status=$(/usr/bin/pgrep oahd)
                rosetta_folder="/Library/Apple/usr/share/rosetta"

                if [[ -n $check_rosetta_status ]] && [[ -e $rosetta_folder ]]; then
                  echo "Rosetta is installed... no action needed"
                else
                  echo "Rosetta is not installed... installing now - It is needed for running the application in a virtual emulator on your MacOS with Apple Silicon, read more here: https://developer.apple.com/documentation/apple-silicon/about-the-rosetta-translation-environment"
                  sudo /usr/sbin/softwareupdate --install-rosetta --agree-to-license
                  if /usr/bin/pgrep oahd >/dev/null 2>&1 ; then
                      echo "Rosetta is now installed"
                  else
                      echo "Rosetta installation failed"
                      exit 1
                  fi
                fi
              else
                echo "Apple Processor is not present... Rosetta is not needed"
              fi
            fi
          '';
        };
      }
    );
}
