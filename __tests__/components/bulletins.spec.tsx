import * as React from "react"
import { Text as ReactNativeText, TouchableOpacity, View, Linking } from "react-native"
import { render, fireEvent, waitFor } from "@testing-library/react-native"

import { BulletinsCard } from "@app/components/notifications/bulletins"
import { BulletinsQuery, Icon } from "@app/graphql/generated"

const mockAck = jest.fn(() => Promise.resolve())

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useStatefulNotificationAcknowledgeMutation: jest.fn(() => [
      mockAck,
      { loading: false },
    ]),
  }
})

jest.mock("@app/components/notifications", () => ({
  useNotifications: () => ({
    cardInfo: undefined,
    notifyModal: jest.fn(),
    notifyCard: jest.fn(),
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  Text: (props: React.ComponentProps<typeof ReactNativeText>) => (
    <ReactNativeText {...props} />
  ),
  useTheme: () => ({
    theme: {
      colors: {
        primary: "primary",
        grey5: "grey5",
        grey2: "grey2",
        black: "black",
        white: "white",
      },
    },
  }),
  makeStyles: () => () => ({}),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name, ...props }: { name: string }) => (
    <View {...props} testID={`galoy-icon-${name}`} />
  ),
}))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: ({ name, onPress }: { name: string; onPress?: () => void }) => (
    <TouchableOpacity testID={`icon-button-${name}`} onPress={onPress} />
  ),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress?: () => void }) => (
    <TouchableOpacity testID="primary-button" onPress={onPress}>
      <ReactNativeText>{title}</ReactNativeText>
    </TouchableOpacity>
  ),
}))

const makeBulletin = (overrides: Record<string, unknown> = {}) => ({
  __typename: "StatefulNotification" as const,
  id: "notif-1",
  title: "Test Bulletin",
  body: "Test body text",
  createdAt: 1700000000,
  acknowledgedAt: null,
  bulletinEnabled: true,
  icon: null,
  action: null,
  bulletinButton: null,
  ...overrides,
})

const makeBulletinsQuery = (
  bulletins: ReturnType<typeof makeBulletin>[],
): BulletinsQuery => ({
  __typename: "Query",
  me: {
    __typename: "User",
    id: "user-1",
    unacknowledgedStatefulNotificationsWithBulletinEnabled: {
      __typename: "StatefulNotificationConnection",
      pageInfo: {
        __typename: "PageInfo",
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
      },
      edges: bulletins.map((node) => ({
        __typename: "StatefulNotificationEdge" as const,
        cursor: node.id,
        node,
      })),
    },
  },
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe("BulletinsCard", () => {
  it("returns null when loading", () => {
    const { toJSON } = render(<BulletinsCard loading={true} bulletins={undefined} />)

    expect(toJSON()).toBeNull()
  })

  it("renders bulletin title and body", () => {
    const bulletins = makeBulletinsQuery([makeBulletin()])
    const { getByText } = render(<BulletinsCard loading={false} bulletins={bulletins} />)

    expect(getByText("Test Bulletin")).toBeTruthy()
    expect(getByText("Test body text")).toBeTruthy()
  })

  it("renders button when bulletinButton is present", () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({
        bulletinButton: { __typename: "BulletinButton", label: "Deposit now" },
      }),
    ])
    const { getByText, queryByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(queryByTestId("primary-button")).toBeTruthy()
    expect(getByText("Deposit now")).toBeTruthy()
  })

  it("does not render button when bulletinButton is null", () => {
    const bulletins = makeBulletinsQuery([makeBulletin()])
    const { queryByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(queryByTestId("primary-button")).toBeNull()
  })

  it("converts icon enum to lowercase kebab-case", () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({ icon: "PAYMENT_SUCCESS" as Icon }),
    ])
    const { queryByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(queryByTestId("galoy-icon-payment-success")).toBeTruthy()
  })

  it("does not render icon when icon is null", () => {
    const bulletins = makeBulletinsQuery([makeBulletin()])
    const { queryByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(queryByTestId(/galoy-icon/)).toBeNull()
  })

  it("calls ack and opens deep link on action press", async () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({
        action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
      }),
    ])
    const { getByText } = render(<BulletinsCard loading={false} bulletins={bulletins} />)

    fireEvent.press(getByText("Test Bulletin"))

    await waitFor(() => {
      expect(mockAck).toHaveBeenCalledWith({
        variables: { input: { notificationId: "notif-1" } },
      })
      expect(Linking.openURL).toHaveBeenCalledWith("blink:/settings")
    })
  })

  it("calls ack and opens external URL on action press", async () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({
        action: { __typename: "OpenExternalLinkAction", url: "https://example.com" },
      }),
    ])
    const { getByText } = render(<BulletinsCard loading={false} bulletins={bulletins} />)

    fireEvent.press(getByText("Test Bulletin"))

    await waitFor(() => {
      expect(mockAck).toHaveBeenCalled()
      expect(Linking.openURL).toHaveBeenCalledWith("https://example.com")
    })
  })

  it("calls ack on dismiss without opening any link", () => {
    const bulletins = makeBulletinsQuery([makeBulletin()])
    const { getByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    fireEvent.press(getByTestId("icon-button-close"))

    expect(mockAck).toHaveBeenCalledWith({
      variables: { input: { notificationId: "notif-1" } },
    })
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it("renders multiple bulletins", () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({ id: "notif-1", title: "First" }),
      makeBulletin({ id: "notif-2", title: "Second" }),
    ])
    const { getByText } = render(<BulletinsCard loading={false} bulletins={bulletins} />)

    expect(getByText("First")).toBeTruthy()
    expect(getByText("Second")).toBeTruthy()
  })

  it("returns null when bulletins is undefined and no cardInfo", () => {
    const { toJSON } = render(<BulletinsCard loading={false} bulletins={undefined} />)

    expect(toJSON()).toBeNull()
  })
})
