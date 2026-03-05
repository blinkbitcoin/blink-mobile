module.exports = {
  preset: "react-native",
  setupFiles: ["./node_modules/react-native-gesture-handler/jestSetup.js"],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  transform: {
    "\\.(ts|tsx)$": [
      "ts-jest",
      {
        compiler: "ttsc",
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
    "^.+\\.svg$": "jest-transform-stub",
  },
  testRegex: "(/__tests__/.*\\.(test|spec))\\.(ts|tsx|js)$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  rootDir: ".",
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
      ")/)",
  ],
}
