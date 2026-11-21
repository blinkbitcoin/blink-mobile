import React from "react"
import { Share } from "react-native"

import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { InviteModal } from "@app/components/invite-modal"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { InviteFriendsCard } from "@app/screens/people-screen/circles/invite-friends-card"

import { ContextForScreen } from "../screens/helper"

const INVITE_LINK = "https://get.blink.sv/alice"

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useInviteQuery: () => ({ data: { me: { id: "1", username: "alice" } } }),
}))

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

jest.mock("@app/components/galoy-toast", () => ({ GaloyToast: () => null }))

jest.mock("@react-native-clipboard/clipboard", () => ({ setString: jest.fn() }))

const mockNotifyModal = jest.fn()
jest.mock("@app/components/notifications", () => ({
  ...jest.requireActual("@app/components/notifications"),
  useNotifications: () => ({ notifyModal: mockNotifyModal }),
}))

loadLocale("en")
const LL = i18nObject("en")

const Clipboard = jest.requireMock("@react-native-clipboard/clipboard")

describe("an invite the share sheet fails to send", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Share, "share").mockRejectedValue(new Error("share sheet failed"))
  })

  /** The invite modal is a modal itself, and iOS presents a modal only from the one on
   *  top: the message shows inside it, not through the app's queue. */
  it("says so inside the invite modal, and Copy link copies the invite", async () => {
    render(
      <ContextForScreen>
        <InviteModal isVisible setIsVisible={() => {}} />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByText(LL.Circles.share()))
    })

    expect(mockNotifyModal).not.toHaveBeenCalled()
    expect(screen.getByText(LL.Messages.shareFailedTitle())).toBeTruthy()
    expect(screen.getByText(LL.Messages.shareInviteFailedBody())).toBeTruthy()

    fireEvent.press(screen.getByText(LL.Messages.copyLink()))

    expect(Clipboard.setString).toHaveBeenCalledWith(INVITE_LINK)
    expect(screen.queryByText(LL.Messages.shareFailedTitle())).toBeNull()
  })

  it("closes inside the invite modal without copying", async () => {
    render(
      <ContextForScreen>
        <InviteModal isVisible setIsVisible={() => {}} />
      </ContextForScreen>,
    )
    await act(async () => {
      fireEvent.press(screen.getByText(LL.Circles.share()))
    })

    fireEvent.press(screen.getAllByTestId("modal-close").at(-1)!)

    expect(Clipboard.setString).not.toHaveBeenCalled()
    expect(screen.queryByText(LL.Messages.shareFailedTitle())).toBeNull()
  })

  it("says so from the Circles card, and Copy link copies the invite", async () => {
    render(
      <ContextForScreen>
        <InviteFriendsCard />
      </ContextForScreen>,
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId("share"))
    })

    const message = mockNotifyModal.mock.lastCall?.[0]
    expect(message).toMatchObject({
      icon: "warning-circle",
      title: LL.Messages.shareFailedTitle(),
      text: LL.Messages.shareInviteFailedBody(),
      primaryButtonTitle: LL.Messages.copyLink(),
    })

    act(() => message.primaryButtonAction())

    expect(Clipboard.setString).toHaveBeenCalledWith(INVITE_LINK)
  })
})
