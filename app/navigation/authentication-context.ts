import * as React from "react"

/** The app lock's flag, apart from the navigation container that provides it, so what
 *  only reads the lock (the pop-up queue) does not load the whole container. */
export type AuthenticationContextType = {
  isAppLocked: boolean
  /**
   * The same answer without waiting for a commit, for the callers that read it outside a
   * render: a lock raised during an awaited piece of work is already true here while the
   * state, and any mirror of it, is still a commit behind. Written by the two setters, so
   * it is never the stale one.
   */
  readIsAppLocked: () => boolean
  setAppUnlocked: () => void
  setAppLocked: () => void
}

// The initial value will never be null because the provider will always pass a non null value
// eslint-disable-next-line
// @ts-ignore
const AuthenticationContext = React.createContext<AuthenticationContextType>(null)

export const AuthenticationContextProvider = AuthenticationContext.Provider

export const useAuthenticationContext = () => React.useContext(AuthenticationContext)
