import { renderHook } from "@testing-library/react-native"

import { useTransferAccess } from "@app/screens/conversion-flow/hooks/use-transfer-access"
import { CARD } from "@app/types/amounts"

type Gate = { isGated: boolean; isRegionPending: boolean }

const mockUseTransferCard = jest.fn()
jest.mock("@app/screens/conversion-flow/hooks/use-transfer-card", () => ({
  useTransferCard: () => mockUseTransferCard(),
}))

const mockDollarGuard = jest.fn<Gate, [{ enabled: boolean }]>()
jest.mock("@app/hooks/use-dollar-balance-restriction-guard", () => ({
  useDollarBalanceRestrictionGuard: (options: { enabled: boolean }) =>
    mockDollarGuard(options),
}))

const mockTransferGuard = jest.fn<Gate, [{ enabled: boolean }]>()
jest.mock("@app/hooks/use-transfer-blocked-guard", () => ({
  useTransferBlockedGuard: (options: { enabled: boolean }) => mockTransferGuard(options),
}))

const mockDollarGate = jest.fn<Gate, []>()
jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceGate: () => mockDollarGate(),
}))

const open: Gate = { isGated: false, isRegionPending: false }
const closed: Gate = { isGated: true, isRegionPending: false }
const pending: Gate = { isGated: false, isRegionPending: true }
const card = { id: "card-1", availableSats: 125000 }

/** The guards answer like the real ones: nothing while turned off. */
const guardAnswering =
  (gate: Gate) =>
  ({ enabled }: { enabled: boolean }) =>
    enabled ? gate : open

const accessFor = ({
  requestedDestination,
  isDrainConversion = false,
}: { requestedDestination?: typeof CARD; isDrainConversion?: boolean } = {}) =>
  renderHook(() => useTransferAccess({ requestedDestination, isDrainConversion })).result
    .current

describe("useTransferAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseTransferCard.mockReturnValue({ card: undefined, isPending: false })
    mockDollarGuard.mockImplementation(guardAnswering(open))
    mockTransferGuard.mockImplementation(guardAnswering(open))
    mockDollarGate.mockReturnValue(open)
  })

  describe("without a card", () => {
    it("keeps both region guards on", () => {
      accessFor()

      expect(mockDollarGuard).toHaveBeenCalledWith({ enabled: true })
      expect(mockTransferGuard).toHaveBeenCalledWith({ enabled: true })
    })

    it("is refused where the region hides the Transfer", () => {
      mockTransferGuard.mockImplementation(guardAnswering(closed))

      expect(accessFor().isRefused).toBe(true)
    })

    it("is refused where the region hides the Dollar Balance", () => {
      mockDollarGuard.mockImplementation(guardAnswering(closed))

      expect(accessFor().isRefused).toBe(true)
    })

    it("waits while the region resolves", () => {
      mockTransferGuard.mockImplementation(guardAnswering(pending))

      expect(accessFor().isPending).toBe(true)
    })

    it("opens the usual Transfer when a link asks for the card", () => {
      const access = accessFor({ requestedDestination: CARD })

      expect(access.destination).toBeUndefined()
      expect(access.card).toBeUndefined()
    })
  })

  describe("for a card holder", () => {
    beforeEach(() => {
      mockUseTransferCard.mockReturnValue({ card, isPending: false })
    })

    it("turns the region guards off, keeping the Transfer wherever they are", () => {
      mockTransferGuard.mockImplementation(guardAnswering(closed))
      mockDollarGuard.mockImplementation(guardAnswering(closed))

      const access = accessFor()

      expect(mockDollarGuard).toHaveBeenCalledWith({ enabled: false })
      expect(mockTransferGuard).toHaveBeenCalledWith({ enabled: false })
      expect(access.isRefused).toBe(false)
      expect(access.card).toEqual(card)
    })

    it("leaves a restricted Dollar Balance out of the choices", () => {
      mockDollarGate.mockReturnValue(closed)

      expect(accessFor().isDollarBalanceOffered).toBe(false)
    })

    it("offers the Dollar Balance where it is not restricted", () => {
      expect(accessFor().isDollarBalanceOffered).toBe(true)
    })

    it("waits while the Dollar Balance's region resolves", () => {
      mockDollarGate.mockReturnValue(pending)

      expect(accessFor().isPending).toBe(true)
    })

    it("fixes the Card Balance as the destination when the route asks for it", () => {
      expect(accessFor({ requestedDestination: CARD }).destination).toBe(CARD)
    })

    it("opens the usual Transfer when the route asks for nothing", () => {
      expect(accessFor().destination).toBeUndefined()
    })
  })

  it("waits for the card lookup with the guards off, so a holder is never sent away", () => {
    mockUseTransferCard.mockReturnValue({ card: undefined, isPending: true })
    mockTransferGuard.mockImplementation(guardAnswering(closed))

    const access = accessFor()

    expect(mockTransferGuard).toHaveBeenCalledWith({ enabled: false })
    expect(access.isRefused).toBe(false)
    expect(access.isPending).toBe(true)
  })

  it("lets a drain conversion through with the Dollar Balance, whatever the region", () => {
    mockDollarGate.mockReturnValue(closed)

    const access = accessFor({ isDrainConversion: true })

    expect(mockDollarGuard).toHaveBeenCalledWith({ enabled: false })
    expect(access.isDollarBalanceOffered).toBe(true)
  })
})
