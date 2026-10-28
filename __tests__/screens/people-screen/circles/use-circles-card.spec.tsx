import { Share as NativeShare } from "react-native"

import React from "react"

import { render } from "@testing-library/react-native"
import { renderHook } from "@testing-library/react-hooks"

import { useCirclesCard } from "@app/screens/people-screen/circles/use-circles-card"

const mockLogBreadcrumb = jest.fn()
jest.mock("@app/utils/error-reporting", () => ({
  logBreadcrumb: (...args: unknown[]) => mockLogBreadcrumb(...args),
}))

type Profile = { innerCircleAllTimeCount: number; allTimeRank?: number } | null
let mockWelcomeProfile: Profile = null

jest.mock("@app/graphql/generated", () => ({
  useCirclesQuery: () => ({
    data: {
      me: { username: "alice", defaultAccount: { welcomeProfile: mockWelcomeProfile } },
    },
  }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({ appConfig: { galoyInstance: { name: "Blink" } } }),
}))

// The card's own rendering is another screen's concern; what is under test is the share
// path. Mocking the pieces it draws with also keeps their module graph out of this suite.
jest.mock("@app/components/circle", () => ({ Circle: () => null }))
jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn() }))

// Any label the card asks for comes back as its own key, so a copy change cannot break
// this suite and the card can render without the i18n provider.
jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: new Proxy(
      {},
      {
        get: (_target, section: string) =>
          new Proxy({}, { get: (_t, key: string) => () => `${section}.${String(key)}` }),
      },
    ),
  }),
}))
jest.mock("@app/assets/logo/app-logo-dark.svg", () => "LogoDarkMode")
jest.mock("@app/assets/logo/blink-logo-light.svg", () => "LogoLightMode")

/**
 * The invite share. What matters here is the failure path: a user who dismisses the sheet
 * leaves a breadcrumb through the app's one reporting sink, which is what subjects it to the
 * same rule as everything else — nothing leaves a device that may not report.
 */
describe("useCirclesCard share", () => {
  let share: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockWelcomeProfile = null
    share = jest.spyOn(NativeShare, "share").mockResolvedValue({ action: "sharedAction" })
  })

  afterEach(() => {
    share.mockRestore()
  })

  it("shares the invite link for someone with no circle yet", async () => {
    const { result } = renderHook(() => useCirclesCard())

    await result.current.share()

    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining("alice") })
    expect(mockLogBreadcrumb).not.toHaveBeenCalled()
  })

  it("leaves a breadcrumb through the sink when the user dismisses the sheet", async () => {
    share.mockRejectedValue(new Error("User did not share"))
    const { result } = renderHook(() => useCirclesCard())

    await result.current.share()

    expect(mockLogBreadcrumb).toHaveBeenCalledWith("User didn't share")
  })

  it("swallows the dismissal rather than letting it reach the screen", async () => {
    share.mockRejectedValue(new Error("User did not share"))
    const { result } = renderHook(() => useCirclesCard())

    await expect(result.current.share()).resolves.toBeUndefined()
  })

  describe("the card it hands the share sheet", () => {
    /** RNFL and the hooks renderer cannot both be live in one test, so the card is
     *  rendered through a host component that calls the hook itself. */
    const Harness: React.FC = () => {
      const { ShareImg } = useCirclesCard()
      return ShareImg
    }

    it("has nothing to capture for someone with no circle", () => {
      const tree = render(<Harness />)

      expect(tree.toJSON()).toBeNull()
    })

    it("renders the card once there is a circle to show", () => {
      mockWelcomeProfile = { innerCircleAllTimeCount: 3, allTimeRank: 12 }

      const tree = render(<Harness />)

      expect(tree.getByText(/alice@/)).toBeTruthy()
    })
  })
})
