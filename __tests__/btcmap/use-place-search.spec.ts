import { act, renderHook, waitFor } from "@testing-library/react-native"

import { fetchPlacesNear } from "@app/btcmap/api"
import { BtcMapNamedPlace } from "@app/btcmap/types"
import { useBtcMapPlaceSearch } from "@app/btcmap/use-place-search"

jest.mock("@app/btcmap/api", () => ({ fetchPlacesNear: jest.fn() }))

const mockedFetch = fetchPlacesNear as jest.MockedFunction<typeof fetchPlacesNear>

const PLACE: BtcMapNamedPlace = {
  id: 1,
  name: "Satoshi Coffee",
  icon: "local_cafe",
  latitude: 51.5,
  longitude: -0.12,
}

const props = (overrides: Partial<Parameters<typeof useBtcMapPlaceSearch>[0]> = {}) => ({
  center: { latitude: 51.5, longitude: -0.12 },
  viewportRadiusKm: 8,
  enabled: true,
  ...overrides,
})

const radiusOf = (call: number) => mockedFetch.mock.calls[call][1]

beforeEach(() => {
  jest.clearAllMocks()
  mockedFetch.mockResolvedValue([PLACE])
})

describe("useBtcMapPlaceSearch", () => {
  it("costs nothing until the search is actually opened", async () => {
    // The map screen stays mounted for the life of the process, so an
    // unconditional fetch here would be a few hundred KB on every app start.
    const { result } = renderHook(() => useBtcMapPlaceSearch(props({ enabled: false })))

    await act(async () => {})

    expect(mockedFetch).not.toHaveBeenCalled()
    expect(result.current.places).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it("fetches the area once the search opens", async () => {
    const { result, rerender } = renderHook(
      (hookProps: Parameters<typeof useBtcMapPlaceSearch>[0]) =>
        useBtcMapPlaceSearch(hookProps),
      { initialProps: props({ enabled: false }) },
    )

    expect(mockedFetch).not.toHaveBeenCalled()

    await act(async () => {
      rerender(props({ enabled: true }))
    })

    await waitFor(() => expect(result.current.places).toEqual([PLACE]))
  })

  it("asks about a grid cell rather than the exact spot on screen", async () => {
    renderHook(() =>
      useBtcMapPlaceSearch(
        props({ center: { latitude: 51.50312, longitude: -0.12417 } }),
      ),
    )

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(mockedFetch.mock.calls[0][0]).toEqual({ latitude: 51.5, longitude: -0.12 })
  })

  it("caps the radius, since the endpoint honours no limit of its own", async () => {
    // Zoomed out to a whole country the viewport is hundreds of km across, and
    // the response grows with it — half a megabyte at 200 km.
    renderHook(() => useBtcMapPlaceSearch(props({ viewportRadiusKm: 400 })))

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(radiusOf(0)).toBe(25)
  })

  it("keeps a floor under it, so a street-level view still finds the next street", async () => {
    renderHook(() => useBtcMapPlaceSearch(props({ viewportRadiusKm: 0.3 })))

    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    expect(radiusOf(0)).toBe(5)
  })

  it("surfaces a failure and can be told to try again", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("network request failed"))

    const { result } = renderHook(() => useBtcMapPlaceSearch(props()))

    await waitFor(() => expect(result.current.hasError).toBe(true))
    // Results from a previous area listed under a failure are worse than none.
    expect(result.current.places).toEqual([])

    await act(async () => {
      result.current.retry()
    })

    await waitFor(() => expect(result.current.places).toEqual([PLACE]))
    expect(result.current.hasError).toBe(false)
  })

  it("clears the list when the search reopens over somewhere else", async () => {
    const { result, rerender } = renderHook(
      (hookProps: Parameters<typeof useBtcMapPlaceSearch>[0]) =>
        useBtcMapPlaceSearch(hookProps),
      { initialProps: props() },
    )
    await waitFor(() => expect(result.current.places).toEqual([PLACE]))

    // Close the search, pan the map to another city, reopen — and let the
    // fetch for the new area hang, the way a phone connection does.
    mockedFetch.mockReturnValueOnce(new Promise(() => {}))
    await act(async () => {
      rerender(props({ enabled: false }))
    })
    await act(async () => {
      rerender(props({ enabled: true, center: { latitude: 13.7, longitude: -89.2 } }))
    })

    // The old city's rows would still be pressable, and tapping one flies the
    // map right back to where the user just left.
    expect(result.current.places).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it("keeps the list up while reopening refreshes the same area", async () => {
    const { result, rerender } = renderHook(
      (hookProps: Parameters<typeof useBtcMapPlaceSearch>[0]) =>
        useBtcMapPlaceSearch(hookProps),
      { initialProps: props() },
    )
    await waitFor(() => expect(result.current.places).toEqual([PLACE]))

    mockedFetch.mockReturnValueOnce(new Promise(() => {}))
    await act(async () => {
      rerender(props({ enabled: false }))
    })
    await act(async () => {
      rerender(props({ enabled: true }))
    })

    // Same area, same answer expected — blinking through an empty list would
    // only make the reopen feel broken.
    expect(result.current.places).toEqual([PLACE])
    expect(result.current.isLoading).toBe(true)
  })

  it("ignores a response for an area the user has already left", async () => {
    let resolveStale: (value: BtcMapNamedPlace[]) => void = () => {}
    mockedFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStale = resolve
      }),
    )

    const { result, rerender } = renderHook(
      (hookProps: Parameters<typeof useBtcMapPlaceSearch>[0]) =>
        useBtcMapPlaceSearch(hookProps),
      { initialProps: props() },
    )

    mockedFetch.mockResolvedValue([{ ...PLACE, id: 2, name: "Bitcoin Bakery" }])
    await act(async () => {
      rerender(props({ center: { latitude: 51.9, longitude: -0.12 } }))
    })
    await waitFor(() => expect(result.current.places[0]?.id).toBe(2))

    await act(async () => {
      resolveStale([{ ...PLACE, id: 99, name: "Somewhere Else" }])
    })

    expect(result.current.places[0]?.id).toBe(2)
  })
})
