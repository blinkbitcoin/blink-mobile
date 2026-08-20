import { act, renderHook, waitFor } from "@testing-library/react-native"

import { fetchPlaceDetails } from "@app/btcmap/api"
import { BtcMapPlaceDetails } from "@app/btcmap/types"
import { useBtcMapPlaceDetails } from "@app/btcmap/use-place-details"

jest.mock("@app/btcmap/api", () => ({ fetchPlaceDetails: jest.fn() }))

const mockedFetch = fetchPlaceDetails as jest.MockedFunction<typeof fetchPlaceDetails>

const detailsFor = (id: number, name: string): BtcMapPlaceDetails => ({
  id,
  name,
})

const deferred = <T>() => {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: Error) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => jest.clearAllMocks())

describe("useBtcMapPlaceDetails", () => {
  it("returns nothing for no place", async () => {
    const { result } = renderHook(() => useBtcMapPlaceDetails(undefined))

    expect(result.current.details).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it("never pairs one place's identity with another's details", async () => {
    // Clearing in an effect would leave the first render after an id change
    // still holding the previous place's name, phone and links.
    mockedFetch.mockImplementation(async (id) => detailsFor(id, `place-${id}`))

    const { result, rerender } = renderHook<
      ReturnType<typeof useBtcMapPlaceDetails>,
      { id: number }
    >(({ id }) => useBtcMapPlaceDetails(id), { initialProps: { id: 1 } })
    await waitFor(() => expect(result.current.details?.name).toBe("place-1"))

    rerender({ id: 2 })
    expect(result.current.details).toBeNull()

    await waitFor(() => expect(result.current.details?.name).toBe("place-2"))
  })

  it("ignores a superseded request for the same place", async () => {
    // Tap A, tap B, tap A again: two live requests for A, and the older one
    // failing must not paint an error over the newer one's details.
    const first = deferred<BtcMapPlaceDetails>()
    const second = deferred<BtcMapPlaceDetails>()
    mockedFetch
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(detailsFor(2, "place-2"))
      .mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook<
      ReturnType<typeof useBtcMapPlaceDetails>,
      { id: number }
    >(({ id }) => useBtcMapPlaceDetails(id), { initialProps: { id: 1 } })
    rerender({ id: 2 })
    rerender({ id: 1 })

    await act(async () => {
      second.resolve(detailsFor(1, "place-1"))
    })
    await waitFor(() => expect(result.current.details?.name).toBe("place-1"))

    await act(async () => {
      first.reject(new Error("timeout of 15000ms exceeded"))
    })

    expect(result.current.hasError).toBe(false)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.details?.name).toBe("place-1")
  })

  it("reports a failure and can be retried", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("network request failed"))
    mockedFetch.mockResolvedValue(detailsFor(1, "place-1"))

    const { result } = renderHook(() => useBtcMapPlaceDetails(1))
    await waitFor(() => expect(result.current.hasError).toBe(true))

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.details?.name).toBe("place-1"))
    expect(result.current.hasError).toBe(false)
  })
})
