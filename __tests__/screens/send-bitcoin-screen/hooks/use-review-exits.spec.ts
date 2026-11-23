import { renderHook } from "@testing-library/react-native"
import type { NavigationState } from "@react-navigation/native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { useReviewExits } from "@app/screens/send-bitcoin-screen/hooks/use-review-exits"

const mockDispatch = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ dispatch: mockDispatch }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: jest.requireActual("@app/i18n/i18n-util").i18nObject("en"),
  }),
}))

loadLocale("en")
const LL = i18nObject("en")

const exits = () => renderHook(() => useReviewExits()).result.current

const stackOf = (...names: string[]) =>
  ({
    key: "root",
    index: names.length - 1,
    routeNames: names,
    routes: names.map((name) => ({ key: `${name}-key`, name })),
    stale: false,
    type: "stack",
  }) as unknown as NavigationState

/** What `startOver` resets to, from the stack it was pressed on. */
const startOverFrom = (state: NavigationState) => {
  exits().startOver()
  const toAction = mockDispatch.mock.calls[0][0] as (s: NavigationState) => {
    payload: { routes: { name: string }[]; index: number }
  }
  return toAction(state).payload
}

describe("useReviewExits", () => {
  beforeEach(() => {
    mockDispatch.mockClear()
  })

  it("goes back to amount entry with a fresh reset stamp on Change amount", () => {
    exits().changeAmount()

    const action = mockDispatch.mock.calls[0][0]
    expect(action.type).toBe("POP_TO")
    expect(action.payload.name).toBe("sendBitcoinDetails")
    expect(action.payload.params.resetAmountAt).toEqual(expect.any(Number))
    expect(action.payload.merge).toBe(true)
  })

  it("replaces the send flow with a new destination screen on Try again", () => {
    const { routes, index } = startOverFrom(
      stackOf(
        "Primary",
        "sendBitcoinDestination",
        "sendBitcoinDetails",
        "sendBitcoinConfirmation",
      ),
    )

    expect(routes.map(({ name }) => name)).toEqual(["Primary", "sendBitcoinDestination"])
    expect(index).toBe(1)
  })

  it("starts a send reached by scanning on a destination screen it never had", () => {
    const { routes } = startOverFrom(
      stackOf(
        "Primary",
        "scanningQRCode",
        "sendBitcoinDetails",
        "sendBitcoinConfirmation",
      ),
    )

    expect(routes.map(({ name }) => name)).toEqual(["Primary", "sendBitcoinDestination"])
  })

  it("keeps the whole stack and adds a destination when no send screen is in it", () => {
    const { routes, index } = startOverFrom(stackOf("Primary", "settings"))

    expect(routes.map(({ name }) => name)).toEqual([
      "Primary",
      "settings",
      "sendBitcoinDestination",
    ])
    expect(index).toBe(2)
  })

  it("leaves the flow for Home", () => {
    exits().goHome()

    expect(mockDispatch.mock.calls[0][0].type).toBe("POP_TO_TOP")
  })

  it("labels each sheet action and wires it to its exit", () => {
    const { actionButton } = exits()

    expect(actionButton("changeAmount").primaryLabel).toBe(
      LL.SendBitcoinConfirmationScreen.changeAmount(),
    )
    expect(actionButton("tryAgain").primaryLabel).toBe(
      LL.SendBitcoinConfirmationScreen.tryAgain(),
    )
    expect(actionButton("home").primaryLabel).toBe(
      LL.SendBitcoinConfirmationScreen.home(),
    )

    actionButton("home").onPrimaryPress()
    expect(mockDispatch.mock.calls[0][0].type).toBe("POP_TO_TOP")
  })
})
