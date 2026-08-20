import { MAX_LOCKOUT_MS } from "@app/screens/authentication-screen/pin-lockout"
import {
  readPinLockState,
  verifyPin,
} from "@app/screens/authentication-screen/pin-verification"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

const mockRecordAppError = jest.fn()

jest.mock("@app/utils/error-reporting", () => ({
  recordAppError: (...args: unknown[]) => mockRecordAppError(...args),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getPin: jest.fn(),
    getPinFailureState: jest.fn(),
    setPinFailureState: jest.fn(),
    clearPinFailureState: jest.fn(),
  },
}))

const mockedStore = jest.mocked(KeyStoreWrapper)

const CORRECT_PIN = "1234"
const WRONG_PIN = "9999"
const NOW = 1_700_000_000_000

/** Puts the keystore in a known state before a verification. */
const storedState = ({ attempts = 0, lockedUntil = 0 } = {}) => {
  mockedStore.getPinFailureState.mockResolvedValue({
    status: "found",
    state: { attempts, lockedUntil },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockedStore.getPin.mockResolvedValue(CORRECT_PIN)
  mockedStore.setPinFailureState.mockResolvedValue(true)
  mockedStore.clearPinFailureState.mockResolvedValue(true)
  storedState()
})

describe("verifyPin", () => {
  describe("the correct pin", () => {
    it("unlocks and clears the failure state", async () => {
      storedState({ attempts: 1 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "unlocked",
      })
      expect(mockedStore.clearPinFailureState).toHaveBeenCalledTimes(1)
    })

    it("clears the failure state before reporting the unlock", async () => {
      // Awaited, so a kill immediately after unlocking cannot leave a stale
      // lock behind for the next launch.
      const order: string[] = []
      mockedStore.clearPinFailureState.mockImplementation(async () => {
        order.push("cleared")
        return true
      })
      storedState({ attempts: 1 })

      await verifyPin(CORRECT_PIN, NOW)
      order.push("returned")

      expect(order).toEqual(["cleared", "returned"])
    })

    it("still unlocks when the failure state cannot be cleared, and reports it", async () => {
      // Refusing entry over a storage fault would punish the one person who
      // just proved the PIN — but the leftover count is sticky, so it is
      // reported rather than dropped.
      mockedStore.clearPinFailureState.mockResolvedValue(false)
      storedState({ attempts: 1 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "unlocked",
      })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PIN lockout state could not be cleared",
        }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })

    it("is refused while a lock is still in force, without spending budget", async () => {
      storedState({ attempts: 1, lockedUntil: NOW + 10_000 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "locked",
        lockedUntil: NOW + 10_000,
      })
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    })
  })

  describe("the escalating schedule", () => {
    it("locks for 10s and leaves 2 attempts after the first failure", async () => {
      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "wrong",
        attemptsRemaining: 2,
        lockedUntil: NOW + 10_000,
      })
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: 1,
        lockedUntil: NOW + 10_000,
      })
    })

    it("locks for 30s and leaves 1 attempt after the second failure", async () => {
      storedState({ attempts: 1 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "wrong",
        attemptsRemaining: 1,
        lockedUntil: NOW + 30_000,
      })
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: 1 + 1,
        lockedUntil: NOW + 30_000,
      })
    })

    it("reports the budget spent on the third failure", async () => {
      storedState({ attempts: 2 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "exhausted",
      })
    })

    it("records the spent budget before reporting it", async () => {
      // A kill during the logout that follows must not hand the attempts back.
      storedState({ attempts: 2 })

      await verifyPin(WRONG_PIN, NOW)

      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: 3,
        lockedUntil: 0,
      })
    })

    it("never loses a failure across sequential verifications", async () => {
      storedState({ attempts: 1 })
      mockedStore.setPinFailureState.mockImplementation(async ({ attempts }) => {
        storedState({ attempts })
        return true
      })

      const first = await verifyPin(WRONG_PIN, NOW)
      const second = await verifyPin(WRONG_PIN, NOW + 31_000)

      expect(first.outcome).toBe("wrong")
      expect(second.outcome).toBe("exhausted")
    })
  })

  describe("the relaunch bypass", () => {
    // The screen used to hold the attempt count in React state, which starts at
    // zero. Guessing before it hydrated skipped the lock and wrote the count
    // back down. Nothing here is hydrated, and the answer is still correct.

    it("sees a stored spent budget even though nothing hydrated it", async () => {
      storedState({ attempts: 2 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "exhausted",
      })
    })

    it("never writes a lower attempt count over a higher stored one", async () => {
      storedState({ attempts: 2 })

      await verifyPin(WRONG_PIN, NOW)

      expect(mockedStore.setPinFailureState).not.toHaveBeenCalledWith(
        expect.objectContaining({ attempts: 1 }),
      )
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalledWith(
        expect.objectContaining({ lockedUntil: NOW + 10_000 }),
      )
    })

    it("refuses a guess made while a stored lock is still running", async () => {
      storedState({ attempts: 2, lockedUntil: NOW + 25_000 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "locked",
        lockedUntil: NOW + 25_000,
      })
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
    })
  })

  describe("when the failure cannot be persisted", () => {
    it("fails closed rather than letting the attempt go unrecorded", async () => {
      // An unrecorded attempt means the next one is free after a force-quit.
      mockedStore.setPinFailureState.mockResolvedValue(false)

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "unrecorded",
      })
    })

    it("reports the storage fault", async () => {
      mockedStore.setPinFailureState.mockResolvedValue(false)

      await verifyPin(WRONG_PIN, NOW)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PIN lockout could not be persisted",
        }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })
  })

  describe("when the stored pin cannot be read", () => {
    // A keystore that throws transiently is indistinguishable from a wrong PIN
    // through this library. Scoring it as one would log the user out and wipe
    // their PIN after three unlucky unlocks, without a wrong digit typed.
    const unreadable = [
      ["the read failed", null],
      ["nothing came back", ""],
    ] as const

    unreadable.forEach(([label, stored]) => {
      it(`reports it as unreadable when ${label}`, async () => {
        mockedStore.getPin.mockResolvedValue(stored)

        await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
          outcome: "unreadable",
        })
      })

      it(`spends no budget when ${label}`, async () => {
        mockedStore.getPin.mockResolvedValue(stored)
        storedState({ attempts: 2 })

        const result = await verifyPin(WRONG_PIN, NOW)

        expect(result.outcome).toBe("unreadable")
        expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
        expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      })
    })

    it("reports the fault, so support sees more than a mystery logout", async () => {
      mockedStore.getPin.mockResolvedValue(null)

      await verifyPin(CORRECT_PIN, NOW)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "PIN could not be read" }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })

    it("never unlocks", async () => {
      mockedStore.getPin.mockResolvedValue(null)

      const result = await verifyPin("", NOW)

      expect(result.outcome).not.toBe("unlocked")
    })

    it("is still refused while a lock is in force", async () => {
      mockedStore.getPin.mockResolvedValue(null)
      storedState({ attempts: 1, lockedUntil: NOW + 5_000 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "locked",
        lockedUntil: NOW + 5_000,
      })
    })
  })

  describe("when the failure state cannot be read", () => {
    it("refuses verification without comparing the PIN or changing the budget", async () => {
      mockedStore.getPinFailureState.mockResolvedValue({
        status: "failed",
        err: new Error("keystore unavailable"),
      })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "unreadable",
      })
      expect(mockedStore.getPin).not.toHaveBeenCalled()
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    })

    it("reports the read failure", async () => {
      mockedStore.getPinFailureState.mockResolvedValue({
        status: "failed",
        err: new Error("keystore unavailable"),
      })

      await verifyPin(CORRECT_PIN, NOW)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "PIN lockout state could not be read" }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })
  })
})

