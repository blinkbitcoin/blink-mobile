/* eslint-disable */

export default () => ({
  log: (message) => {},
  recordError: (err) => {},
  crash: () => {},
  isCrashlyticsCollectionEnabled: true,
  setCrashlyticsCollectionEnabled: (enabled) => Promise.resolve(null),
  deleteUnsentReports: () => Promise.resolve(),
  sendUnsentReports: () => {},
})
