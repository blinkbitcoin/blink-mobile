import React from "react"

import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { act, renderHook, waitFor } from "@testing-library/react-native"

import {
  EmergencyRecoveryStep,
  useEmergencyRecovery,
} from "@app/screens/self-custodial/onboarding/restore/emergency/hooks/use-emergency-recovery"
import { BundleFilePickStatus } from "@app/self-custodial/recovery-bundle/bundle-file"
import { EmergencyBundleRejection } from "@app/self-custodial/recovery-bundle/emergency-recovery"
import { CloudBackupErrorReason } from "@app/types/cloud-backup"

const MNEMONIC = "abandon abandon about"
const FILE_NAME = "blink-spark-recovery-bundle-regtest-02ab.json"
const PAYLOAD = '{"schema":"blink.recovery-bundle-backup.v1"}'

const mockSilentFetch = jest.fn()
const mockExpectedFilename = jest.fn()
const mockVerify = jest.fn()
const mockPickFile = jest.fn()
const mockClipboardGet = jest.fn()
const mockStartSession = jest.fn()
const mockDownloadById = jest.fn()
const mockShareOpen = jest.fn()
const mockToastShow = jest.fn()
const mockReportError = jest.fn()

jest.mock("@react-native-clipboard/clipboard", () => ({
  __esModule: true,
  default: { getString: (...args: readonly unknown[]) => mockClipboardGet(...args) },
}))

jest.mock("react-native-share", () => ({
  __esModule: true,
  default: { open: (...args: readonly unknown[]) => mockShareOpen(...args) },
}))

jest.mock("@app/self-custodial/recovery-bundle/cloud", () => ({
  attemptSilentCloudFetch: (...args: readonly unknown[]) => mockSilentFetch(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/emergency-recovery", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/emergency-recovery"),
  expectedBundleFilename: (...args: readonly unknown[]) => mockExpectedFilename(...args),
  verifyEmergencyBundle: (...args: readonly unknown[]) => mockVerify(...args),
}))

jest.mock("@app/self-custodial/recovery-bundle/bundle-file", () => ({
  ...jest.requireActual("@app/self-custodial/recovery-bundle/bundle-file"),
  pickEmergencyBundleFile: (...args: readonly unknown[]) => mockPickFile(...args),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
}))

jest.mock("@app/self-custodial/config", () => ({
  networkLabelFor: () => "regtest",
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: readonly unknown[]) => mockReportError(...args),
}))

jest.mock(
  "@app/screens/self-custodial/onboarding/hooks/use-platform-cloud-backup",
  () => ({
    usePlatformCloudBackup: () => ({
      startSession: mockStartSession,
      downloadById: mockDownloadById,
      resolveErrorMessage: (reason: string) => `cloud error: ${reason}`,
      loading: false,
    }),
  }),
)

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      EmergencyRecovery: {
        notInCloud: () => "No emergency bundle in your cloud",
        clipboardEmpty: () => "Nothing on the clipboard",
        fileUnreadable: () => "That file could not be read",
        sourceFailed: () => "Could not fetch the emergency bundle",
      },
    },
  }),
}))

const verifiedResult = {
  bundle: { leaves: [{ valueSats: 21000 }] },
  metadata: { bundleCreatedAt: "2026-08-05T10:00:00.000Z" },
  payload: PAYLOAD,
}

const renderRecovery = () => renderHook(() => useEmergencyRecovery(MNEMONIC))

/** The automatic attempt runs on mount, so every test starts after it lands. */
const renderAtStep = async (step: EmergencyRecoveryStep) => {
  const rendered = renderRecovery()
  await waitFor(() => expect(rendered.result.current.step).toBe(step))
  return rendered
}