describe("readPinLockState", () => {
  it("normalizes genuinely absent failure state to a clean readable state", async () => {
    mockedStore.getPinFailureState.mockResolvedValue({ status: "absent" })

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: { attempts: 0, lockedUntil: 0 },
    })
    expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
  })

  it("cuts a lock that outran the schedule and repairs it in storage", async () => {
    // Without the write-back the bad value survives and re-imposes the full
    // lockout on every launch, forever.
    const farFuture = NOW + 100 * 24 * 60 * 60 * 1000
    storedState({ attempts: 1, lockedUntil: farFuture })

    const state = await readPinLockState(NOW)

    expect(state).toEqual({
      status: "readable",
      state: { attempts: 1, lockedUntil: NOW + MAX_LOCKOUT_MS },
    })
    expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
      attempts: 1,
      lockedUntil: NOW + MAX_LOCKOUT_MS,
    })
  })

  it("leaves a lock inside the schedule alone", async () => {
    storedState({ attempts: 1, lockedUntil: NOW + 20_000 })

    const state = await readPinLockState(NOW)

    expect(state).toEqual({
      status: "readable",
      state: { attempts: 1, lockedUntil: NOW + 20_000 },
    })
    expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
  })

  it("floors a negative stored attempt count at zero", async () => {
    storedState({ attempts: -3 })

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: { attempts: 0, lockedUntil: 0 },
    })
  })
})
