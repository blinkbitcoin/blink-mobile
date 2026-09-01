/**
 * The real module registers a native event emitter at import time, so any screen
 * that pulls it in through a barrel fails to load without this. Reports a
 * connected device: tests that care about the offline path override it.
 */
export const fetch = () =>
  Promise.resolve({ isConnected: true, isInternetReachable: true })

export const addEventListener = () => () => {}

export default { fetch, addEventListener }
