import * as React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"

import { UserContact } from "@app/graphql/generated"
import theme from "@app/rne-theme/theme"
import {
  ContactsDetailScreen,
  ContactsDetailScreenJSX,
} from "@app/screens/people-screen/contacts/contacts-detail"

import { findPressableParent } from "../../helper"

const mockNavigate = jest.fn()
const mockLnAddressHostname = jest.fn()

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: mockLnAddressHostname() } },
  }),
}))

/** The list has its own spec; here it only has to report the contact it was handed. */
jest.mock("@app/screens/people-screen/contacts/contact-transactions", () => ({
  ContactTransactions: ({ contact }: { contact: { id: string } }) => {
    const { View } = jest.requireActual("react-native")
    return <View testID={`contact-transactions-${contact.id}`} />
  },
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

/** Real translations so the send button reads like production. */
jest.mock("@app/i18n/i18n-react", () => {
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  loadLocale("en")
  const LL = i18nObject("en")

  return { useI18nContext: () => ({ LL, locale: "en" }) }
})

const makeContact = (overrides: Partial<UserContact> = {}): UserContact => ({
  __typename: "UserContact",
  id: "contact-1",
  handle: "alice@blink.sv",
  username: "alice",
  alias: "Alice",
  transactionsCount: 2,
  ...overrides,
})

const renderContactsDetail = (contact: UserContact) =>
  render(
    <ThemeProvider theme={theme}>
      <ContactsDetailScreenJSX contact={contact} />
    </ThemeProvider>,
  )

describe("ContactsDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLnAddressHostname.mockReturnValue("blink.sv")
  })

  it("heads the screen with the contact's lightning address", () => {
    const { getByText } = renderContactsDetail(makeContact())

    expect(getByText("alice@blink.sv")).toBeTruthy()
  })

  it("keeps a long address on one line rather than breaking it in two", () => {
    const { getByText } = renderContactsDetail(
      makeContact({ handle: "deepbassoon958@walletofsatoshi.com" }),
    )

    expect(getByText("deepbassoon958@walletofsatoshi.com").props.numberOfLines).toBe(1)
  })

  it("completes a bare handle with the instance hostname", () => {
    const { getByText } = renderContactsDetail(makeContact({ handle: " alice " }))

    expect(getByText("alice@blink.sv")).toBeTruthy()
  })

  it("heads the screen with nothing rather than a bare domain", () => {
    // A contact with no handle has no address to show, and "@blink.sv" would read
    // like one belonging to nobody.
    const { queryByText } = renderContactsDetail(makeContact({ handle: "  " }))

    expect(queryByText(/@/)).toBeNull()
  })

  it("hands the contact to the transactions list", () => {
    const { getByTestId } = renderContactsDetail(makeContact())

    expect(getByTestId("contact-transactions-contact-1")).toBeTruthy()
  })

  it("opens the send flow for the contact", () => {
    const contact = makeContact()
    const { getByText } = renderContactsDetail(contact)

    fireEvent.press(findPressableParent(getByText("Send")))

    expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
      username: contact.username,
    })
  })

  it("reads the contact off the route it was navigated with", () => {
    const contact = makeContact({ id: "contact-2", handle: "bob@blink.sv" })
    const route = { params: { contact } } as React.ComponentProps<
      typeof ContactsDetailScreen
    >["route"]

    const { getByText, getByTestId } = render(
      <ThemeProvider theme={theme}>
        <ContactsDetailScreen route={route} />
      </ThemeProvider>,
    )

    expect(getByText("bob@blink.sv")).toBeTruthy()
    expect(getByTestId("contact-transactions-contact-2")).toBeTruthy()
  })
})
