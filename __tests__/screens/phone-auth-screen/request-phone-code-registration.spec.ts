import { act, renderHook, waitFor } from "@testing-library/react-native"

import {
  RequestPhoneCodeStatus,
  useRequestPhoneCodeRegistration,
} from "@app/screens/phone-auth-screen/request-phone-code-registration"

type MockDeviceLocation = { countryCode: string | undefined; loading: boolean }
let mockDeviceLocation: MockDeviceLocation = { countryCode: undefined, loading: false }
const mockUseDeviceLocation = jest.fn<MockDeviceLocation, [unknown]>(
  () => mockDeviceLocation,
)
jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: (options?: unknown) => mockUseDeviceLocation(options),
}))

jest.mock("@app/graphql/generated", () => ({
  PhoneCodeChannelType: { Sms: "SMS", Whatsapp: "WHATSAPP", Telegram: "TELEGRAM" },
  useUserPhoneRegistrationInitiateMutation: () => [jest.fn()],
  useSupportedCountriesQuery: () => ({
    data: {
      globals: {
        supportedCountries: [
          { id: "SV", supportedAuthChannels: ["SMS"] },
          { id: "US", supportedAuthChannels: ["SMS", "WHATSAPP"] },
        ],
      },
    },
    loading: false,
  }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { authUrl: "https://auth.test" } },
    saveToken: jest.fn(),
  }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn() }),
}))

describe("useRequestPhoneCodeRegistration — country detection settle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDeviceLocation = { countryCode: undefined, loading: false }
  })

  it("stays loading while detection is in flight", () => {
    mockDeviceLocation = { countryCode: undefined, loading: true }

    const { result } = renderHook(() => useRequestPhoneCodeRegistration())

    expect(result.current.status).toBe(RequestPhoneCodeStatus.LoadingCountryCode)
  })

  it("seeds the detected country and advances to input", async () => {
    mockDeviceLocation = { countryCode: "US", loading: false }

    const { result } = renderHook(() => useRequestPhoneCodeRegistration())

    await waitFor(() => {
      expect(result.current.status).toBe(RequestPhoneCodeStatus.InputtingPhoneNumber)
    })
    expect(result.current.phoneInputInfo?.countryCode).toBe("US")
  })

  it("detects as a custodial flow so an active Anon account does not block it", () => {
    renderHook(() => useRequestPhoneCodeRegistration())

    expect(mockUseDeviceLocation).toHaveBeenCalledWith({ isCustodialFlow: true })
  })

  it("still advances to input when detection settles without a country", async () => {
    mockDeviceLocation = { countryCode: undefined, loading: false }

    const { result } = renderHook(() => useRequestPhoneCodeRegistration())

    await waitFor(() => {
      expect(result.current.status).toBe(RequestPhoneCodeStatus.InputtingPhoneNumber)
    })
  })

  it("does not drag a later flow status back to input when detection re-settles", async () => {
    mockDeviceLocation = { countryCode: "SV", loading: false }

    const { result, rerender } = renderHook(() => useRequestPhoneCodeRegistration())

    await waitFor(() => {
      expect(result.current.status).toBe(RequestPhoneCodeStatus.InputtingPhoneNumber)
    })

    act(() => {
      result.current.setStatus(RequestPhoneCodeStatus.RequestingCode)
    })
    mockDeviceLocation = { countryCode: "US", loading: false }
    rerender({})

    expect(result.current.status).toBe(RequestPhoneCodeStatus.RequestingCode)
    expect(result.current.phoneInputInfo?.countryCode).toBe("SV")
  })
})
