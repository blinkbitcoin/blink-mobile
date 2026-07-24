import React from "react"
import { render } from "@testing-library/react-native"

import { PeopleScreen } from "@app/screens/people-screen/people"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = { white: "#FFFFFF" }
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) =>
      () =>
        fn({ colors }),
    useTheme: () => ({ theme: { mode: "light", colors } }),
  }
})

jest.mock("react-native-safe-area-context", () => {
  const ReactActual = jest.requireActual<typeof React>("react")
  return {
    SafeAreaView: ({ children, ...props }: React.PropsWithChildren<object>) =>
      ReactActual.createElement("SafeAreaView", { ...props, testID: "safe-area" }, children),
  }
})

jest.mock("@app/screens/people-screen/circles/circles-card-people-home", () => ({
  CirclesCardPeopleHome: () => null,
}))
jest.mock("@app/screens/people-screen/contacts/contacts-card", () => ({
  ContactsCard: () => null,
}))
jest.mock("@app/screens/people-screen/circles/invite-friends-card", () => ({
  InviteFriendsCard: () => null,
}))

describe("PeopleScreen", () => {
  it("excludes the bottom safe-area edge the tab bar already reserves", () => {
    const { getByTestId } = render(<PeopleScreen />)

    expect(getByTestId("safe-area").props.edges).toEqual(["top", "left", "right"])
  })
})
