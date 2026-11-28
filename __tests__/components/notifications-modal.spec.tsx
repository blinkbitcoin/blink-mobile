import { it } from "@jest/globals"
import React from "react"
import { Pressable, Text } from "react-native"

import { act, fireEvent, render, screen } from "@testing-library/react-native"

import {
  MessageIcon,
  NotificationsProvider,
  useNotifications,
} from "@app/components/notifications"
import { AuthenticationContextProvider } from "@app/navigation/authentication-context"

const mockSession = { galoyAuthToken: "token-a", activeAccountId: undefined }
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ persistentState: mockSession }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = {
    accent: "#ffad0d",
    textPrimary: "#ccc",
    surfaceInteractive: "#f5f5f5",
    backgroundDefault: "#fff",
    textOnBackground: "#000",
  }
  const ThemedText = ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children)
  return {
    makeStyles:
      (fn: (...args: unknown[]) => Record<string, object>) => (props?: unknown) =>
        fn({ colors }, props ?? {}),
    Text: ThemedText,
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

jest.mock("react-native-gesture-handler", () => {
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  return { ScrollView: RN.View }
})

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: ({ name }: { name: string }) =>
    React.createElement("View", { testID: `icon-${name}` }),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement("Pressable", { onPress, testID: `primary-${title}` }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({ LL: { common: { close: () => "Close" } } }),
}))

type Message = Parameters<ReturnType<typeof useNotifications>["notifyModal"]>[0]

/** A screen that queues the messages it is given when pressed, as a screen would. */
const Notifier: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const { notifyModal } = useNotifications()
  return (
    <Pressable testID="notify" onPress={() => messages.forEach(notifyModal)}>
      <Text>notify</Text>
    </Pressable>
  )
}

const message = (overrides: Partial<Message> = {}): Message => ({
  icon: MessageIcon.Success,
  title: "Phone number confirmed",
  text: "You can now log in with this number.",
  primaryButtonTitle: "Okay",
  ...overrides,
})

let setLocked: (isLocked: boolean) => void = () => {}
let rerenderApp: () => void = () => {}

/** The app's lock, which the resume relock raises and the unlock screen lowers. */
const App: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isAppLocked, setIsAppLocked] = React.useState(false)
  const [, setRenderCount] = React.useState(0)
  setLocked = setIsAppLocked
  rerenderApp = () => setRenderCount((count) => count + 1)
  const value = React.useMemo(
    () => ({
      isAppLocked,
      readIsAppLocked: () => isAppLocked,
      setAppLocked: () => setIsAppLocked(true),
      setAppUnlocked: () => setIsAppLocked(false),
    }),
    [isAppLocked],
  )
  return (
    <AuthenticationContextProvider value={value}>
      <NotificationsProvider>{children}</NotificationsProvider>
    </AuthenticationContextProvider>
  )
}

const notify = (...messages: Message[]) => {
  render(
    <App>
      <Notifier messages={messages} />
    </App>,
  )
  fireEvent.press(screen.getByTestId("notify"))
}

const relock = () => act(() => setLocked(true))
const unlock = () => act(() => setLocked(false))

