import * as React from "react"
import {
  ActivityIndicator,
  Text as ReactNativeText,
  TouchableOpacity,
  View,
  Linking,
} from "react-native"
import {
  render,
  renderHook,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native"

import { flushEffects } from "../helpers/flush-effects"

import { useServerBulletinItems } from "@app/components/notifications/bulletins"
import { testBulletinsStore } from "@app/components/notifications/test-bulletins-store"
import { defaultRemoteConfig } from "@app/config/feature-flags-context"
import { BulletinsDocument, BulletinsQuery, Icon } from "@app/graphql/generated"

type AckOptions = { variables: { input: { notificationId: string } } }
const mockAck = jest.fn<Promise<void>, [AckOptions]>(() => Promise.resolve())
const mockRefetchQueries = jest.fn(() => Promise.resolve())

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({
    refetchQueries: mockRefetchQueries,
  }),
}))

/** Persistent bulletins on, the rollout these cards are built for; the flag's own tests
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

const CUTOFF = defaultRemoteConfig.bulletinsShownSince
const HOUR = 3600

const makeBulletin = (overrides: Partial<BulletinNode> = {}): BulletinNode => ({
  __typename: "StatefulNotification" as const,
  id: "notif-1",
  title: "Test Bulletin",
  body: "Test body text",
  createdAt: CUTOFF + HOUR,
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

type HarnessProps = { loading?: boolean; bulletins: BulletinsQuery | undefined }

/** Every card the hook returns, in order, each tagged with its carousel key. */
const Harness: React.FC<HarnessProps> = ({ loading = false, bulletins }) => {
  const { items } = useServerBulletinItems({ loading, bulletins })
  return (
    <>
      {items.map(({ key, node }) => (
        <View key={key} testID={`item-${key}`}>
          {node}
        </View>
      ))}
    </>
  )
}

const renderItems = (bulletins: BulletinNode[] | undefined, loading = false) =>
  render(
    <Harness
      loading={loading}
      bulletins={bulletins ? makeBulletinsQuery(bulletins) : undefined}
    />,
  )

type Rendered = ReturnType<typeof render>

const itemKeys = (rendered: Rendered): string[] =>
  rendered
    .queryAllByTestId(/^item-/)
    .map((node) => String(node.props.testID).replace(/^item-/, ""))

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

