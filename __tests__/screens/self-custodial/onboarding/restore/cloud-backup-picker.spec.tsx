import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { CloudBackupPicker } from "@app/screens/self-custodial/onboarding/restore/cloud-backup-picker"
import type { CloudBackupEntry } from "@app/screens/self-custodial/onboarding/restore/hooks/use-cloud-restore"

import { ContextForScreen } from "../../../helper"
import { flushEffects } from "../../../../helpers/flush-effects"

type BuildEntryArgs = {
  fileId: string
  walletIdentifier: string
  lightningAddress?: string
  createdAt?: number
}

const buildEntry = ({
  fileId,
  walletIdentifier,
  lightningAddress,
  createdAt = 0,
}: BuildEntryArgs): CloudBackupEntry => ({
  fileId,
  metadata: {
    version: 1,
    walletIdentifier,
    lightningAddress,
    createdAt,
    encrypted: false,
  },
})

describe("CloudBackupPicker", () => {
  it("renders walletIdentifier as the only line when no lightning address is set", async () => {
    const entries = [buildEntry({ fileId: "file-1", walletIdentifier: "pubkey-1" })]
    const onSelect = jest.fn()

    const { getByText, queryAllByText } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText("pubkey-1")).toBeTruthy()
    expect(queryAllByText("pubkey-1")).toHaveLength(1)
  })

  it("renders lightning address as the title and identifier as subtitle when present", async () => {
    const entries = [
      buildEntry({
        fileId: "file-1",
        walletIdentifier: "pubkey-1",
        lightningAddress: "alice@blink.sv",
      }),
    ]
    const onSelect = jest.fn()

    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText("alice@blink.sv")).toBeTruthy()
    expect(getByText("pubkey-1")).toBeTruthy()
  })

  it("renders one row per entry", async () => {
    const entries = [
      buildEntry({
        fileId: "file-1",
        walletIdentifier: "pubkey-1",
        lightningAddress: "alice@blink.sv",
      }),
      buildEntry({ fileId: "file-2", walletIdentifier: "pubkey-2" }),
      buildEntry({
        fileId: "file-3",
        walletIdentifier: "pubkey-3",
        lightningAddress: "carol@blink.sv",
      }),
    ]
    const onSelect = jest.fn()

    const { getByTestId } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByTestId("cloud-backup-entry-file-1")).toBeTruthy()
    expect(getByTestId("cloud-backup-entry-file-2")).toBeTruthy()
    expect(getByTestId("cloud-backup-entry-file-3")).toBeTruthy()
  })

  it("invokes onSelect with the chosen entry when a row is pressed", async () => {
    const entries = [
      buildEntry({
        fileId: "file-1",
        walletIdentifier: "pubkey-1",
        lightningAddress: "alice@blink.sv",
      }),
      buildEntry({ fileId: "file-2", walletIdentifier: "pubkey-2" }),
    ]
    const onSelect = jest.fn()

    const { getByTestId } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={onSelect} />
      </ContextForScreen>,
    )
    await flushEffects()

    fireEvent.press(getByTestId("cloud-backup-entry-file-2"))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(entries[1])
  })

  it("renders no rows when entries is empty", async () => {
    const onSelect = jest.fn()

    const { queryByTestId } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={[]} onSelect={onSelect} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(queryByTestId(/^cloud-backup-entry-/)).toBeNull()
  })

  it("renders the formatted createdAt date when present", async () => {
    const createdAt = new Date("2026-03-15T10:00:00Z").getTime()
    const entries = [
      buildEntry({ fileId: "file-1", walletIdentifier: "pubkey-1", createdAt }),
    ]
    const formattedDate = new Date(createdAt).toLocaleDateString()

    const { getByText } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={jest.fn()} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(getByText(new RegExp(formattedDate.replace(/\//g, "\\/")))).toBeTruthy()
  })

  it("hides the createdAt row when the timestamp is 0 (legacy backup)", async () => {
    const entries = [
      buildEntry({ fileId: "file-1", walletIdentifier: "pubkey-1", createdAt: 0 }),
    ]
    const legacyFormatted = new Date(0).toLocaleDateString()

    const { queryByText } = render(
      <ContextForScreen>
        <CloudBackupPicker entries={entries} onSelect={jest.fn()} />
      </ContextForScreen>,
    )
    await flushEffects()

    expect(queryByText(new RegExp(legacyFormatted.replace(/\//g, "\\/")))).toBeNull()
  })
})
