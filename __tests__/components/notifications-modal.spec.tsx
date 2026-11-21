import { it } from "@jest/globals"
import React from "react"
import { Pressable, Text } from "react-native"

import { act, fireEvent, render, screen } from "@testing-library/react-native"

import {
  MessageIcon,
  NotificationsProvider,
  useNotifications,
} from "@app/components/notifications"

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

const notify = (...messages: Message[]) => {
  render(
    <NotificationsProvider>
      <Notifier messages={messages} />
    </NotificationsProvider>,
  )
  fireEvent.press(screen.getByTestId("notify"))
}

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
      <NotificationsProvider>
        <Capture />
      </NotificationsProvider>,
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
})
