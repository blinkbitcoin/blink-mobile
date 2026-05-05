import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { CloudBackupPicker } from "@app/screens/spark-onboarding/restore/cloud-backup-picker"
import type { CloudBackupEntry } from "@app/screens/spark-onboarding/restore/hooks/use-cloud-restore"

import { ContextForScreen } from "../../helper"

const buildEntry = (
  fileId: string,
  walletIdentifier: string,
  lightningAddress?: string,
): CloudBackupEntry => ({
  fileId,
  metadata: {
    version: 1,
    walletIdentifier,
    lightningAddress,
    createdAt: 0,
    encrypted: false,
  },
})

describe("CloudBackupPicker", () => {
  it("renders walletIdentifier as the only line when no lightning address is set", () => {
    const entries = [buildEntry("file-1", "pubkey-1")]
    const onSelect = jest.fn()

    const { getByText, queryAllByText } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )

    expect(getByText("pubkey-1")).toBeTruthy()
    expect(queryAllByText("pubkey-1")).toHaveLength(1)
  })

  it("renders lightning address as the title and identifier as subtitle when present", () => {
    const entries = [buildEntry("file-1", "pubkey-1", "alice@blink.sv")]
    const onSelect = jest.fn()

    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )

    expect(getByText("alice@blink.sv")).toBeTruthy()
    expect(getByText("pubkey-1")).toBeTruthy()
  })

  it("renders one row per entry", () => {
    const entries = [
      buildEntry("file-1", "pubkey-1", "alice@blink.sv"),
      buildEntry("file-2", "pubkey-2"),
      buildEntry("file-3", "pubkey-3", "carol@blink.sv"),
    ]
    const onSelect = jest.fn()

    const { getByTestId } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )

    expect(getByTestId("cloud-backup-entry-file-1")).toBeTruthy()
    expect(getByTestId("cloud-backup-entry-file-2")).toBeTruthy()
    expect(getByTestId("cloud-backup-entry-file-3")).toBeTruthy()
  })

  it("invokes onSelect with the chosen entry when a row is pressed", () => {
    const entries = [
      buildEntry("file-1", "pubkey-1", "alice@blink.sv"),
      buildEntry("file-2", "pubkey-2"),
    ]
    const onSelect = jest.fn()

    const { getByTestId } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )

    fireEvent.press(getByTestId("cloud-backup-entry-file-2"))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(entries[1])
  })

  it("renders no rows when entries is empty", () => {
    const onSelect = jest.fn()

    const { queryByTestId } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={[]} onSelect={onSelect} />
      </ContextForScreen>,
    )

    expect(queryByTestId(/^cloud-backup-entry-/)).toBeNull()
  })
})
