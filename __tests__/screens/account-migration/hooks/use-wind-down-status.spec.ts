import { renderHook } from "@testing-library/react-native"

import { useWindDownStatus } from "@app/screens/account-migration/hooks/use-wind-down-status"
import { windDownMock } from "@app/screens/account-migration/utils/backend-mock"

describe("useWindDownStatus", () => {
  it("serves the mocked wind-down state until the backend query ships", () => {
    const { result } = renderHook(() => useWindDownStatus())

    expect(result.current).toBe(windDownMock)
  })
})