describe("useServerBulletinItems", () => {
  /** `cache-and-network` hands back the cached bulletins with `loading` still true: they
   *  stay on screen while the request is in flight. */
  it("keeps the cached bulletins while a request is in flight", () => {
    const rendered = renderItems([makeBulletin()], true)

    expect(itemKeys(rendered)).toEqual(["server-notif-1"])
  })

  it("keeps the app's queued card while the first request is in flight", () => {
    mockCardInfo.current = { title: "Local card", text: "Shown by the app" }
    const rendered = renderItems(undefined, true)

    expect(itemKeys(rendered)).toEqual(["notify-card"])
  })

  it("renders a card with the bulletin's title and body, keyed by its id", () => {
    const rendered = renderItems([makeBulletin()])

    expect(itemKeys(rendered)).toEqual(["server-notif-1"])
    expect(rendered.getByText("Test Bulletin")).toBeTruthy()
    expect(rendered.getByText("Test body text")).toBeTruthy()
  })

  it("renders the action's label as a button", () => {
    const rendered = renderItems([
      makeBulletin({
        action: {
          __typename: "OpenExternalLinkAction",
          url: "https://example.com",
          label: "Deposit now",
        },
      }),
    ])

    expect(rendered.getByTestId("primary-button")).toBeTruthy()
    expect(rendered.getByText("Deposit now")).toBeTruthy()
  })

  it("renders no button when the action has no label", () => {
    const rendered = renderItems([
      makeBulletin({
        action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
      }),
    ])

    expect(rendered.queryByTestId("primary-button")).toBeNull()
  })

  it("turns every underscore of the icon enum into a dash, in lower case", () => {
    const rendered = renderItems([
      makeBulletin({ icon: "WARNING_WITH_BACKGROUND" as Icon }),
    ])

    expect(rendered.getByTestId("galoy-icon-warning-with-background")).toBeTruthy()
  })

  it("renders no icon when the bulletin has none", () => {
    const rendered = renderItems([makeBulletin()])

    expect(rendered.queryByTestId(/galoy-icon/)).toBeNull()
  })

  describe("which bulletins it shows, and in what order", () => {
    it("shows every bulletin sent since the cutoff, newest first", () => {
      const rendered = renderItems([
        makeBulletin({ id: "middle", createdAt: CUTOFF + 2 * HOUR }),
        makeBulletin({ id: "oldest", createdAt: CUTOFF }),
        makeBulletin({ id: "newest", createdAt: CUTOFF + 3 * HOUR }),
      ])

      expect(itemKeys(rendered)).toEqual([
        "server-newest",
        "server-middle",
        "server-oldest",
      ])
    })

    it("sorts a bulletin the user cannot close by date with the rest", () => {
      const rendered = renderItems([
        makeBulletin({ id: "pinned", dismissible: false, createdAt: CUTOFF + HOUR }),
        makeBulletin({ id: "newer", createdAt: CUTOFF + 2 * HOUR }),
        makeBulletin({ id: "older", createdAt: CUTOFF }),
      ])

      expect(itemKeys(rendered)).toEqual([
        "server-newer",
        "server-pinned",
        "server-older",
      ])
    })

    /** The single-card home hid these behind newer ones; the carousel must not bring
     *  them back. */
    it("hides a closable bulletin sent before the cutoff", () => {
      const rendered = renderItems([
        makeBulletin({ id: "before", title: "Before", createdAt: CUTOFF - 1 }),
        makeBulletin({ id: "after", title: "After" }),
      ])

      expect(itemKeys(rendered)).toEqual(["server-after"])
      expect(rendered.queryByText("Before")).toBeNull()
    })

    it("still shows a bulletin the user cannot close, however old", () => {
      const rendered = renderItems([
        makeBulletin({
          id: "pinned",
          dismissible: false,
          createdAt: CUTOFF - 90 * 86400,
        }),
      ])

      expect(itemKeys(rendered)).toEqual(["server-pinned"])
    })
  })

  describe("closing with the X", () => {
    it("acknowledges the bulletin, then refetches, without opening any link", async () => {
      const rendered = renderItems([
        makeBulletin({
          action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
        }),
      ])

      fireEvent.press(rendered.getByTestId("icon-button-close"))
      await flushEffects()

      expect(mockAck).toHaveBeenCalledWith({
        variables: { input: { notificationId: "notif-1" } },
      })
      expect(mockRefetchQueries).toHaveBeenCalledWith({ include: [BulletinsDocument] })
      expect(mockAck.mock.invocationCallOrder[0]).toBeLessThan(
        mockRefetchQueries.mock.invocationCallOrder[0],
      )
      expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it("shows the spinner on the card being closed only, until the refetch is done", async () => {
      let release: () => void = () => {}
      mockRefetchQueries.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      )
      const rendered = renderItems([
        makeBulletin({ id: "closing", title: "Closing", createdAt: CUTOFF + 2 * HOUR }),
        makeBulletin({ id: "other", title: "Other" }),
      ])

      fireEvent.press(rendered.getAllByTestId("icon-button-close")[0])
      await act(async () => {})

      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1)
      expect(rendered.queryByText("Closing")).toBeNull()
      expect(rendered.getByText("Other")).toBeTruthy()

      await act(async () => {
        release()
      })
      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
    })

    /** The carousel stays swipeable while a card closes, so a second close can start
     *  before the first settles: each card keeps its own spinner until its own request
     *  settles, and a close of a card already closing sends nothing. */
    it("keeps each closing card's spinner until its own request settles", async () => {
      const releases: Record<string, () => void> = {}
      mockAck.mockImplementation(
        ({ variables }) =>
          new Promise<void>((resolve) => {
            releases[variables.input.notificationId] = resolve
          }),
      )
      const rendered = renderItems([
        makeBulletin({ id: "a", title: "A", createdAt: CUTOFF + 2 * HOUR }),
        makeBulletin({ id: "b", title: "B" }),
      ])

      const [closeA, closeB] = rendered.getAllByTestId("icon-button-close")
      fireEvent.press(closeA)
      fireEvent.press(closeB)
      fireEvent.press(closeB)
      await act(async () => {})

      expect(mockAck).toHaveBeenCalledTimes(2)
      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(2)

      await act(async () => {
        releases.a()
      })

      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1)
      expect(rendered.queryByText("B")).toBeNull()
      expect(mockAck).toHaveBeenCalledTimes(2)
      expect(
        mockAck.mock.calls.filter(
          ([{ variables }]) => variables.input.notificationId === "b",
        ),
      ).toHaveLength(1)

      await act(async () => {
        releases.b()
      })
      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
    })

    it("keeps the card and logs when the acknowledgement fails", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
      mockAck.mockRejectedValueOnce(new Error("offline"))
      const rendered = renderItems([makeBulletin()])

      fireEvent.press(rendered.getByTestId("icon-button-close"))
      await flushEffects()

      expect(rendered.getByText("Test Bulletin")).toBeTruthy()
      expect(rendered.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
      expect(mockRefetchQueries).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to acknowledge notification",
        expect.any(Error),
      )
      consoleError.mockRestore()
    })
  })

  describe("opening the link", () => {
    it("opens a deep link and acknowledges a closable bulletin", async () => {
      const rendered = renderItems([
        makeBulletin({
          action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
        }),
      ])

      fireEvent.press(rendered.getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("blink:/settings")
      expect(mockAck).toHaveBeenCalledWith({
        variables: { input: { notificationId: "notif-1" } },
      })
      expect(mockRefetchQueries).toHaveBeenCalled()
    })

    it("opens an external link from the action button", async () => {
      const rendered = renderItems([
        makeBulletin({
          action: {
            __typename: "OpenExternalLinkAction",
            url: "https://example.com",
            label: "Visit",
          },
        }),
      ])

      fireEvent.press(rendered.getByTestId("primary-button"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("https://example.com")
      expect(mockAck).toHaveBeenCalledTimes(1)
    })

    /** Only the X or opening the link closes a bulletin, so a card with no link is not a
     *  button: no press feedback, and a tap neither opens nor acknowledges anything. */
    it("does nothing on a tap when a closable bulletin has no link", async () => {
      const rendered = renderItems([makeBulletin()])

      expect(rendered.UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(1)
      fireEvent.press(rendered.getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).not.toHaveBeenCalled()
      expect(mockAck).not.toHaveBeenCalled()
    })
  })

  /** The server keeps such a bulletin up until it retires it itself. */
  describe("a bulletin that is not dismissible", () => {
    it("offers no close control", () => {
      const rendered = renderItems([makeBulletin({ dismissible: false })])

      expect(rendered.getByText("Test Bulletin")).toBeTruthy()
      expect(rendered.queryByTestId("icon-button-close")).toBeNull()
    })

    it("is an inert card when it has no link", async () => {
      const rendered = renderItems([makeBulletin({ dismissible: false })])

      expect(rendered.UNSAFE_queryAllByType(TouchableOpacity)).toHaveLength(0)
      fireEvent.press(rendered.getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).not.toHaveBeenCalled()
      expect(mockAck).not.toHaveBeenCalled()
    })

    it("opens its link without acknowledging it, and stays", async () => {
      const bulletin = makeBulletin({
        dismissible: false,
        action: { __typename: "OpenExternalLinkAction", url: "https://example.com" },
      })
      const rendered = renderItems([bulletin])

      fireEvent.press(rendered.getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("https://example.com")
      expect(mockAck).not.toHaveBeenCalled()
      expect(mockRefetchQueries).not.toHaveBeenCalled()
      expect(rendered.getByText("Test Bulletin")).toBeTruthy()
    })
  })

  /** The rollout switch: off, a bulletin marked as not dismissible is treated like any
   *  other, so a card stuck on every home by mistake can be closed without a release. */
  describe("with persistent bulletins switched off", () => {
    beforeEach(() => {
      mockRemoteConfig.persistentBulletinsEnabled = false
    })

    it("gives a bulletin marked as not dismissible its close control back", async () => {
      const rendered = renderItems([makeBulletin({ dismissible: false })])

      fireEvent.press(rendered.getByTestId("icon-button-close"))
      await flushEffects()

      expect(mockAck).toHaveBeenCalledWith({
        variables: { input: { notificationId: "notif-1" } },
      })
    })

    it("acknowledges it when its link opens, as any closable bulletin", async () => {
      const rendered = renderItems([
        makeBulletin({
          dismissible: false,
          action: { __typename: "OpenDeepLinkAction", deepLink: "settings" },
        }),
      ])

      fireEvent.press(rendered.getByText("Test Bulletin"))
      await flushEffects()

      expect(Linking.openURL).toHaveBeenCalledWith("blink:/settings")
      expect(mockAck).toHaveBeenCalledTimes(1)
    })

    it("applies the cutoff to it too", () => {
      const rendered = renderItems([
        makeBulletin({ id: "old", dismissible: false, createdAt: CUTOFF - 1 }),
      ])

      expect(itemKeys(rendered)).toEqual([])
    })
  })

  describe("the app's own card", () => {
    beforeEach(() => {
      mockCardInfo.current = {
        title: "Local card",
        text: "Shown by the app",
        action: async () => {},
        dismissAction: () => {},
      }
    })

    it("takes the place of the server bulletins when there are none", () => {
      const rendered = renderItems(undefined)

      expect(itemKeys(rendered)).toEqual(["notify-card"])
      expect(rendered.getByText("Local card")).toBeTruthy()
      expect(rendered.getByText("Shown by the app")).toBeTruthy()
    })

    it("is not shown next to a server bulletin", () => {
      const rendered = renderItems([makeBulletin()])

      expect(itemKeys(rendered)).toEqual(["server-notif-1"])
    })
  })

  it("returns no card when there is nothing to show", () => {
    const rendered = renderItems(undefined)

    expect(itemKeys(rendered)).toEqual([])
  })

  describe("test bulletins (__DEV__)", () => {
    it("come after the server bulletins", () => {
      testBulletinsStore.add({
        id: "dev-1",
        title: "Dev Bulletin",
        body: "Dev body",
        type: "none",
      })

      const rendered = renderItems([makeBulletin({ id: "real-1" })])

      expect(itemKeys(rendered)).toEqual(["server-real-1", "test-dev-1"])
    })

    it("render their icon", () => {
      testBulletinsStore.add({
        id: "dev-icon",
        title: "With Icon",
        body: "Has icon",
        icon: "info",
        type: "none",
      })

      const rendered = renderItems(undefined)

      expect(rendered.getByTestId("galoy-icon-info")).toBeTruthy()
    })

    it("open a deep link on press and leave", async () => {
      testBulletinsStore.add({
        id: "dev-dl",
        title: "Deep Link Test",
        body: "Tap to open",
        type: "deep-link",
        deepLink: "card/onboarding",
      })
      const rendered = renderItems(undefined)

      fireEvent.press(rendered.getByText("Deep Link Test"))

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith("blink:/card/onboarding")
        expect(testBulletinsStore.getSnapshot()).toEqual([])
      })
    })

    it("open an external link on press", async () => {
      testBulletinsStore.add({
        id: "dev-ext",
        title: "External Test",
        body: "Tap to visit",
        type: "external-link",
        url: "https://www.blink.sv",
      })
      const rendered = renderItems(undefined)

      fireEvent.press(rendered.getByText("External Test"))

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith("https://www.blink.sv")
      })
    })

    it("open nothing on press when they have no link", async () => {
      testBulletinsStore.add({
        id: "dev-none",
        title: "No Action",
        body: "Just info",
        type: "none",
      })
      const rendered = renderItems(undefined)

      fireEvent.press(rendered.getByText("No Action"))

      await waitFor(() => {
        expect(testBulletinsStore.getSnapshot()).toEqual([])
      })
      expect(Linking.openURL).not.toHaveBeenCalled()
    })

    it("leave on dismiss", async () => {
      testBulletinsStore.add({
        id: "dev-dismiss",
        title: "Dismissable",
        body: "Dismiss me",
        type: "none",
      })
      const rendered = renderItems(undefined)

      fireEvent.press(rendered.getByTestId("icon-button-close"))

      await waitFor(() => {
        expect(testBulletinsStore.getSnapshot()).toEqual([])
      })
    })
  })
})

