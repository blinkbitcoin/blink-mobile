import { renderHook } from "@testing-library/react-native"

import { useIsCardBackendAvailable } from "@app/hooks/use-is-card-backend-available"

const mockUseAppConfig = jest.fn()
jest.mock("@app/hooks/use-app-config", () => ({
  useAppConfig: () => mockUseAppConfig(),
}))

const onInstance = (id: string) =>
  mockUseAppConfig.mockReturnValue({ appConfig: { galoyInstance: { id } } })

describe("useIsCardBackendAvailable", () => {
  it("is available on staging, where the card service runs", () => {
    onInstance("Staging")

    expect(renderHook(() => useIsCardBackendAvailable()).result.current).toBe(true)
  })

  it("is not available on the other instances yet", () => {
    onInstance("Main")

    expect(renderHook(() => useIsCardBackendAvailable()).result.current).toBe(false)
  })
})
