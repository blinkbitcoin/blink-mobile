import * as React from "react"
import {
  ActivityIndicator,
  Text as ReactNativeText,
  TouchableOpacity,
  View,
  Linking,
} from "react-native"
import { render, fireEvent, waitFor, act } from "@testing-library/react-native"

import { flushEffects } from "../helpers/flush-effects"

/** Records whether the list is asked to stay visible, the one thing the animation reads. */
const mockDropInOut = jest.fn((_options: { visible: boolean }) => ({
  opacity: { _value: 1 },
  translateY: { _value: 0 },
}))
jest.mock("@app/components/animations", () => ({
  useDropInOutAnimation: (options: { visible: boolean }) => mockDropInOut(options),
}))

import { BulletinsCard } from "@app/components/notifications/bulletins"
import { testBulletinsStore } from "@app/components/notifications/test-bulletins-store"
import { BulletinsQuery, Icon } from "@app/graphql/generated"

const mockAck = jest.fn(() => Promise.resolve())
const mockRefetchQueries = jest.fn()

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({
    refetchQueries: mockRefetchQueries,
  }),
}))

/** Persistent bulletins on, the rollout this card is built for; the flag's own tests
 *  switch it off. */
const mockRemoteConfig = { persistentBulletinsEnabled: true }
jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual("@app/config/feature-flags-context")
  return {
    ...actual,
    useRemoteConfig: () => ({ ...actual.defaultRemoteConfig, ...mockRemoteConfig }),
  }
})

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

/** What the app itself asked the home to show, when the server sent no bulletin. */
const mockCardInfo: { current: Record<string, unknown> | undefined } = {
  current: undefined,
}

