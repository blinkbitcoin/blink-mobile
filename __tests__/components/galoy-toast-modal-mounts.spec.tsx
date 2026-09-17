import React from "react"
import { render, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { InviteModal } from "@app/components/invite-modal/invite-modal"
import { JuneChallengeModal } from "@app/components/june-challenge/modal"
import { MayChallengeModal } from "@app/components/may-challenge/modal"
import theme from "@app/rne-theme/theme"

// A toast shown while a modal is open renders behind it unless the modal mounts
// its own GaloyToast (see the FIXME in app/utils/toast.ts). These pin that mount.

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

jest.mock("@app/components/galoy-toast", () => {
  const { View } = jest.requireActual("react-native")
  return { GaloyToast: () => <View testID="toast" /> }
})

jest.mock("@app/i18n/i18n-react", () => {
  const sync = jest.requireActual<typeof import("@app/i18n/i18n-util.sync")>(
    "@app/i18n/i18n-util.sync",
  )
  const util =
    jest.requireActual<typeof import("@app/i18n/i18n-util")>("@app/i18n/i18n-util")
  sync.loadLocale("en")
  const LL = util.i18nObject("en")
  return { __esModule: true, useI18nContext: () => ({ LL, locale: "en" }) }
})

jest.mock("@app/screens/people-screen/circles/use-circles-card", () => ({
  useCirclesCard: () => ({ ShareImg: null, share: jest.fn() }),
}))

jest.mock("@app/graphql/generated", () => ({
  useInviteQuery: () => ({ data: { me: { id: "id", username: "user" } } }),
}))

jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("react-native-qrcode-svg", () => () => null)

jest.mock("@app/components/atomic/galoy-icon", () => ({ GaloyIcon: () => null }))

jest.mock("@app/components/atomic/galoy-icon-button", () => ({
  GaloyIconButton: () => null,
}))

const modals = [
  { name: "InviteModal", Modal: InviteModal },
  { name: "JuneChallengeModal", Modal: JuneChallengeModal },
  { name: "MayChallengeModal", Modal: MayChallengeModal },
]

const renderModal = (Modal: (typeof modals)[number]["Modal"], isVisible: boolean) =>
  render(
    <ThemeProvider theme={theme}>
      <Modal isVisible={isVisible} setIsVisible={jest.fn()} />
    </ThemeProvider>,
  )

describe("GaloyToast mounts inside modals", () => {
  modals.forEach(({ name, Modal }) => {
    describe(name, () => {
      it("mounts its own toast inside the open modal", () => {
        const { getByTestId } = renderModal(Modal, true)

        expect(within(getByTestId("modal")).getByTestId("toast")).toBeTruthy()
      })

      it("mounts no toast while closed", () => {
        const { queryByTestId } = renderModal(Modal, false)

        expect(queryByTestId("toast")).toBeNull()
      })
    })
  })
})