describe("useEmergencyRecovery", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExpectedFilename.mockResolvedValue(FILE_NAME)
    mockSilentFetch.mockResolvedValue({
      success: false,
      reason: CloudBackupErrorReason.Auth,
    })
    mockVerify.mockResolvedValue({ verified: true, result: verifiedResult })
    mockClipboardGet.mockResolvedValue(PAYLOAD)
    mockPickFile.mockResolvedValue({
      status: BundleFilePickStatus.Picked,
      content: PAYLOAD,
    })
    mockStartSession.mockResolvedValue({
      success: true,
      session: { accessToken: "token", existingFileId: "file-1" },
    })
    mockDownloadById.mockResolvedValue({ success: true, content: PAYLOAD })
    mockShareOpen.mockResolvedValue(undefined)
  })

  describe("the automatic attempt", () => {
    it("starts by verifying, not by asking", async () => {
      mockSilentFetch.mockResolvedValue({ success: true, content: PAYLOAD })
      // A user whose bundle is already in their cloud should never see the
      // upload screen at all.
      const { result } = renderRecovery()

      expect(result.current.step).toBe(EmergencyRecoveryStep.Verifying)
      await waitFor(() =>
        expect(result.current.step).toBe(EmergencyRecoveryStep.Verified),
      )
    })

    it("looks for the file this phrase names, without a sign-in prompt", async () => {
      mockSilentFetch.mockResolvedValue({ success: true, content: PAYLOAD })
      await renderAtStep(EmergencyRecoveryStep.Verified)

      expect(mockExpectedFilename).toHaveBeenCalledWith(
        MNEMONIC,
        mockSparkNetwork.Regtest,
      )
      expect(mockSilentFetch).toHaveBeenCalledWith(FILE_NAME)
      expect(mockStartSession).not.toHaveBeenCalled()
    })

    it("asks where the bundle is only once nothing was found", async () => {
      mockSilentFetch.mockResolvedValue({
        success: false,
        reason: CloudBackupErrorReason.NotFound,
      })
      await renderAtStep(EmergencyRecoveryStep.Sources)

      expect(mockVerify).not.toHaveBeenCalled()
      // An unlinked cloud is the normal case here, not an incident.
      expect(mockReportError).not.toHaveBeenCalled()
    })

    it("asks where the bundle is when the lookup itself breaks", async () => {
      mockExpectedFilename.mockRejectedValue(new Error("derivation failed"))
      await renderAtStep(EmergencyRecoveryStep.Sources)

      expect(mockReportError).toHaveBeenCalled()
    })

    it("runs once even when React mounts the effect twice", async () => {
      // StrictMode double-invokes effects in development; a second silent fetch
      // would race the first and could land the user on the older verdict.
      mockSilentFetch.mockResolvedValue({ success: true, content: PAYLOAD })
      const { result } = renderHook(() => useEmergencyRecovery(MNEMONIC), {
        wrapper: React.StrictMode,
      })
      await waitFor(() =>
        expect(result.current.step).toBe(EmergencyRecoveryStep.Verified),
      )

      expect(mockSilentFetch).toHaveBeenCalledTimes(1)
    })

    it("runs once, not on every render", async () => {
      mockSilentFetch.mockResolvedValue({ success: true, content: PAYLOAD })
      const { rerender } = await renderAtStep(EmergencyRecoveryStep.Verified)
      rerender({})

      expect(mockSilentFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe("verification outcomes", () => {
    beforeEach(() => {
      mockSilentFetch.mockResolvedValue({ success: true, content: PAYLOAD })
    })

    it("moves on from verified by itself", async () => {
      jest.useFakeTimers()
      try {
        const { result } = renderRecovery()
        await waitFor(() =>
          expect(result.current.step).toBe(EmergencyRecoveryStep.Verified),
        )

        act(() => {
          jest.advanceTimersByTime(2000)
        })

        expect(result.current.step).toBe(EmergencyRecoveryStep.Summary)
        expect(result.current.verified).toEqual(verifiedResult)
      } finally {
        jest.useRealTimers()
      }
    })

    it("does not move on while the user is still reading", async () => {
      jest.useFakeTimers()
      try {
        const { result } = renderRecovery()
        await waitFor(() =>
          expect(result.current.step).toBe(EmergencyRecoveryStep.Verified),
        )

        act(() => {
          jest.advanceTimersByTime(500)
        })

        expect(result.current.step).toBe(EmergencyRecoveryStep.Verified)
      } finally {
        jest.useRealTimers()
      }
    })

    it("does not advance a screen the user has left", async () => {
      jest.useFakeTimers()
      try {
        const { result, unmount } = renderRecovery()
        await waitFor(() =>
          expect(result.current.step).toBe(EmergencyRecoveryStep.Verified),
        )
        unmount()

        expect(() => {
          act(() => {
            jest.advanceTimersByTime(2000)
          })
        }).not.toThrow()
      } finally {
        jest.useRealTimers()
      }
    })

    it("reports which way the bundle failed", async () => {
      mockVerify.mockResolvedValue({
        verified: false,
        rejection: EmergencyBundleRejection.WrongPhrase,
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Rejected)

      expect(result.current.rejection).toBe(EmergencyBundleRejection.WrongPhrase)
      expect(result.current.verified).toBeNull()
    })

    it("goes back to the sources on try-again, with the rejection cleared", async () => {
      mockVerify.mockResolvedValue({
        verified: false,
        rejection: EmergencyBundleRejection.NotABundle,
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Rejected)

      act(() => {
        result.current.tryAnotherSource()
      })

      expect(result.current.step).toBe(EmergencyRecoveryStep.Sources)
      // A stale rejection would flash the old failure over the next attempt.
      expect(result.current.rejection).toBeNull()
    })

    it("clears an earlier rejection once a later bundle verifies", async () => {
      mockVerify.mockResolvedValue({
        verified: false,
        rejection: EmergencyBundleRejection.NotABundle,
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Rejected)
      mockVerify.mockResolvedValue({ verified: true, result: verifiedResult })

      await act(async () => {
        await result.current.fromClipboard()
      })

      expect(result.current.step).toBe(EmergencyRecoveryStep.Verified)
      expect(result.current.rejection).toBeNull()
    })
  })

  describe("the three sources", () => {
    beforeEach(() => {
      mockSilentFetch.mockResolvedValue({
        success: false,
        reason: CloudBackupErrorReason.NotFound,
      })
    })

    it("hands cloud, clipboard and file to the same verifier", async () => {
      // Three buttons, one code path: they cannot drift apart in what they
      // accept.
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      for (const source of [
        result.current.fromCloud,
        result.current.fromClipboard,
        result.current.fromFile,
      ]) {
        mockVerify.mockClear()
        await act(async () => {
          await source()
        })
        expect(mockVerify).toHaveBeenCalledWith(PAYLOAD, MNEMONIC)
      }
    })

    it("signs in interactively for the cloud, having already tried silently", async () => {
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromCloud()
      })

      expect(mockStartSession).toHaveBeenCalledWith(FILE_NAME)
      expect(mockDownloadById).toHaveBeenCalledWith("file-1", "token")
    })

    it("says so when the cloud holds no bundle for this phrase", async () => {
      mockStartSession.mockResolvedValue({
        success: true,
        session: { accessToken: "token", existingFileId: undefined },
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromCloud()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "No emergency bundle in your cloud" }),
      )
      expect(result.current.step).toBe(EmergencyRecoveryStep.Sources)
    })

    it("surfaces the provider's reason when sign-in fails", async () => {
      mockStartSession.mockResolvedValue({
        success: false,
        reason: CloudBackupErrorReason.Cancelled,
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromCloud()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "cloud error: cancelled" }),
      )
      expect(mockDownloadById).not.toHaveBeenCalled()
    })

    it("surfaces the provider's reason when the download fails", async () => {
      mockDownloadById.mockResolvedValue({
        success: false,
        reason: CloudBackupErrorReason.Transient,
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromCloud()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "cloud error: transient" }),
      )
      expect(mockVerify).not.toHaveBeenCalled()
    })

    it("reports an unexpected cloud failure without crashing the screen", async () => {
      mockStartSession.mockRejectedValue(new Error("boom"))
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromCloud()
      })

      expect(mockReportError).toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not fetch the emergency bundle" }),
      )
    })

    it("trims what it takes off the clipboard", async () => {
      // Copying out of a password manager routinely picks up a trailing
      // newline, which would fail the JSON parse for no reason.
      mockClipboardGet.mockResolvedValue(`  ${PAYLOAD}\n`)
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromClipboard()
      })

      expect(mockVerify).toHaveBeenCalledWith(PAYLOAD, MNEMONIC)
    })

    it("says so when the clipboard is empty", async () => {
      mockClipboardGet.mockResolvedValue("   ")
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromClipboard()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Nothing on the clipboard" }),
      )
      expect(mockVerify).not.toHaveBeenCalled()
    })

    it("stays quiet when the user backs out of the file picker", async () => {
      mockPickFile.mockResolvedValue({ status: BundleFilePickStatus.Cancelled })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromFile()
      })

      expect(mockToastShow).not.toHaveBeenCalled()
      expect(result.current.step).toBe(EmergencyRecoveryStep.Sources)
    })

    it("says so when the picked file cannot be read", async () => {
      mockPickFile.mockResolvedValue({ status: BundleFilePickStatus.Unreadable })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.fromFile()
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "That file could not be read" }),
      )
      expect(mockVerify).not.toHaveBeenCalled()
    })

    it("runs one source at a time", async () => {
      // Two overlapping attempts would race to set the step, landing the user
      // on the verdict of whichever finished last.
      let release: (value: string) => void = () => {}
      mockClipboardGet.mockReturnValue(
        new Promise<string>((resolve) => {
          release = resolve
        }),
      )
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      let first: Promise<void> = Promise.resolve()
      await act(async () => {
        first = result.current.fromClipboard()
      })
      expect(result.current.busy).toBe(true)

      await act(async () => {
        await result.current.fromFile()
      })
      expect(mockPickFile).not.toHaveBeenCalled()

      await act(async () => {
        release(PAYLOAD)
        await first
      })
      expect(result.current.busy).toBe(false)
    })
  })

  describe("exporting the verified bundle", () => {
    const atSummary = async () => {
      jest.useFakeTimers()
      mockSilentFetch.mockResolvedValue({ success: true, content: PAYLOAD })
      const rendered = renderRecovery()
      await waitFor(() =>
        expect(rendered.result.current.step).toBe(EmergencyRecoveryStep.Verified),
      )
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      jest.useRealTimers()
      return rendered
    }

    it("shares the bundle as a file", async () => {
      // The user may have pasted it out of a password manager; the recovery
      // tooling takes a file.
      const { result } = await atSummary()

      await act(async () => {
        await result.current.exportBundle()
      })

      expect(mockShareOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "blink-recovery-bundle-regtest.json",
          type: "application/json",
        }),
      )
    })

    it("says nothing when the user dismisses the share sheet", async () => {
      mockShareOpen.mockRejectedValue(new Error("User did not share"))
      const { result } = await atSummary()

      await act(async () => {
        await result.current.exportBundle()
      })

      expect(mockToastShow).not.toHaveBeenCalled()
      expect(mockReportError).not.toHaveBeenCalled()
    })

    it("reports a genuine share failure", async () => {
      mockShareOpen.mockRejectedValue(new Error("no room on device"))
      const { result } = await atSummary()

      await act(async () => {
        await result.current.exportBundle()
      })

      expect(mockReportError).toHaveBeenCalled()
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Could not fetch the emergency bundle" }),
      )
    })

    it("does nothing before anything has been verified", async () => {
      mockSilentFetch.mockResolvedValue({
        success: false,
        reason: CloudBackupErrorReason.NotFound,
      })
      const { result } = await renderAtStep(EmergencyRecoveryStep.Sources)

      await act(async () => {
        await result.current.exportBundle()
      })

      expect(mockShareOpen).not.toHaveBeenCalled()
    })
  })
})
