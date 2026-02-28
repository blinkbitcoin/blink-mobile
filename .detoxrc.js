/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/detox/jest.config.js",
    },
    jest: {
      setupTimeout: 240000,
    },
  },
  apps: {
    "ios.debug": {
      type: "ios.app",
      binaryPath: "ios/build/Build/Products/Debug-iphonesimulator/Blink.app",
      build:
        "xcodebuild -workspace ios/GaloyApp.xcworkspace -scheme GaloyApp " +
        "-configuration Debug -sdk iphonesimulator " +
        "-destination 'platform=iOS Simulator,name=iPhone SE (3rd generation)' " +
        "-derivedDataPath ios/build " +
        "-parallelizeTargets " +
        "-jobs 8 " +
        "ONLY_ACTIVE_ARCH=YES " +
        "COMPILER_INDEX_STORE_ENABLE=NO " +
        "BUILD_LIBRARY_FOR_DISTRIBUTION=NO " +
        "CODE_SIGNING_REQUIRED=NO " +
        "CODE_SIGN_IDENTITY='' " +
        "ENABLE_BITCODE=NO " +
        "GCC_OPTIMIZATION_LEVEL=0 " +
        "SWIFT_OPTIMIZATION_LEVEL=-Onone " +
        "-quiet",
    },
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-universal-debug.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk",
      build:
        "cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug",
      reversePorts: [8081],
    },
  },
  devices: {
    simulator: {
      type: "ios.simulator",
      device: {
        type: "iPhone SE (3rd generation)",
      },
    },
    emulator: {
      type: "android.emulator",
      device: {
        avdName: "Pixel_API_34",
      },
    },
  },
  configurations: {
    "ios.sim.debug": {
      device: "simulator",
      app: "ios.debug",
    },
    "android.emu.debug": {
      device: "emulator",
      app: "android.debug",
    },
  },
}
