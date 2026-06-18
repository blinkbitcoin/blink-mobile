import { renderHook, act } from "@testing-library/react-hooks"
import { NotificationChannel } from "@app/graphql/generated"
import {
  useNotificationToggle,
  NotificationCategory,
} from "@app/screens/card-screen/card-settings-screen/hooks"

const mockEnableMutate = jest.fn()
const mockDisableMutate = jest.fn()
const mockToastShow = jest.fn()

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
              disabledCategories: ["Marketing"],
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
  })

  it("returns isCategoryEnabled and toggleCategory", () => {
    const { result } = renderHook(() => useNotificationToggle())

    expect(typeof result.current.isCategoryEnabled).toBe("function")
    expect(typeof result.current.toggleCategory).toBe("function")
  })

  it("isCategoryEnabled returns true for Payments (not in disabledCategories)", () => {
    const { result } = renderHook(() => useNotificationToggle())

    expect(result.current.isCategoryEnabled(NotificationCategory.Payments)).toBe(true)
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
      await result.current.toggleCategory(NotificationCategory.Payments, false)
    })

    expect(mockDisableMutate).toHaveBeenCalledWith({
      variables: {
        input: { category: "Payments", channel: NotificationChannel.Push },
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
})
