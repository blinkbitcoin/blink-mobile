import React from "react"
import { Pressable, Text } from "react-native"
import { MockedProvider, MockedResponse } from "@apollo/client/testing"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { createCache } from "@app/graphql/cache"
import {
  AccountDisableNotificationCategoryDocument,
  NotificationChannel,
  NotificationSettingsDocument,
  useNotificationSettingsQuery,
} from "@app/graphql/generated"
import {
  NotificationCategory,
  useNotificationToggle,
} from "@app/screens/card-screen/card-settings-screen/hooks"

const mockToastShow = jest.fn()

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

const ACCOUNT_ID = "account-1"

const accountWith = (disabledCategories: string[]) => ({
  __typename: "ConsumerAccount",
  id: ACCOUNT_ID,
  notificationSettings: {
    __typename: "NotificationSettings",
    push: {
      __typename: "NotificationChannelSettings",
      enabled: true,
      disabledCategories,
    },
  },
})

/** The account still holds the old card switch's Payments opt-out. */
const settingsQuery: MockedResponse = {
  request: { query: NotificationSettingsDocument },
  result: {
    data: {
      me: { __typename: "User", id: "user-1", defaultAccount: accountWith(["Payments"]) },
    },
  },
}

const disableCardAlerts = (
  errors: { message: string }[],
  disabledCategories: string[],
): MockedResponse => ({
  request: {
    query: AccountDisableNotificationCategoryDocument,
    variables: {
      input: {
        category: NotificationCategory.CardAlerts,
        channel: NotificationChannel.Push,
      },
    },
  },
  result: {
    data: {
      accountDisableNotificationCategory: {
        __typename: "AccountUpdateNotificationSettingsPayload",
        errors: errors.map((error) => ({
          __typename: "GraphQLApplicationError",
          ...error,
        })),
        account: accountWith(disabledCategories),
      },
    },
  },
})

/** What the card switch reads and does on the app's own Apollo cache, and every
 *  category the cache holds off. */
const SwitchProbe = () => {
  const { isCategoryEnabled, toggleCategory } = useNotificationToggle()
  const { data } = useNotificationSettingsQuery({ fetchPolicy: "cache-only" })
  const disabled = data?.me?.defaultAccount?.notificationSettings?.push.disabledCategories
  return (
    <>
      <Text testID="disabled">{disabled?.join(",") ?? ""}</Text>
      <Text testID="card-alerts">
        {String(isCategoryEnabled(NotificationCategory.CardAlerts))}
      </Text>
      <Pressable
        testID="turn-off"
        onPress={() => toggleCategory(NotificationCategory.CardAlerts, false)}
      />
    </>
  )
}

const renderWith = (mutation: MockedResponse) =>
  render(
    <MockedProvider mocks={[settingsQuery, mutation]} cache={createCache()}>
      <SwitchProbe />
    </MockedProvider>,
  )

describe("useNotificationToggle on the Apollo cache", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  /** Until blink #221 is deployed, the server answers CardAlerts with errors in the
   *  payload and the settings as they were. */
  it("rolls the switch back on, and warns, when the server refuses the change", async () => {
    renderWith(disableCardAlerts([{ message: "Invalid category" }], ["Payments"]))
    await waitFor(() =>
      expect(screen.getByTestId("card-alerts").props.children).toBe("true"),
    )

    fireEvent.press(screen.getByTestId("turn-off"))

    expect(screen.getByTestId("card-alerts").props.children).toBe("false")
    await waitFor(() => expect(mockToastShow).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId("card-alerts").props.children).toBe("true")
    expect(screen.getByTestId("disabled").props.children).toBe("Payments")
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to update notification settings" }),
    )
  })

  it("keeps the switch off, and the Payments mute, when the server takes the change", async () => {
    renderWith(disableCardAlerts([], ["Payments", "CardAlerts"]))
    await waitFor(() =>
      expect(screen.getByTestId("card-alerts").props.children).toBe("true"),
    )

    fireEvent.press(screen.getByTestId("turn-off"))

    await waitFor(() =>
      expect(screen.getByTestId("disabled").props.children).toBe("Payments,CardAlerts"),
    )
    expect(screen.getByTestId("card-alerts").props.children).toBe("false")
    expect(mockToastShow).not.toHaveBeenCalled()
  })
})