jest.mock("@app/components/notifications", () => ({
  useNotifications: () => ({
    cardInfo: mockCardInfo.current,
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

/** A bulletin as the home's query returns it, so a field dropped from the query or the
 *  generated types is a compile error here rather than a green suite. */
type BulletinNode = NonNullable<
  BulletinsQuery["me"]
>["unacknowledgedStatefulNotificationsWithBulletinEnabled"]["edges"][number]["node"]

const makeBulletin = (overrides: Partial<BulletinNode> = {}): BulletinNode => ({
  __typename: "StatefulNotification" as const,
  id: "notif-1",
  title: "Test Bulletin",
  body: "Test body text",
  createdAt: 1700000000,
  acknowledgedAt: null,
  bulletinEnabled: true,
  dismissible: true,
  icon: null,
  action: null,
  ...overrides,
})

const makeBulletinsQuery = (bulletins: BulletinNode[]): BulletinsQuery => ({
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
  /** Reset, not only cleared: a one-shot rejection a test queued and did not use must
   *  not leak into the next one. */
  mockAck.mockReset()
  mockAck.mockImplementation(() => Promise.resolve())
  testBulletinsStore.clear()
  mockCardInfo.current = undefined
  mockRemoteConfig.persistentBulletinsEnabled = true
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

  it("renders button when action has label", () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({
        action: {
          __typename: "OpenExternalLinkAction",
          url: "https://example.com",
          label: "Deposit now",
        },
      }),
    ])
    const { getByText, queryByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(queryByTestId("primary-button")).toBeTruthy()
    expect(getByText("Deposit now")).toBeTruthy()
  })

  it("does not render button when action has no label", () => {
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

  it("replaces every underscore in a multi-word icon enum", () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({ icon: "WARNING_WITH_BACKGROUND" as Icon }),
    ])
    const { queryByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(queryByTestId("galoy-icon-warning-with-background")).toBeTruthy()
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

  it("calls ack on dismiss without opening any link", async () => {
    const bulletins = makeBulletinsQuery([makeBulletin()])
    const { getByTestId } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    fireEvent.press(getByTestId("icon-button-close"))

    expect(mockAck).toHaveBeenCalledWith({
      variables: { input: { notificationId: "notif-1" } },
    })
    expect(Linking.openURL).not.toHaveBeenCalled()
    await flushEffects()
  })

  /** The server keeps such a bulletin up until it retires it itself; the app offers no
   *  way to close it and does not acknowledge it on a tap either. */
  describe("a bulletin that is not dismissible", () => {
    it("offers no close control", () => {
      const bulletins = makeBulletinsQuery([makeBulletin({ dismissible: false })])
      const { getByText, queryByTestId } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      expect(getByText("Test Bulletin")).toBeTruthy()
      expect(queryByTestId("icon-button-close")).toBeNull()
    })

    /** A standing notice with no link has nothing to open and nothing to acknowledge, so
     *  it is an inert card: no press feedback, no button role, no dead press. */
    it("is an inert card when it has no link", () => {
      const bulletins = makeBulletinsQuery([makeBulletin({ dismissible: false })])
      const rendered = render(<BulletinsCard loading={false} bulletins={bulletins} />)

      expect(rendered.getByText("Test Bulletin")).toBeTruthy()
      expect(rendered.UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0)

      fireEvent.press(rendered.getByText("Test Bulletin"))
      expect(Linking.openURL).not.toHaveBeenCalled()
      expect(mockAck).not.toHaveBeenCalled()
    })

    /** What the feature promises: pressing it opens its link and leaves it in place, and
     *  the list the server sends back afterwards still carries it. */
    it("is still on the home after a press and the refetch that follows", async () => {
      const bulletin = makeBulletin({
        dismissible: false,
        action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
      })
      const { getByText, rerender } = render(
        <BulletinsCard loading={false} bulletins={makeBulletinsQuery([bulletin])} />,
      )

      fireEvent.press(getByText("Test Bulletin"))
      await flushEffects()
      rerender(
        <BulletinsCard
          loading={false}
          bulletins={makeBulletinsQuery([{ ...bulletin }])}
        />,
      )

      expect(mockAck).not.toHaveBeenCalled()
      expect(getByText("Test Bulletin")).toBeTruthy()
    })

    it("opens its deep link on press without acknowledging it", async () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({
          dismissible: false,
          action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
        }),
      ])
      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("blink:/settings")
      expect(mockAck).not.toHaveBeenCalled()
      expect(mockRefetchQueries).not.toHaveBeenCalled()
    })

    it("opens its external link on press without acknowledging it", async () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({
          dismissible: false,
          action: { __typename: "OpenExternalLinkAction", url: "https://example.com" },
        }),
      ])
      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("https://example.com")
      expect(mockAck).not.toHaveBeenCalled()
    })

    /** The one kept up goes on top, whatever arrived after it: a closable bulletin sent
     *  later sits under it rather than pushing it down or out, and older closable ones
     *  do not stack. */
    it("puts the one it keeps up on top of the newest closable one", () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "notif-3", title: "Newer promo", dismissible: true }),
        makeBulletin({ id: "notif-2", title: "Older promo", dismissible: true }),
        makeBulletin({ id: "notif-1", title: "Stays", dismissible: false }),
        makeBulletin({ id: "notif-0", title: "Older notice", dismissible: false }),
      ])
      const { queryByText, getAllByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      expect(
        getAllByText(/Newer promo|Stays/).map((node) => node.props.children),
      ).toEqual(["Stays", "Newer promo"])
      expect(queryByText("Older promo")).toBeNull()
      expect(queryByText("Older notice")).toBeNull()
    })

    it("shows the one it keeps up alone when nothing closable came with it", () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "notif-2", title: "Stays", dismissible: false }),
        makeBulletin({ id: "notif-1", title: "Older notice", dismissible: false }),
      ])
      const { getByText, queryByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      expect(getByText("Stays")).toBeTruthy()
      expect(queryByText("Older notice")).toBeNull()
    })

    /** Acknowledging one card spins that card alone; the one kept up stays readable. */
    it("shows the spinner on the card being closed only", async () => {
      let release: () => void = () => {}
      mockAck.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "notif-1", title: "Stays", dismissible: false }),
        makeBulletin({ id: "notif-2", title: "Closable", dismissible: true }),
      ])
      const rendered = render(<BulletinsCard loading={false} bulletins={bulletins} />)

      fireEvent.press(rendered.getByTestId("icon-button-close"))
      await act(async () => {})

      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1)
      expect(rendered.getByText("Stays")).toBeTruthy()
      expect(rendered.queryByText("Closable")).toBeNull()

      await act(async () => {
        release()
      })
      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
    })

    /** Closing one of two cards must not take the one that stays out with it: the list
     *  animates out only when the card closed was the last one shown. */
    it("keeps the list up when a card closes next to one that stays", async () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "notif-1", title: "Stays", dismissible: false }),
        makeBulletin({ id: "notif-2", title: "Closable", dismissible: true }),
      ])
      const { getByTestId } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByTestId("icon-button-close"))
      await flushEffects()

      expect(mockDropInOut).toHaveBeenLastCalledWith(
        expect.objectContaining({ visible: true }),
      )
      expect(mockRefetchQueries).toHaveBeenCalledWith({
        include: [expect.objectContaining({ kind: "Document" })],
      })
    })

    it("stays on the home next to a dismissible one, which keeps its close control", () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "notif-1", title: "Stays", dismissible: false }),
        makeBulletin({ id: "notif-2", title: "Closable", dismissible: true }),
      ])
      const { getByText, getAllByTestId } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      expect(getByText("Stays")).toBeTruthy()
      expect(getByText("Closable")).toBeTruthy()
      expect(getAllByTestId("icon-button-close")).toHaveLength(1)
    })
  })

  /** The card is gone only once the server has taken the acknowledgement: a failed one
   *  leaves it in place, and a successful one refetches the list after the exit animation. */
  describe("acknowledging", () => {
    afterEach(() => {
      jest.useRealTimers()
    })

    it("keeps the bulletin and says so in the log when the acknowledgement fails", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
      mockAck.mockRejectedValueOnce(new Error("offline"))
      const bulletins = makeBulletinsQuery([makeBulletin()])
      const { getByTestId, getByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByTestId("icon-button-close"))
      await flushEffects()

      expect(getByText("Test Bulletin")).toBeTruthy()
      expect(mockRefetchQueries).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to acknowledge notification",
        expect.any(Error),
      )
      consoleError.mockRestore()
    })

    it("refetches the bulletins once the exit animation has run", async () => {
      jest.useFakeTimers()
      const bulletins = makeBulletinsQuery([makeBulletin()])
      const { getByTestId } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByTestId("icon-button-close"))
      await act(async () => {})
      expect(mockRefetchQueries).not.toHaveBeenCalled()

      act(() => {
        jest.runOnlyPendingTimers()
      })

      expect(mockRefetchQueries).toHaveBeenCalledWith({
        include: [expect.objectContaining({ kind: "Document" })],
      })
    })
  })

  /** Closable bulletins do not stack: the newest one the server sent is the one shown. */
  it("shows only the newest of several closable bulletins", () => {
    const bulletins = makeBulletinsQuery([
      makeBulletin({ id: "notif-2", title: "Newest" }),
      makeBulletin({ id: "notif-1", title: "Older" }),
    ])
    const { getByText, queryByText } = render(
      <BulletinsCard loading={false} bulletins={bulletins} />,
    )

    expect(getByText("Newest")).toBeTruthy()
    expect(queryByText("Older")).toBeNull()
  })

  /** The rollout switch: off, a bulletin marked as not dismissible is treated like any
   *  other, so a card stuck on every home by mistake can be closed without a release. */
  describe("with persistent bulletins switched off", () => {
    beforeEach(() => {
      mockRemoteConfig.persistentBulletinsEnabled = false
    })

    it("gives a bulletin marked as not dismissible its close control back", async () => {
      const bulletins = makeBulletinsQuery([makeBulletin({ dismissible: false })])
      const { getByTestId } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByTestId("icon-button-close"))
      await flushEffects()

      expect(mockAck).toHaveBeenCalledWith({
        variables: { input: { notificationId: "notif-1" } },
      })
    })

    it("acknowledges it on a press, as any closable bulletin", async () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({
          dismissible: false,
          action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
        }),
      ])
      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      fireEvent.press(getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("blink:/settings")
      expect(mockAck).toHaveBeenCalledTimes(1)
    })

    it("shows only the newest bulletin, whichever it is", () => {
      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "notif-2", title: "Newest", dismissible: true }),
        makeBulletin({ id: "notif-1", title: "Kept up", dismissible: false }),
      ])
      const { getByText, queryByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      expect(getByText("Newest")).toBeTruthy()
      expect(queryByText("Kept up")).toBeNull()
    })
  })

  /** With nothing from the server, the card the app itself asked for is what shows. */
  it("falls back to the app's own card when no bulletin came from the server", () => {
    mockCardInfo.current = {
      title: "Local card",
      text: "Shown by the app",
      action: async () => {},
      dismissAction: () => {},
    }

    const { getByText } = render(<BulletinsCard loading={false} bulletins={undefined} />)

    expect(getByText("Local card")).toBeTruthy()
    expect(getByText("Shown by the app")).toBeTruthy()
  })

  it("returns null when bulletins is undefined and no cardInfo", () => {
    const { toJSON } = render(<BulletinsCard loading={false} bulletins={undefined} />)

    expect(toJSON()).toBeNull()
  })

  describe("test bulletins (__DEV__)", () => {
    it("renders test bulletins when no real bulletins exist", () => {
      testBulletinsStore.add({
        id: "test-1",
        title: "Test Notification",
        body: "This is a test",
        type: "none",
      })

      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      expect(getByText("Test Notification")).toBeTruthy()
      expect(getByText("This is a test")).toBeTruthy()
    })

    it("renders test bulletins alongside real bulletins", () => {
      testBulletinsStore.add({
        id: "test-1",
        title: "Dev Bulletin",
        body: "Dev body",
        type: "none",
      })

      const bulletins = makeBulletinsQuery([
        makeBulletin({ id: "real-1", title: "Real Bulletin" }),
      ])

      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={bulletins} />,
      )

      expect(getByText("Real Bulletin")).toBeTruthy()
      expect(getByText("Dev Bulletin")).toBeTruthy()
    })

    it("renders icon for deep-link test bulletin", () => {
      testBulletinsStore.add({
        id: "test-dl",
        title: "Deep Link Test",
        body: "Tap to open",
        icon: "bitcoin",
        type: "deep-link",
        deepLink: "card/onboarding",
      })

      const { getByText, queryByTestId } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      expect(getByText("Deep Link Test")).toBeTruthy()
      expect(queryByTestId("galoy-icon-bitcoin")).toBeTruthy()
    })

    it("opens deep link on test bulletin action press", async () => {
      testBulletinsStore.add({
        id: "test-dl",
        title: "Deep Link Test",
        body: "Tap to open",
        type: "deep-link",
        deepLink: "card/onboarding",
      })

      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      fireEvent.press(getByText("Deep Link Test"))

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith("blink:/card/onboarding")
      })
    })

    it("opens external URL on test bulletin action press", async () => {
      testBulletinsStore.add({
        id: "test-ext",
        title: "External Test",
        body: "Tap to visit",
        type: "external-link",
        url: "https://www.blink.sv",
      })

      const { getByText } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      fireEvent.press(getByText("External Test"))

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith("https://www.blink.sv")
      })
    })

    it("removes test bulletin on dismiss", async () => {
      testBulletinsStore.add({
        id: "test-dismiss",
        title: "Dismissable",
        body: "Dismiss me",
        type: "none",
      })

      const { getByTestId } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      fireEvent.press(getByTestId("icon-button-close"))

      await waitFor(() => {
        expect(testBulletinsStore.getSnapshot()).toEqual([])
      })
    })

    it("does not render button for no-action test bulletin", () => {
      testBulletinsStore.add({
        id: "test-none",
        title: "No Action",
        body: "Just info",
        type: "none",
      })

      const { queryByTestId } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      expect(queryByTestId("primary-button")).toBeNull()
    })

    it("renders icon for test bulletin with icon", () => {
      testBulletinsStore.add({
        id: "test-icon",
        title: "With Icon",
        body: "Has icon",
        icon: "info",
        type: "none",
      })

      const { queryByTestId } = render(
        <BulletinsCard loading={false} bulletins={undefined} />,
      )

      expect(queryByTestId("galoy-icon-info")).toBeTruthy()
    })
  })
})
