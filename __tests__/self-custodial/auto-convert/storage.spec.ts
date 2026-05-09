import {
  addPendingAutoConvert,
  findPendingAutoConvert,
  listAutoConvertPairings,
  listPendingAutoConverts,
  markAutoConvertPairing,
  pruneExpiredAutoConvertPairings,
  pruneExpiredAutoConverts,
  recordAutoConvertAttempt,
  removePendingAutoConvert,
} from "@app/self-custodial/auto-convert/storage"

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}))

const STORAGE_KEY = "selfCustodialAutoConvertPending"
const DAY_MS = 24 * 60 * 60 * 1000

const makeRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  paymentRequest: "lnbc1abc",
  amountSats: 5000,
  createdAtMs: 1_700_000_000_000,
  attempts: 0,
  lastAttemptAtMs: undefined,
  ...overrides,
})

const writtenRecords = (): Record<string, unknown>[] => {
  const call = mockSetItem.mock.calls.at(-1)
  if (!call) throw new Error("setItem was not called")
  return JSON.parse(call[1] as string)
}

describe("auto-convert storage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetItem.mockResolvedValue(undefined)
  })

  describe("listPendingAutoConverts", () => {
    it("returns empty array when storage has no record", async () => {
      mockGetItem.mockResolvedValue(null)
      const records = await listPendingAutoConverts()
      expect(records).toEqual([])
    })

    it("returns empty array when raw JSON is not an array", async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ paymentRequest: "x" }))
      const records = await listPendingAutoConverts()
      expect(records).toEqual([])
    })

    it("filters out entries missing required fields", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([
          makeRecord(),
          { paymentRequest: 123, createdAtMs: 1 },
          makeRecord({ paymentRequest: "lnbc-valid" }),
        ]),
      )
      const records = await listPendingAutoConverts()
      expect(records).toHaveLength(2)
    })

    it("normalizes records persisted before `attempts`/`lastAttemptAtMs` existed", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([
          {
            paymentRequest: "lnbc1abc",
            amountSats: 5000,
            createdAtMs: 1_700_000_000_000,
          },
        ]),
      )
      const records = await listPendingAutoConverts()
      expect(records[0].attempts).toBe(0)
      expect(records[0].lastAttemptAtMs).toBeUndefined()
    })

    it("returns empty array when AsyncStorage.getItem throws", async () => {
      mockGetItem.mockRejectedValue(new Error("storage down"))
      const records = await listPendingAutoConverts()
      expect(records).toEqual([])
    })
  })

  describe("findPendingAutoConvert", () => {
    it("finds a record by exact paymentRequest match", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([makeRecord({ paymentRequest: "lnbc1target" })]),
      )
      const record = await findPendingAutoConvert("lnbc1target")
      expect(record?.paymentRequest).toBe("lnbc1target")
    })

    it("returns undefined when no record matches", async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([makeRecord()]))
      expect(await findPendingAutoConvert("lnbc1other")).toBeUndefined()
    })
  })

  describe("addPendingAutoConvert", () => {
    it("adds a record when the list is empty", async () => {
      mockGetItem.mockResolvedValue(null)
      await addPendingAutoConvert(makeRecord())
      expect(writtenRecords()).toHaveLength(1)
    })

    it("deduplicates by paymentRequest — newer record wins", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([makeRecord({ paymentRequest: "lnbc1dup", amountSats: 100 })]),
      )
      await addPendingAutoConvert(
        makeRecord({ paymentRequest: "lnbc1dup", amountSats: 999 }),
      )
      const written = writtenRecords()
      expect(written).toHaveLength(1)
      expect(written[0].amountSats).toBe(999)
    })
  })

  describe("removePendingAutoConvert", () => {
    it("removes the matching record", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([
          makeRecord({ paymentRequest: "a" }),
          makeRecord({ paymentRequest: "b" }),
        ]),
      )
      await removePendingAutoConvert("a")
      const written = writtenRecords()
      expect(written).toHaveLength(1)
      expect(written[0].paymentRequest).toBe("b")
    })

    it("does not write when no record matches", async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([makeRecord()]))
      await removePendingAutoConvert("lnbc1not-present")
      expect(mockSetItem).not.toHaveBeenCalled()
    })
  })

  describe("recordAutoConvertAttempt", () => {
    it("increments attempts and stamps lastAttemptAtMs", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([makeRecord({ paymentRequest: "lnbc1", attempts: 1 })]),
      )
      await recordAutoConvertAttempt("lnbc1", 9_999_999)
      const written = writtenRecords()
      expect(written[0].attempts).toBe(2)
      expect(written[0].lastAttemptAtMs).toBe(9_999_999)
    })

    it("no-ops when the record isn't found", async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([makeRecord()]))
      await recordAutoConvertAttempt("lnbc1missing", 100)
      expect(mockSetItem).not.toHaveBeenCalled()
    })
  })

  describe("pruneExpiredAutoConverts", () => {
    it("drops records older than 24h", async () => {
      const nowMs = 2_000_000_000_000
      const fresh = makeRecord({ paymentRequest: "fresh", createdAtMs: nowMs - 1000 })
      const stale = makeRecord({
        paymentRequest: "stale",
        createdAtMs: nowMs - DAY_MS - 1,
      })
      mockGetItem.mockResolvedValue(JSON.stringify([fresh, stale]))
      await pruneExpiredAutoConverts(nowMs)
      const written = writtenRecords()
      expect(written).toHaveLength(1)
      expect(written[0].paymentRequest).toBe("fresh")
    })

    it("does not write when nothing is expired", async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([makeRecord({ createdAtMs: 1 })]))
      await pruneExpiredAutoConverts(100)
      expect(mockSetItem).not.toHaveBeenCalled()
    })
  })

  describe("persistence target", () => {
    it("reads and writes the stable storage key", async () => {
      mockGetItem.mockResolvedValue(null)
      await addPendingAutoConvert(makeRecord())
      expect(mockGetItem).toHaveBeenCalledWith(STORAGE_KEY)
      expect(mockSetItem.mock.calls[0][0]).toBe(STORAGE_KEY)
    })
  })

  describe("AutoConvertPairings (Critical #2 dedup correlation)", () => {
    const PAIRINGS_KEY = "selfCustodialAutoConvertPairings"

    const makePairing = (overrides: Partial<Record<string, unknown>> = {}) => ({
      receivePaymentId: "pid-recv",
      conversionPaymentId: "pid-conv",
      pairedAtMs: 1_700_000_000_000,
      ...overrides,
    })

    const writtenPairings = (): Record<string, unknown>[] => {
      const call = mockSetItem.mock.calls.find((c) => (c[0] as string) === PAIRINGS_KEY)
      if (!call) throw new Error("setItem was not called for pairings key")
      return JSON.parse(call[1] as string)
    }

    it("listAutoConvertPairings returns [] when storage has no entry", async () => {
      mockGetItem.mockResolvedValue(null)
      expect(await listAutoConvertPairings()).toEqual([])
    })

    it("listAutoConvertPairings filters out malformed entries", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([
          makePairing(),
          { receivePaymentId: 1, conversionPaymentId: "x", pairedAtMs: 0 },
          { receivePaymentId: "x", pairedAtMs: 0 },
        ]),
      )
      const pairings = await listAutoConvertPairings()
      expect(pairings).toHaveLength(1)
      expect(pairings[0].receivePaymentId).toBe("pid-recv")
    })

    it("markAutoConvertPairing appends a new pairing", async () => {
      mockGetItem.mockResolvedValue(null)
      await markAutoConvertPairing(makePairing())
      const stored = writtenPairings()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({
        receivePaymentId: "pid-recv",
        conversionPaymentId: "pid-conv",
      })
    })

    it("markAutoConvertPairing dedupes by receivePaymentId or conversionPaymentId", async () => {
      mockGetItem.mockResolvedValue(
        JSON.stringify([
          makePairing({ receivePaymentId: "recv-A", conversionPaymentId: "conv-A" }),
        ]),
      )
      await markAutoConvertPairing(
        makePairing({ receivePaymentId: "recv-A", conversionPaymentId: "conv-A2" }),
      )
      const stored = writtenPairings()
      expect(stored).toHaveLength(1)
      expect(stored[0]).toMatchObject({ conversionPaymentId: "conv-A2" })
    })

    it("pruneExpiredAutoConvertPairings drops entries older than 7 days", async () => {
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      mockGetItem.mockResolvedValue(
        JSON.stringify([
          makePairing({ receivePaymentId: "old", pairedAtMs: 0 }),
          makePairing({ receivePaymentId: "fresh", pairedAtMs: sevenDays - 1 }),
        ]),
      )
      await pruneExpiredAutoConvertPairings(sevenDays + 1)
      const stored = writtenPairings()
      expect(stored).toHaveLength(1)
      expect(stored[0].receivePaymentId).toBe("fresh")
    })
  })
})
