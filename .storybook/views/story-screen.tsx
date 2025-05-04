import * as React from "react"
import { PersistentStateContext } from "@app/store/persistent-state"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const PersistentStateWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <PersistentStateContext.Provider
    value={{
      persistentState: defaultPersistentState,
      updateState: () => {},
      resetState: () => {},
    }}
  >
    <>{children}</>
  </PersistentStateContext.Provider>
)

export const StoryScreen: React.FC<React.PropsWithChildren> = ({ children }) => (
  <PersistentStateWrapper>{children}</PersistentStateWrapper>
)
