// The real module's methods return promises, and callers attach .catch() to them —
// returning undefined here would make a fire-and-forget log throw instead.
const logEvent = jest.fn(() => Promise.resolve())
const setAnalyticsCollectionEnabled = jest.fn(() => Promise.resolve())
const setUserId = jest.fn(() => Promise.resolve())
const setUserProperty = jest.fn(() => Promise.resolve())
const setUserProperties = jest.fn(() => Promise.resolve())

export default () => ({
  logEvent,
  setAnalyticsCollectionEnabled,
  setUserId,
  setUserProperty,
  setUserProperties,
})