/** The carousel remounts once, so a cold load opens on the newest server bulletin rather
 *  than on the app card it was first built from; never again after that. */
describe("the carousel key", () => {
  type HookProps = Parameters<typeof useServerBulletinItems>[0]
  const renderKey = (initial: HookProps) =>
    renderHook((props: HookProps) => useServerBulletinItems(props).carouselKey, {
      initialProps: initial,
    })

  it("changes when the first response brings server bulletins the carousel opened without", () => {
    const hook = renderKey({ loading: true, bulletins: undefined })
    const opened = hook.result.current

    hook.rerender({ loading: false, bulletins: makeBulletinsQuery([makeBulletin()]) })

    expect(hook.result.current).not.toBe(opened)
  })

  it("keeps it across later refetches, whatever they bring", () => {
    const hook = renderKey({ loading: true, bulletins: undefined })
    hook.rerender({ loading: false, bulletins: makeBulletinsQuery([makeBulletin()]) })
    const settled = hook.result.current

    hook.rerender({ loading: true, bulletins: makeBulletinsQuery([makeBulletin()]) })
    hook.rerender({
      loading: false,
      bulletins: makeBulletinsQuery([
        makeBulletin({ id: "newer", createdAt: CUTOFF + 2 * HOUR }),
        makeBulletin(),
      ]),
    })

    expect(hook.result.current).toBe(settled)
  })

  it("keeps it when the carousel opened on cached server bulletins", () => {
    const cached = makeBulletinsQuery([makeBulletin()])
    const hook = renderKey({ loading: true, bulletins: cached })
    const opened = hook.result.current

    hook.rerender({
      loading: false,
      bulletins: makeBulletinsQuery([
        makeBulletin({ id: "newer", createdAt: CUTOFF + 2 * HOUR }),
        makeBulletin(),
      ]),
    })

    expect(hook.result.current).toBe(opened)
  })

  it("keeps it when the first response brings no server bulletin, and after", () => {
    const hook = renderKey({ loading: true, bulletins: undefined })
    const opened = hook.result.current

    hook.rerender({ loading: false, bulletins: makeBulletinsQuery([]) })
    hook.rerender({ loading: false, bulletins: makeBulletinsQuery([makeBulletin()]) })

    expect(hook.result.current).toBe(opened)
  })
})
