import { act, renderHook, waitFor } from "@testing-library/react-native"

import { fetchPlaceNamesNear } from "@app/btcmap/api"
import { useBtcMapPlaceNames } from "@app/btcmap/use-place-names"

jest.mock("@app/btcmap/api", () => ({ fetchPlaceNamesNear: jest.fn() }))

const mockedFetch = fetchPlaceNamesNear as jest.MockedFunction<typeof fetchPlaceNamesNear>

const viewport = (
  overrides: Partial<Parameters<typeof useBtcMapPlaceNames>[0]> = {},
) => ({
  center: { latitude: 51.5, longitude: -0.12 },
  radiusKm: 0.9,
  enabled: true,
  ...overrides,
})

const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(500)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  mockedFetch.mockResolvedValue(new Map([[1, "Satoshi Coffee"]]))
})

afterEach(() => jest.useRealTimers())

describe("useBtcMapPlaceNames", () => {
  it("asks for nothing until the map is zoomed in far enough", async () => {
    const { result } = renderHook(() => useBtcMapPlaceNames(viewport({ enabled: false })))

    await settle()

    expect(mockedFetch).not.toHaveBeenCalled()
    expect(result.current.size).toBe(0)
  })

  it("fetches the names for the visible viewport", async () => {
    const { result } = renderHook(() => useBtcMapPlaceNames(viewport()))

    await settle()

    expect(mockedFetch).toHaveBeenCalledWith({ latitude: 51.5, longitude: -0.12 }, 0.9)
    await waitFor(() => expect(result.current.get(1)).toBe("Satoshi Coffee"))
  })

  it("makes one request for a burst of panning, not one per step", async () => {
    const { rerender } = renderHook(
      (props: Parameters<typeof useBtcMapPlaceNames>[0]) => useBtcMapPlaceNames(props),
      { initialProps: viewport() },
    )

    rerender(viewport({ center: { latitude: 51.51, longitude: -0.12 } }))
    rerender(viewport({ center: { latitude: 51.52, longitude: -0.12 } }))
    rerender(viewport({ center: { latitude: 51.53, longitude: -0.12 } }))

    await settle()

    expect(mockedFetch).toHaveBeenCalledTimes(1)
    expect(mockedFetch).toHaveBeenCalledWith({ latitude: 51.53, longitude: -0.12 }, 0.9)
  })

  it("keeps names from where the user has already been", async () => {
    // Panning back over old ground should not blank the labels while a new
    // request is in flight.
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useBtcMapPlaceNames>[0]) => useBtcMapPlaceNames(props),
      { initialProps: viewport() },
    )
    await settle()
    await waitFor(() => expect(result.current.get(1)).toBe("Satoshi Coffee"))

    mockedFetch.mockResolvedValue(new Map([[2, "Bitcoin Bakery"]]))
    rerender(viewport({ center: { latitude: 51.6, longitude: -0.12 } }))
    await settle()

    await waitFor(() => expect(result.current.get(2)).toBe("Bitcoin Bakery"))
    expect(result.current.get(1)).toBe("Satoshi Coffee")
  })

  it("ignores a response for a viewport the user has already left", async () => {
    let resolveStale: (value: Map<number, string>) => void = () => {}
    mockedFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStale = resolve
      }),
    )

    const { result, rerender } = renderHook(
      (props: Parameters<typeof useBtcMapPlaceNames>[0]) => useBtcMapPlaceNames(props),
      { initialProps: viewport() },
    )
    await settle()

    mockedFetch.mockResolvedValue(new Map([[2, "Bitcoin Bakery"]]))
    rerender(viewport({ center: { latitude: 51.9, longitude: -0.12 } }))
    await settle()
    await waitFor(() => expect(result.current.get(2)).toBe("Bitcoin Bakery"))

    await act(async () => {
      resolveStale(new Map([[99, "Somewhere Else"]]))
    })

    expect(result.current.get(99)).toBeUndefined()
  })

  it("stays quiet when the lookup fails", async () => {
    // A missing label is a pin without a name under it — the map as it was
    // before, and nothing the user can act on.
    mockedFetch.mockRejectedValue(new Error("network request failed"))

    const { result } = renderHook(() => useBtcMapPlaceNames(viewport()))
    await settle()

    expect(result.current.size).toBe(0)
  })
})
