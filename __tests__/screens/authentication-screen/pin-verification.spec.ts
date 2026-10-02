import { it } from "@jest/globals"

import {
  MAX_PIN_ATTEMPTS,
  readPinLockState,
  verifyPin,
} from "@app/screens/authentication-screen/pin-verification"
import KeyStoreWrapper, { PinFailureState } from "@app/utils/storage/secureStorage"

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
const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS

/** Puts the keystore in a known state before a verification. */
const storedState = ({ attempts = 0, lockedUntil = 0 } = {}) => {
  mockedStore.getPinFailureState.mockResolvedValue({
    status: "found",
    state: { attempts, lockedUntil },
  })
}

/** A keystore that keeps what is written to it, for the tests that run several
 *  verifications in a row and need each to see what the one before left. */
const keepWrites = () => {
  mockedStore.setPinFailureState.mockImplementation(async (state: PinFailureState) => {
    storedState(state)
    return true
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
      storedState({ attempts: 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({ outcome: "unlocked" })
      expect(mockedStore.clearPinFailureState).toHaveBeenCalledTimes(1)
    })

    it("clears the failure state before reporting the unlock", async () => {
      // Awaited, so a kill immediately after unlocking cannot leave a stale
      // future lock behind for the next launch.
      const order: string[] = []
      mockedStore.clearPinFailureState.mockImplementation(async () => {
        order.push("cleared")
        return true
      })
      storedState({ attempts: 1, lockedUntil: NOW - 1 })

      await verifyPin(CORRECT_PIN, NOW)
      order.push("returned")

      expect(order).toEqual(["cleared", "returned"])
    })

    it("writes the attempt down before judging it, and takes it back once it proves correct", async () => {
      /** No entry is compared before it is in the store, the correct one included: until
       *  it is judged, nothing tells it apart from a guess. */
      const order: string[] = []
      mockedStore.setPinFailureState.mockImplementation(async () => {
        order.push("recorded")
        return true
      })
      mockedStore.clearPinFailureState.mockImplementation(async () => {
        order.push("cleared")
        return true
      })
      storedState({ attempts: 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({ outcome: "unlocked" })

      expect(order).toEqual(["recorded", "cleared"])
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: 2,
        lockedUntil: NOW + 30 * SECOND_MS,
      })
    })

    it("still unlocks when the failure state cannot be cleared, and reports it", async () => {
      // Refusing entry over a storage fault would punish the one person who
      // just proved the PIN — but the leftover count is sticky, so it is
      // reported rather than dropped.
      mockedStore.clearPinFailureState.mockResolvedValue(false)
      storedState({ attempts: 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({ outcome: "unlocked" })
      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PIN attempt count could not be cleared",
        }),
        { alwaysRecord: true, dedupKey: "pin-attempts-clear" },
      )
    })

    it("is refused while a lock is still in force, without spending budget", async () => {
      // Otherwise the lockout is theatre: wait it out or not, the right PIN
      // would open the app either way.
      const lockedUntil = NOW + 5 * SECOND_MS
      storedState({ attempts: 1, lockedUntil })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "locked",
        state: { attempts: 1, lockedUntil },
      })
      expect(mockedStore.getPin).not.toHaveBeenCalled()
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    })
  })

  describe("the escalating schedule", () => {
    it("locks for 10s and counts one failure after the first wrong entry", async () => {
      const failed = { attempts: 1, lockedUntil: NOW + 10 * SECOND_MS }

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "wrong",
        state: failed,
      })
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith(failed)
    })

    it("locks for 30s and counts two failures after the second", async () => {
      storedState({ attempts: 1, lockedUntil: NOW - 1 })
      const failed = { attempts: 2, lockedUntil: NOW + 30 * SECOND_MS }

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "wrong",
        state: failed,
      })
      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith(failed)
    })

    it("reports the budget spent on the third failure", async () => {
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({ outcome: "exhausted" })
    })

    it("starts a wait with the third failure too, for the round that follows the logout", async () => {
      /** The lock can outlive the logout this outcome triggers. The keypad that comes back
       *  must not open on a free guess, so the spent budget is written with its wait. */
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: NOW - 1 })

      await verifyPin(WRONG_PIN, NOW)

      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: MAX_PIN_ATTEMPTS,
        lockedUntil: NOW + MINUTE_MS,
      })
    })

    it.each([
      [4, 5 * MINUTE_MS],
      [5, 15 * MINUTE_MS],
      [6, 60 * MINUTE_MS],
      [10, 60 * MINUTE_MS],
    ])(
      "keeps ending the round past the budget, and failure %i waits %i ms",
      async (failures, wait) => {
        storedState({ attempts: failures - 1, lockedUntil: NOW - 1 })

        await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({ outcome: "exhausted" })
        expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
          attempts: failures,
          lockedUntil: NOW + wait,
        })
      },
    )

    it("records the failure before reporting it", async () => {
      // A kill during whatever the caller does next must not hand the count
      // or the wait back.
      const order: string[] = []
      mockedStore.setPinFailureState.mockImplementation(async () => {
        order.push("recorded")
        return true
      })
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: NOW - 1 })

      await verifyPin(WRONG_PIN, NOW)
      order.push("returned")

      expect(order).toEqual(["recorded", "returned"])
    })

    it("never loses a failure across sequential verifications", async () => {
      storedState({ attempts: 1, lockedUntil: NOW - 1 })
      keepWrites()

      const first = await verifyPin(WRONG_PIN, NOW)
      const afterItsWait = NOW + 30 * SECOND_MS
      const second = await verifyPin(WRONG_PIN, afterItsWait)

      expect(first.outcome).toBe("wrong")
      expect(second.outcome).toBe("exhausted")
    })
  })

  describe("round after round past the budget", () => {
    /** What bounds the guesses once the lock outlives the logout: every round costs a
     *  longer wait, and nothing is compared until that wait is over. */
    const spendBudget = async () => {
      await verifyPin(WRONG_PIN, NOW)
      await verifyPin(WRONG_PIN, NOW + 10 * SECOND_MS)
      return verifyPin(WRONG_PIN, NOW + 40 * SECOND_MS)
    }
    const budgetSpentAt = NOW + 40 * SECOND_MS

    beforeEach(() => {
      keepWrites()
    })

    it("refuses the guess that follows a spent budget, without comparing it", async () => {
      await expect(spendBudget()).resolves.toEqual({ outcome: "exhausted" })
      mockedStore.getPin.mockClear()

      const fourthGuess = await verifyPin(WRONG_PIN, budgetSpentAt + SECOND_MS)

      expect(fourthGuess).toEqual({
        outcome: "locked",
        state: { attempts: 3, lockedUntil: budgetSpentAt + MINUTE_MS },
      })
      expect(mockedStore.getPin).not.toHaveBeenCalled()
    })

    it("refuses the correct PIN too until the wait is over, then takes it", async () => {
      await spendBudget()

      const duringTheWait = await verifyPin(CORRECT_PIN, budgetSpentAt + 59 * SECOND_MS)
      const afterTheWait = await verifyPin(CORRECT_PIN, budgetSpentAt + MINUTE_MS)

      expect(duringTheWait.outcome).toBe("locked")
      expect(afterTheWait).toEqual({ outcome: "unlocked" })
    })

    it("makes each round wait longer than the one before it", async () => {
      await spendBudget()

      const fourthAt = budgetSpentAt + MINUTE_MS
      await expect(verifyPin(WRONG_PIN, fourthAt)).resolves.toEqual({
        outcome: "exhausted",
      })
      expect(mockedStore.setPinFailureState).toHaveBeenLastCalledWith({
        attempts: 4,
        lockedUntil: fourthAt + 5 * MINUTE_MS,
      })

      /** One minute would have been enough for the round before. It no longer is. */
      await expect(verifyPin(WRONG_PIN, fourthAt + MINUTE_MS)).resolves.toMatchObject({
        outcome: "locked",
      })

      const fifthAt = fourthAt + 5 * MINUTE_MS
      await expect(verifyPin(WRONG_PIN, fifthAt)).resolves.toEqual({
        outcome: "exhausted",
      })
      expect(mockedStore.setPinFailureState).toHaveBeenLastCalledWith({
        attempts: 5,
        lockedUntil: fifthAt + 15 * MINUTE_MS,
      })
    })
  })

  describe("a spent budget stored without a wait", () => {
    /** What a build that kept the count and no expiry leaves behind. A zero expiry is no
     *  lock, so the first entry is compared, and from that entry on the schedule holds. */
    it("compares the first entry, then makes the next one wait its tier", async () => {
      storedState({ attempts: 3, lockedUntil: 0 })
      keepWrites()

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({ outcome: "exhausted" })
      expect(mockedStore.setPinFailureState).toHaveBeenLastCalledWith({
        attempts: 4,
        lockedUntil: NOW + 5 * MINUTE_MS,
      })

      await expect(verifyPin(CORRECT_PIN, NOW + MINUTE_MS)).resolves.toMatchObject({
        outcome: "locked",
      })
    })
  })

  describe("the relaunch bypass", () => {
    // The screen used to hold the attempt count in React state, which starts at
    // zero. Guessing before it hydrated wrote the count back down. Nothing here
    // is hydrated, and the answer is still correct.

    it("sees a stored spent budget even though nothing hydrated it", async () => {
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({ outcome: "exhausted" })
    })

    it("never writes a lower attempt count over a higher stored one", async () => {
      storedState({ attempts: 2, lockedUntil: NOW - 1 })

      await verifyPin(WRONG_PIN, NOW)

      expect(mockedStore.setPinFailureState).not.toHaveBeenCalledWith(
        expect.objectContaining({ attempts: 1 }),
      )
    })

    it("refuses a guess made while a stored lock is still running", async () => {
      const lockedUntil = NOW + 20 * SECOND_MS
      storedState({ attempts: 2, lockedUntil })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
        outcome: "locked",
        state: { attempts: 2, lockedUntil },
      })
      expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
    })
  })

  describe("when the attempt cannot be written down", () => {
    /** An entry judged with nothing written is a guess that costs nothing, for as long as
     *  the store refuses writes. So none is judged: not a wrong one, not the correct one,
     *  and not the one that would have spent the budget. */
    beforeEach(() => {
      mockedStore.setPinFailureState.mockResolvedValue(false)
    })

    it("fails closed on a wrong entry", async () => {
      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({ outcome: "unrecorded" })
    })

    it("does not take the correct entry either, and clears nothing", async () => {
      storedState({ attempts: 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "unrecorded",
      })
      expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
    })

    it("answers the same for the entry that would have spent the budget, time after time", async () => {
      /** Told apart from a spent budget on purpose: nothing was judged, so nothing says
       *  the entry was wrong. */
      storedState({ attempts: MAX_PIN_ATTEMPTS - 1, lockedUntil: NOW - 1 })

      await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({ outcome: "unrecorded" })
      await expect(verifyPin(CORRECT_PIN, NOW)).resolves.toEqual({
        outcome: "unrecorded",
      })
    })

    it("reports the storage fault", async () => {
      await verifyPin(WRONG_PIN, NOW)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PIN attempt could not be persisted",
        }),
        { alwaysRecord: true, dedupKey: "pin-attempts-write" },
      )
    })
  })

  describe("when the stored pin cannot be read", () => {
    // A keystore that throws transiently is indistinguishable from a wrong PIN
    // through this library. Scoring it as one would log the user out and wipe
    // their PIN after three unlucky unlocks, without a wrong digit typed.
    it.each([
      ["the read failed", null],
      ["nothing came back", ""],
    ])(
      "reports it as unreadable, and spends no budget, when %s",
      async (_label, stored) => {
        mockedStore.getPin.mockResolvedValue(stored)
        storedState({ attempts: 2, lockedUntil: NOW - 1 })

        await expect(verifyPin(WRONG_PIN, NOW)).resolves.toEqual({
          outcome: "unreadable",
        })
        expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
        expect(mockedStore.clearPinFailureState).not.toHaveBeenCalled()
      },
    )

    it("reports the fault, so support sees more than a mystery logout", async () => {
      mockedStore.getPin.mockResolvedValue(null)

      await verifyPin(CORRECT_PIN, NOW)

      expect(mockRecordAppError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "PIN could not be read" }),
        { alwaysRecord: true, dedupKey: "pin-read" },
      )
    })

    it("never unlocks", async () => {
      mockedStore.getPin.mockResolvedValue(null)

      const result = await verifyPin("", NOW)

      expect(result.outcome).not.toBe("unlocked")
    })

    it("is still refused while a lock is in force", async () => {
      // The lock is checked first, so an unreadable PIN cannot be used to learn
      // anything, or to do anything, during a wait.
      mockedStore.getPin.mockResolvedValue(null)
      storedState({ attempts: 1, lockedUntil: NOW + 5 * SECOND_MS })

      const result = await verifyPin(CORRECT_PIN, NOW)

      expect(result.outcome).toBe("locked")
      expect(mockedStore.getPin).not.toHaveBeenCalled()
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
        expect.objectContaining({ message: "PIN attempt count could not be read" }),
        { alwaysRecord: true, dedupKey: "pin-attempts-read" },
      )
    })
  })

  describe("when no instant is given", () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: NOW })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it("reads the clock itself", async () => {
      await verifyPin(WRONG_PIN)

      expect(mockedStore.setPinFailureState).toHaveBeenCalledWith({
        attempts: 1,
        lockedUntil: NOW + 10 * SECOND_MS,
      })
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

  it("cuts a lock that outran the wait of its own count and repairs it in storage", async () => {
    // The clock ran ahead when the lock was written, then was corrected. It is
    // cut once, here, instead of re-imposing the excess on every launch.
    storedState({ attempts: 1, lockedUntil: NOW + 60 * MINUTE_MS })
    const repaired = { attempts: 1, lockedUntil: NOW + 10 * SECOND_MS }

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: repaired,
    })
    expect(mockedStore.setPinFailureState).toHaveBeenCalledWith(repaired)
  })

  it("leaves a lock inside its own wait alone", async () => {
    const stored = { attempts: 2, lockedUntil: NOW + 20 * SECOND_MS }
    storedState(stored)

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: stored,
    })
    expect(mockedStore.setPinFailureState).not.toHaveBeenCalled()
  })

  it("still reads the lock back bounded when the repair cannot be written", async () => {
    storedState({ attempts: 1, lockedUntil: NOW + 60 * MINUTE_MS })
    mockedStore.setPinFailureState.mockResolvedValue(false)

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: { attempts: 1, lockedUntil: NOW + 10 * SECOND_MS },
    })
  })

  it("floors a negative stored attempt count at zero", async () => {
    // A tampered slot must not widen the budget past the three guesses it grants.
    storedState({ attempts: -5 })

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: { attempts: 0, lockedUntil: 0 },
    })
  })

  it("truncates a fractional stored count rather than rendering it", async () => {
    storedState({ attempts: 1.7 })

    await expect(readPinLockState(NOW)).resolves.toEqual({
      status: "readable",
      state: { attempts: 1, lockedUntil: 0 },
    })
  })

  it("reports an unreadable state rather than guessing at a clean slate", async () => {
    mockedStore.getPinFailureState.mockResolvedValue({
      status: "failed",
      err: new Error("keystore unavailable"),
    })

    await expect(readPinLockState(NOW)).resolves.toEqual({ status: "unreadable" })
  })
})
