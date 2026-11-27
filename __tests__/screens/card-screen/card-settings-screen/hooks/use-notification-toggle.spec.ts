import { renderHook, act } from "@testing-library/react-hooks"
import { NotificationChannel } from "@app/graphql/generated"
import {
  useNotificationToggle,
  NotificationCategory,
} from "@app/screens/card-screen/card-settings-screen/hooks"

const mockEnableMutate = jest.fn()
const mockDisableMutate = jest.fn()
const mockToastShow = jest.fn()
/** The categories the server holds off; set per test before render. */
const mockDisabledCategories: { current: string[] } = { current: ["Marketing"] }

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useNotificationSettingsQuery: () => ({
    data: {
      me: {
        defaultAccount: {
          id: "account-1",
          notificationSettings: {
            push: {
              enabled: true,
              disabledCategories: mockDisabledCategories.current,
            },
          },
        },
      },
    },
  }),
  useAccountEnableNotificationCategoryMutation: () => [mockEnableMutate],
  useAccountDisableNotificationCategoryMutation: () => [mockDisableMutate],
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      CardFlow: {
        CardSettings: {
          notificationToggleError: () => "Failed to update notification settings",
        },
      },
    },
  }),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: readonly unknown[]) => mockToastShow(...args),
}))

describe("useNotificationToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockDisabledCategories.current = ["Marketing"]
  })

  it("returns isCategoryEnabled and toggleCategory", () => {
    const { result } = renderHook(() => useNotificationToggle())

    expect(typeof result.current.isCategoryEnabled).toBe("function")
    expect(typeof result.current.toggleCategory).toBe("function")
  })

  it("isCategoryEnabled returns true for CardAlerts (not in disabledCategories)", () => {
    const { result } = renderHook(() => useNotificationToggle())

    expect(result.current.isCategoryEnabled(NotificationCategory.CardAlerts)).toBe(true)
  })

  it("isCategoryEnabled returns false for Marketing (in disabledCategories)", () => {
    const { result } = renderHook(() => useNotificationToggle())

    expect(result.current.isCategoryEnabled(NotificationCategory.Marketing)).toBe(false)
  })

  it("calls enable mutation when toggling on", async () => {
    const { result } = renderHook(() => useNotificationToggle())

    await act(async () => {
      await result.current.toggleCategory(NotificationCategory.Marketing, true)
    })

    expect(mockEnableMutate).toHaveBeenCalledWith({
      variables: {
        input: { category: "Marketing", channel: NotificationChannel.Push },
      },
    })
    expect(mockDisableMutate).not.toHaveBeenCalled()
  })

  it("calls disable mutation when toggling off", async () => {
    const { result } = renderHook(() => useNotificationToggle())

    await act(async () => {
      await result.current.toggleCategory(NotificationCategory.CardAlerts, false)
    })

    expect(mockDisableMutate).toHaveBeenCalledWith({
      variables: {
        input: { category: "CardAlerts", channel: NotificationChannel.Push },
      },
    })
    expect(mockEnableMutate).not.toHaveBeenCalled()
  })

  it("shows warning toast on mutation error", async () => {
    mockEnableMutate.mockRejectedValue(new Error("Network failure"))

    const { result } = renderHook(() => useNotificationToggle())

    await act(async () => {
      await result.current.toggleCategory(NotificationCategory.Marketing, true)
    })

    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to update notification settings",
        type: "warning",
      }),
    )
  })
  /** Until the server knows a category (CardAlerts, blink #221), it answers the toggle
   *  with errors in the payload and leaves the settings as they were. */
  const refusals = [
    {
      turned: "on",
      enabled: true,
      mutate: mockEnableMutate,
      field: "accountEnableNotificationCategory",
    },
    {
      turned: "off",
      enabled: false,
      mutate: mockDisableMutate,
      field: "accountDisableNotificationCategory",
    },
  ]
  for (const { turned, enabled, mutate, field } of refusals) {
    it(`shows the warning toast when the server refuses turning a category ${turned}`, async () => {
      mutate.mockResolvedValue({
        data: { [field]: { errors: [{ message: "Invalid category" }] } },
      })

      const { result } = renderHook(() => useNotificationToggle())

      await act(async () => {
        await result.current.toggleCategory(NotificationCategory.CardAlerts, enabled)
      })

      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to update notification settings",
          type: "warning",
        }),
      )
    })
  }

  it("shows no toast when the server takes the change", async () => {
    mockDisableMutate.mockResolvedValue({
      data: { accountDisableNotificationCategory: { errors: [] } },
    })

    const { result } = renderHook(() => useNotificationToggle())

    await act(async () => {
      await result.current.toggleCategory(NotificationCategory.CardAlerts, false)
    })

    expect(mockToastShow).not.toHaveBeenCalled()
  })
  /** Cards are on staging only, so no member has the old card switch's Payments opt-out.
   *  An account that has one keeps it: the card switch reads its own category and leaves
   *  the account-wide Payments mute alone. */
  describe("with a legacy Payments opt-out from the old card switch", () => {
    beforeEach(() => {
      mockDisabledCategories.current = ["Payments"]
    })

    it("reads the card alerts as on", () => {
      const { result } = renderHook(() => useNotificationToggle())

      expect(result.current.isCategoryEnabled(NotificationCategory.CardAlerts)).toBe(true)
    })

    it("turns only the card alerts off, and keeps the Payments mute", async () => {
      const { result } = renderHook(() => useNotificationToggle())

      await act(async () => {
        await result.current.toggleCategory(NotificationCategory.CardAlerts, false)
      })

      expect(mockDisableMutate).toHaveBeenCalledTimes(1)
      expect(mockDisableMutate).toHaveBeenCalledWith({
        variables: {
          input: { category: "CardAlerts", channel: NotificationChannel.Push },
        },
      })
      expect(mockEnableMutate).not.toHaveBeenCalled()
    })
  })
})
