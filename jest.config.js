// Jest only defaults NODE_ENV to "test" when it is unset, so a shell that
// exports NODE_ENV=development leaks into the run. react-native-gesture-handler
// keys its dev-only "must be used as a descendant of GestureHandlerRootView"
// guard off NODE_ENV, which makes screen tests throw on such machines while
// passing in CI. Pin it here, before any transform or module load happens.
process.env.NODE_ENV = "test"

// On GitHub Actions each failing test becomes an annotation on its spec line, and
// each failed attempt of a retried test a RETRY annotation. The run prints no
// PASS line per file: just the failures, grouped per file at the end by the
// github-actions reporter, and the totals from the summary reporter, whose own
// list of failures would repeat them and is switched off by the threshold.
// Local runs and Concourse keep the default reporter.
const reporters = process.env.GITHUB_ACTIONS
  ? [
      ["github-actions", { silent: true }],
      ["summary", { summaryThreshold: Number.MAX_SAFE_INTEGER }],
    ]
  : ["default"]

module.exports = {
  preset: "@react-native/jest-preset",
  reporters,
  setupFiles: [
    "./node_modules/@react-native/jest-preset/jest/setup.js",
    "./node_modules/react-native-gesture-handler/jestSetup.js",
  ],
  setupFilesAfterEnv: [
    "@testing-library/jest-native/extend-expect",
    "<rootDir>/jest.setup.js",
    "<rootDir>/jest.setup-after-env.ts",
  ],
  // Stopgap against CPU-starved CI runners pushing borderline tests past the
  // 5s default (issue #3815). Genuine hangs are fixed at the source; this only
  // absorbs slow-runner tails without letting real hangs sit for a minute.
  testTimeout: 20000,
  transform: {
    // Transpile only: a type-checking program costs ~1.5 GB of heap; `yarn tsc:check` covers types.
    "\\.(ts|tsx)$": [
      "ts-jest",
      {
        // Needed on ts-jest 29.1; deprecated from 29.2 (the tsconfig setting takes over), removed in 30.
        isolatedModules: true,
        tsconfig: "<rootDir>/tsconfig.jest-transpile.json",
      },
    ],
    "\\.js$": "babel-jest",
    "^.+\\.svg$": "jest-transform-stub",
  },
  testRegex: "(/__tests__/.*\\.(test|spec))\\.(ts|tsx|js)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  rootDir: ".",
  resolver: "./node_modules/react-native-worklets/jest/resolver.js",
  moduleNameMapper: {
    "^@app/(.*)$": ["<rootDir>app/$1"],
    "^@mocks/(.*)$": ["<rootDir>__mocks__/$1"],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(react-native" +
      "|@react-native-community" +
      "|@react-native-firebase" +
      "|@react-native-firebase/auth" +
      "|@react-native" +
      "|@react-navigation" +
      "|react-native-animatable" +
      "|react-native-secure-key-store" +
      "|react-native-country-picker-modal" +
      "|react-native-error-boundary" +
      "|react-native-extended-stylesheet" +
      "|react-native-haptic-feedback" +
      "|react-native-keyboard-aware-scroll-view" +
      "|react-native-modal" +
      "|react-native-phone-number-input" +
      "|react-native-ratings" +
      "|react-native-reanimated" +
      "|react-native-worklets" +
      "|react-native-linear-gradient" +
      "|react-native-root-siblings" +
      "|react-native-screens" +
      "|react-native-size-matters" +
      "|react-native-splash-screen" +
      "|react-native-toast-message" +
      "|react-native-vector-icons" +
      "|react-navigation-tabs" +
      "|@rn-vui" +
      "|rn-qr-generator" +
      "|react-native-image-crop-picker" +
      "|react-native-currency-picker" +
      "|react-native-status-bar-height" +
      "|react-native-auto-height-image" +
      "|react-native-nfc-manager" +
      "|uuid" +
      "|@formatjs" +
      "|react-native-inappbrowser-reborn" +
      // supercluster (and its kdbush dependency) ship ESM only; Metro handles
      // that, Jest needs them transformed.
      "|supercluster" +
      "|kdbush" +
      ")/)",
  ],
}