describe("NotificationsProvider pop-up", () => {
  it("shows the icon, the title, the line and the button", () => {
    notify(message())

    expect(screen.getByTestId("icon-payment-success")).toBeTruthy()
    expect(screen.getByText("Phone number confirmed")).toBeTruthy()
    expect(screen.getByText("You can now log in with this number.")).toBeTruthy()
    expect(screen.getByTestId("primary-Okay")).toBeTruthy()
  })

  /** The close icon is the way out of every message, not only of those with a dismiss. */
  it("always offers the close icon", () => {
    notify(message())

    expect(screen.getByTestId("modal-close")).toBeTruthy()
  })

  it("runs the button's action once the pop-up is off the screen", () => {
    const action = jest.fn()
    const dismiss = jest.fn()
    notify(message({ primaryButtonAction: action, dismissAction: dismiss }))

    fireEvent.press(screen.getByTestId("primary-Okay"))

    expect(action).toHaveBeenCalledTimes(1)
    expect(dismiss).not.toHaveBeenCalled()
    expect(screen.queryByText("Phone number confirmed")).toBeNull()
  })

  it.each(["modal-close", "backdrop", "back-button"])(
    "runs the dismiss, not the button's action, from %s",
    (testID) => {
      const action = jest.fn()
      const dismiss = jest.fn()
      notify(message({ primaryButtonAction: action, dismissAction: dismiss }))

      fireEvent.press(screen.getByTestId(testID))

      expect(dismiss).toHaveBeenCalledTimes(1)
      expect(action).not.toHaveBeenCalled()
    },
  )

  /** A follow-up that navigates or logs out must not run twice from a double tap, nor
   *  from the backdrop pressed while the button's tap is still closing it. */
  it("takes one way out per pop-up", () => {
    const action = jest.fn()
    const dismiss = jest.fn()
    notify(message({ primaryButtonAction: action, dismissAction: dismiss }))
    const button = screen.getByTestId("primary-Okay")
    const backdrop = screen.getByTestId("backdrop")

    /** In one act, so no render lands between the taps. */
    act(() => {
      fireEvent.press(button)
      fireEvent.press(button)
      fireEvent.press(backdrop)
    })

    expect(action).toHaveBeenCalledTimes(1)
    expect(dismiss).not.toHaveBeenCalled()
  })

  it("shows one pop-up at a time, the next once the first is closed", () => {
    notify(message(), message({ title: "Couldn't open sharing" }))

    expect(screen.getByText("Phone number confirmed")).toBeTruthy()
    expect(screen.queryByText("Couldn't open sharing")).toBeNull()

    fireEvent.press(screen.getByTestId("primary-Okay"))

    expect(screen.queryByText("Phone number confirmed")).toBeNull()
    expect(screen.getByText("Couldn't open sharing")).toBeTruthy()
  })

  /** Try again can fail again: its new message waits behind nothing and shows. */
  it("shows a message the button's action raises", () => {
    let notifyAgain: (next: Message) => void = () => {}
    const Capture = () => {
      notifyAgain = useNotifications().notifyModal
      return null
    }
    render(
      <App>
        <Capture />
      </App>,
    )
    act(() =>
      notifyAgain(
        message({
          title: "Couldn't load this merchant",
          primaryButtonTitle: "Try again",
          primaryButtonAction: () =>
            notifyAgain(message({ title: "Still couldn't load this merchant" })),
        }),
      ),
    )

    fireEvent.press(screen.getByTestId("primary-Try again"))

    expect(screen.getByText("Still couldn't load this merchant")).toBeTruthy()
  })

  describe("when the app relocks", () => {
    beforeEach(() => {
      mockSession.galoyAuthToken = "token-a"
    })

    /** Nothing in it can be answered from under the lock: a copy would land on the
     *  phone's clipboard before anyone unlocked. */
    it("takes the pop-up off the screen while the lock is up", () => {
      notify(message({ isRequired: true }))

      relock()

      expect(screen.queryByText("Phone number confirmed")).toBeNull()
    })

    it("brings a required pop-up back after the unlock and runs its way out then", () => {
      const leave = jest.fn()
      notify(message({ isRequired: true, primaryButtonAction: leave }))

      relock()
      expect(leave).not.toHaveBeenCalled()
      unlock()

      expect(screen.getByText("Phone number confirmed")).toBeTruthy()
      fireEvent.press(screen.getByTestId("primary-Okay"))
      expect(leave).toHaveBeenCalledTimes(1)
    })

    it("drops a pop-up that only informs, without running its action", () => {
      const copy = jest.fn()
      notify(message({ title: "Couldn't open sharing", primaryButtonAction: copy }))

      relock()
      unlock()

      expect(screen.queryByText("Couldn't open sharing")).toBeNull()
      expect(copy).not.toHaveBeenCalled()
    })

    it("keeps the required one and shows only it after the unlock", () => {
      notify(message({ title: "Couldn't open sharing" }), message({ isRequired: true }))

      relock()
      unlock()

      expect(screen.queryByText("Couldn't open sharing")).toBeNull()
      expect(screen.getByText("Phone number confirmed")).toBeTruthy()
    })

    /** The way out the user took while it was closing would run under the lock, where
     *  the screen it moves is not in front, and be lost: it is asked again instead. */
    it("does not take a way out the lock interrupted, and asks again after it", () => {
      const leave = jest.fn()
      notify(message({ isRequired: true, primaryButtonAction: leave }))

      /** The hide that would run the way out lands after the lock, in the same act. */
      act(() => {
        fireEvent.press(screen.getByTestId("primary-Okay"))
        setLocked(true)
      })
      expect(leave).not.toHaveBeenCalled()

      unlock()
      fireEvent.press(screen.getByTestId("primary-Okay"))
      expect(leave).toHaveBeenCalledTimes(1)
    })

    /** The lock screen's own logout says goodbye from under the lock it raised over. */
    it("shows a pop-up raised while the lock is up", () => {
      render(
        <App>
          <Notifier messages={[message({ title: "You're logged out" })]} />
        </App>,
      )
      relock()

      fireEvent.press(screen.getByTestId("notify"))

      expect(screen.getByText("You're logged out")).toBeTruthy()
    })

    /** A logout from the lock screen ends the session the held pop-up belongs to. */
    it("drops a held pop-up once the session it was raised in has ended", () => {
      const leave = jest.fn()
      notify(message({ isRequired: true, primaryButtonAction: leave }))

      relock()
      mockSession.galoyAuthToken = "token-b"
      act(() => rerenderApp())
      unlock()

      expect(screen.queryByText("Phone number confirmed")).toBeNull()
      expect(leave).not.toHaveBeenCalled()
    })
  })
})
