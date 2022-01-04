module.exports = {
  preset: "react-native",
  setupFilesAfterEnv: ["<rootDir>/__tests__/helpers/jest.setup.js"],
  transform: {
    "\\.(ts|tsx)$": "ts-jest",
    "^.+\\.svg$": "jest-transform-stub",
  },
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.jest.json",
    },
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
      "|@react-native" +
      "|react-navigation-tabs" +
      "|react-native-animatable" +
      "|react-native-camera" +
      "|react-native-elements" +
      "|react-native-extended-stylesheet" +
      "|react-native-haptic-feedback" +
      "|react-native-image-picker" +
      "|react-native-modal" +
      "|react-native-splash-screen" +
      "|react-native-screens" +
      "|react-native-size-matters" +
      "|react-native-ratings" +
      "|react-native-reanimated" +
      "|react-native-root-siblings" +
      "|react-native-root-toast" +
      "|react-native-vector-icons" +
      "|react-native-phone-number-input" +
      "|react-native-country-picker-modal" +
      "|@react-native-firebase/auth" +
      "|@react-native-firebase" +
      "|@react-navigation" +
      "|@react-native-community" +
      "|react-native-error-boundary" +
      ")/)",
  ],
}
