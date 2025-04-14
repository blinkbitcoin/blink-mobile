import React from "react"
import { View, Text } from "react-native"

import {
  PersistentStateProvider,
  usePersistentStateContext,
} from "@app/store/persistent-state"
import * as StateMigrations from "@app/store/persistent-state/state-migrations"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { act, render } from "@testing-library/react-native"

const MockConsumer: React.FC = () => {
  const { persistentState } = usePersistentStateContext()
  const { galoyAuthToken, schemaVersion, galoyInstance } = persistentState

  return (
    <View>
      <Text>{schemaVersion}</Text>
      <Text>{galoyAuthToken}</Text>
      <Text>{galoyInstance.id}</Text>
    </View>
  )
}

describe("PersistentStateProvider", () => {
  it("loads persistent state from storage and secure storage", async () => {
    const getSecureStorageStateSpy = jest.spyOn(KeyStoreWrapper, "getSecureStorageState")
    const migrateAndGetLocalStorageStateSpy = jest.spyOn(
      StateMigrations,
      "migrateAndGetLocalStorageState",
    )

    getSecureStorageStateSpy.mockResolvedValue({ galoyAuthToken: "myToken" })
    migrateAndGetLocalStorageStateSpy.mockResolvedValue({
      schemaVersion: 7,
      galoyInstance: { id: "Main" },
    })

    const { getByText } = render(
      <PersistentStateProvider>
        <MockConsumer />
      </PersistentStateProvider>,
    )
    await act(async () => {})

    expect(getByText("7")).toBeTruthy()
    expect(getByText("myToken")).toBeTruthy()
    expect(getByText("Main")).toBeTruthy()
  })
})
