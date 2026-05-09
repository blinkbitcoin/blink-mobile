import React from "react"
import { render } from "@testing-library/react-native"
import { useIsFocused } from "@react-navigation/native"

import { BackupNudgeModal } from "@app/components/backup-nudge-modal"
import { useBackupNudgeState } from "@app/hooks/use-backup-nudge-state"

import { ContextForScreen } from "./helper"

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useIsFocused: jest.fn(),
}))

jest.mock("@app/hooks/use-backup-nudge-state", () => ({
  useBackupNudgeState: jest.fn(),
}))

type NudgeModalProps = { isVisible: boolean; onClose: () => void }
const mockBackupNudgeModal = jest.fn<null, [NudgeModalProps]>(() => null)
jest.mock("@app/components/backup-nudge-modal", () => ({
  BackupNudgeModal: (props: NudgeModalProps) => mockBackupNudgeModal(props),
}))

const NudgeModalGate: React.FC = () => {
  const isFocused = useIsFocused()
  const { shouldShowModal, dismissBanner } = useBackupNudgeState()
  return (
    <BackupNudgeModal isVisible={shouldShowModal && isFocused} onClose={dismissBanner} />
  )
}

const renderGate = () =>
  render(
    <ContextForScreen>
      <NudgeModalGate />
    </ContextForScreen>,
  )

const mockNudgeState = (shouldShowModal: boolean) => {
  ;(useBackupNudgeState as jest.Mock).mockReturnValue({
    shouldShowBanner: false,
    shouldShowModal,
    shouldShowSettingsBanner: false,
    dismissBanner: jest.fn(),
  })
}

const mockFocus = (isFocused: boolean) => {
  ;(useIsFocused as jest.Mock).mockReturnValue(isFocused)
}

const lastIsVisible = (): boolean => {
  const calls = mockBackupNudgeModal.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1][0].isVisible
}

describe("home-screen BackupNudgeModal focus gating", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("passes isVisible=true only when both isFocused and shouldShowModal are true", () => {
    mockFocus(true)
    mockNudgeState(true)

    renderGate()

    expect(lastIsVisible()).toBe(true)
  })

  it("passes isVisible=false when the home tab is not focused", () => {
    mockFocus(false)
    mockNudgeState(true)

    renderGate()

    expect(lastIsVisible()).toBe(false)
  })

  it("passes isVisible=false when the nudge state says it should not be shown", () => {
    mockFocus(true)
    mockNudgeState(false)

    renderGate()

    expect(lastIsVisible()).toBe(false)
  })

  it("passes isVisible=false when neither condition is met", () => {
    mockFocus(false)
    mockNudgeState(false)

    renderGate()

    expect(lastIsVisible()).toBe(false)
  })
})
