/* eslint-disable */

export default () => ({
  log: (message) => {},
  recordError: (err) => {},
  isCrashlyticsCollectionEnabled: true,
  setCrashlyticsCollectionEnabled: (enabled) => Promise.resolve(null),
  deleteUnsentReports: () => Promise.resolve(),
})
