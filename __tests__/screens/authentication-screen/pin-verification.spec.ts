import {
  MAX_PIN_ATTEMPTS,
  readPinAttempts,
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

/** Puts the keystore in a known state before a verification. */
const storedState = ({ attempts = 0 } = {}) => {
  mockedStore.getPinFailureState.mockResolvedValue({
    status: "found",
    state: { attempts },
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
    it("unlocks and clears the attempt count", async () => {
      storedState({ attempts: 1 })

      await expect(verifyPin(CORRECT_PIN)).resolves.toEqual({ outcome: "unlocked" })
      expect(mockedStore.clearPinFailureState).toHaveBeenCalledTimes(1)
    })

    it("clears the attempt count before reporting the unlock", async () => {
      // Awaited, so a kill immediately after unlocking cannot leave a spent
      // budget behind for the next launch.
      const order: string[] = []
      mockedStore.clearPinFailureState.mockImplementation(async () => {
        order.push("cleared")
        return true
      })
      storedState({ attempts: 1 })

      await verifyPin(CORRECT_PIN)
      order.push("returned")

      expect(order).toEqual(["cleared", "returned"])
    })

    it("still unlocks when the attempt count cannot be cleared, and reports it", async () => {
      // Refusing entry over a storage fault would punish the one person who
      // just proved the PIN — but the leftover count is sticky, so it is
      // reported rather than dropped.
      mockedStore.clearPinFailureState.mockResolvedValue(false)
      storedState({ attempts: 1 })

      await expect(verifyPin(CORRECT_PIN)).resolves.toEqual({ outcome: "unlocked" })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PIN attempt count could not be cleared",
        }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })
  })

  describe("the attempt budget", () => {
    it("leaves 2 attempts after the first failure", async () => {
      await expect(verifyPin(WRONG_PIN)).resolves.toEqual({
        outcome: "wrong",
        attemptsRemaining: 2,
      })
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({ attempts: 1 })
    })

    it("leaves 1 attempt after the second failure", async () => {
      storedState({ attempts: 1 })

      await expect(verifyPin(WRONG_PIN)).resolves.toEqual({
        outcome: "wrong",
        attemptsRemaining: 1,
      })
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({ attempts: 2 })
    })

    it("reports the budget spent on the third failure", async () => {
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1 })

      await expect(verifyPin(WRONG_PIN)).resolves.toEqual({ outcome: "exhausted" })
    })

    it("reports a spent budget that could not be recorded", async () => {
      // The logout that follows keeps the lock standing, so an unrecorded
      // third failure leaves the next launch one short of the cap and grants
      // another guess against a PIN that is still there.
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1 })
      mockedStore.setPinFailureState.mockResolvedValue(false)

      await expect(verifyPin(WRONG_PIN)).resolves.toEqual({ outcome: "exhausted" })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Spent PIN budget could not be recorded",
        }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })

    it("records the spent budget before reporting it", async () => {
      // A kill during the logout that follows must not hand the attempts back.
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1 })

      await verifyPin(WRONG_PIN)

      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: MAX_PIN_ATTEMPTS,
      })
    })

    it("never loses a failure across sequential verifications", async () => {
      storedState({ attempts: 1 })
      mockedStore.setPinFailureState.mockImplementation(async ({ attempts }) => {
        storedState({ attempts })
        return true
      })

      const first = await verifyPin(WRONG_PIN)
      const second = await verifyPin(WRONG_PIN)

      expect(first.outcome).toBe("wrong")
      expect(second.outcome).toBe("exhausted")
    })
  })

  describe("the relaunch bypass", () => {
    // The screen used to hold the attempt count in React state, which starts at
    // zero. Guessing before it hydrated wrote the count back down. Nothing here
    // is hydrated, and the answer is still correct.

    it("sees a stored spent budget even though nothing hydrated it", async () => {
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1 })

      await expect(verifyPin(WRONG_PIN)).resolves.toEqual({ outcome: "exhausted" })
    })

    it("never writes a lower attempt count over a higher stored one", async () => {
      storedState({ attempts: 2 })

      await verifyPin(WRONG_PIN)

      expect(mockedStore.setPinFailureState).not.toHaveBeenCalledWith(
        expect.objectContaining({ attempts: 1 }),
      )
    })
  })

  describe("when the failure cannot be persisted", () => {
    it("fails closed rather than letting the attempt go unrecorded", async () => {
      // An unrecorded attempt means the next one is free after a force-quit.
      mockedStore.setPinFailureState.mockResolvedValue(false)

      await expect(verifyPin(WRONG_PIN)).resolves.toEqual({ outcome: "unrecorded" })
    })

    it("reports the storage fault", async () => {
      mockedStore.setPinFailureState.mockResolvedValue(false)

      await verifyPin(WRONG_PIN)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PIN attempt could not be persisted",
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

        await expect(verifyPin(CORRECT_PIN)).resolves.toEqual({ outcome: "unreadable" })
      })

      it(`spends no budget when ${label}`, async () => {
        mockedStore.getPin.mockResolvedValue(stored)
        storedState({ attempts: 2 })

        const result = await verifyPin(WRONG_PIN)

        expect(result.outcome).toBe("unreadable")
        expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
        expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      })
    })

    it("reports the fault, so support sees more than a mystery logout", async () => {
      mockedStore.getPin.mockResolvedValue(null)

      await verifyPin(CORRECT_PIN)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "PIN could not be read" }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })

    it("never unlocks", async () => {
      mockedStore.getPin.mockResolvedValue(null)

      const result = await verifyPin("")

      expect(result.outcome).not.toBe("unlocked")
    })
  })

  describe("when the attempt count cannot be read", () => {
    it("refuses verification without comparing the PIN or changing the budget", async () => {
      mockedStore.getPinFailureState.mockResolvedValue({
        status: "failed",
        err: new Error("keystore unavailable"),
      })

      await expect(verifyPin(CORRECT_PIN)).resolves.toEqual({ outcome: "unreadable" })
      expect(mockedStore.getPin).not.toHaveBeenCalled()
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    })

    it("reports the read failure", async () => {
      mockedStore.getPinFailureState.mockResolvedValue({
        status: "failed",
        err: new Error("keystore unavailable"),
      })

      await verifyPin(CORRECT_PIN)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "PIN attempt count could not be read" }),
        expect.objectContaining({ alwaysRecord: true }),
      )
    })
  })
})

describe("readPinAttempts", () => {
  it("normalizes a genuinely absent count to a clean readable state", async () => {
    mockedStore.getPinFailureState.mockResolvedValue({ status: "absent" })

    await expect(readPinAttempts()).resolves.toEqual({
      status: "readable",
      state: { attempts: 0 },
    })
    expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
  })

  it("floors a negative stored attempt count at zero", async () => {
    // A tampered slot must not widen the budget past the three guesses it grants.
    storedState({ attempts: -5 })

    await expect(readPinAttempts()).resolves.toEqual({
      status: "readable",
      state: { attempts: 0 },
    })
  })

  it("truncates a fractional stored count rather than rendering it", async () => {
    storedState({ attempts: 1.7 })

    await expect(readPinAttempts()).resolves.toEqual({
      status: "readable",
      state: { attempts: 1 },
    })
  })

  it("reports an unreadable count rather than guessing at a clean slate", async () => {
    mockedStore.getPinFailureState.mockResolvedValue({
      status: "failed",
      err: new Error("keystore unavailable"),
    })

    await expect(readPinAttempts()).resolves.toEqual({ status: "unreadable" })
  })
})
