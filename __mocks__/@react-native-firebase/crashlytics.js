/* eslint-disable */

export default () => ({
  log: (message) => {},
  recordError: (err) => {},
  isCrashlyticsCollectionEnabled: true,
  setCrashlyticsCollectionEnabled: (enabled) => Promise.resolve(null),
  checkForUnsentReports: () => Promise.resolve(false),
  deleteUnsentReports: () => Promise.resolve(),
})
