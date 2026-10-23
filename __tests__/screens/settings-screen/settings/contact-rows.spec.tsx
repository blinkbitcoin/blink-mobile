import React from "react"
import { render } from "@testing-library/react-native"

import { EmailSetting } from "@app/screens/settings-screen/account/settings/email"
import { PhoneSetting } from "@app/screens/settings-screen/account/settings/phone"
import { ContactField } from "@app/types/two-factor-enforcement"

import { flushEffects } from "../../../helpers/flush-effects"
import { ContextForScreen } from "../../helper"

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

type RowProps = {
  title: string
  action: (() => void) | null
  rightIcon?: string | null
  rightIconAction?: () => void
}
/** The row as the settings hand it over: its title, its icon and what each part does. */
const mockRow = jest.fn()
jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: (props: RowProps) => {
    mockRow(props)
    return null
  },
}))

const mockModal = jest.fn()
jest.mock("@app/custodial/components/contact-change-needs-authenticator-modal", () => ({
  ContactChangeNeedsAuthenticatorModal: (props: object) => {
    mockModal(props)
    return null
  },
}))

const mockStartChange = jest.fn()
const mockChange = {
  startChange: mockStartChange,
  isNeedsAuthenticatorVisible: false,
  closeNeedsAuthenticator: jest.fn(),
  setAuthenticator: jest.fn(),
  openRequestedOnboarding: jest.fn(),
}
const mockUseContactChange = jest.fn()
jest.mock("@app/custodial/hooks/use-contact-change", () => ({
  useContactChange: (...args: unknown[]) => {
    mockUseContactChange(...args)
    return mockChange
  },
}))

const mockPromptReverification = jest.fn()
jest.mock("@app/hooks/use-email-reverification", () => ({
  useEmailReverification: () => ({
    promptReverification: mockPromptReverification,
    spinner: false,
  }),
}))

const EMAIL = "someone@example.com"
const PHONE = "+50760000000"

type LoginMethods = {
  loading: boolean
  email?: string
  emailVerified: boolean
  phone?: string
  phoneVerified: boolean
  bothEmailAndPhoneVerified: boolean
  hasAuthenticator: boolean
}
const BOTH_VERIFIED: LoginMethods = {
  loading: false,
  email: EMAIL,
  emailVerified: true,
  phone: PHONE,
  phoneVerified: true,
  bothEmailAndPhoneVerified: true,
  hasAuthenticator: true,
}
let mockLoginMethods: LoginMethods = BOTH_VERIFIED
jest.mock("@app/screens/settings-screen/account/login-methods-hook", () => ({
  useLoginMethods: () => mockLoginMethods,
}))

const lastRow = (): RowProps => mockRow.mock.calls.at(-1)?.[0]

const renderRow = async (Row: React.FC, loginMethods: Partial<LoginMethods> = {}) => {
  mockLoginMethods = { ...BOTH_VERIFIED, ...loginMethods }
  render(
    <ContextForScreen>
      <Row />
    </ContextForScreen>,
  )
  await flushEffects()
  return lastRow()
}

describe("EmailSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("changes a verified email the phone number backs from its pen", async () => {
    const row = await renderRow(EmailSetting)

    expect(row.title).toBe(EMAIL)
    expect(row.rightIcon).toBe("pencil")
    expect(row.action).toBeNull()
    row.rightIconAction?.()
    expect(mockStartChange).toHaveBeenCalledTimes(1)
    expect(mockUseContactChange).toHaveBeenCalledWith(ContactField.Email, true)
  })

  it("offers nothing on the account's only login method", async () => {
    const row = await renderRow(EmailSetting, {
      phone: undefined,
      phoneVerified: false,
      bothEmailAndPhoneVerified: false,
    })

    expect(row.rightIcon).toBeNull()
    expect(row.rightIconAction).toBeUndefined()
    expect(row.action).toBeNull()
  })

  it("confirms an unverified address again from its icon", async () => {
    const row = await renderRow(EmailSetting, {
      emailVerified: false,
      bothEmailAndPhoneVerified: false,
    })

    expect(row.rightIcon).toBe("refresh")
    row.rightIconAction?.()
    expect(mockPromptReverification).toHaveBeenCalledWith(EMAIL)
    expect(mockStartChange).not.toHaveBeenCalled()
  })

  it("adds an email from the row when there is none", async () => {
    const row = await renderRow(EmailSetting, {
      email: undefined,
      emailVerified: false,
      bothEmailAndPhoneVerified: false,
    })

    expect(row.rightIcon).toBeUndefined()
    row.action?.()
    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate")
  })

  it("hands the modal the change's state and actions", async () => {
    await renderRow(EmailSetting, { hasAuthenticator: false })

    expect(mockUseContactChange).toHaveBeenCalledWith(ContactField.Email, false)
    expect(mockModal).toHaveBeenLastCalledWith({
      field: ContactField.Email,
      isVisible: mockChange.isNeedsAuthenticatorVisible,
      onClose: mockChange.closeNeedsAuthenticator,
      onSetAuthenticator: mockChange.setAuthenticator,
      onHidden: mockChange.openRequestedOnboarding,
    })
  })
})

describe("PhoneSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("changes a verified phone number the email backs from its pen", async () => {
    const row = await renderRow(PhoneSetting)

    expect(row.title).toBe(PHONE)
    expect(row.rightIcon).toBe("pencil")
    expect(row.action).toBeNull()
    row.rightIconAction?.()
    expect(mockStartChange).toHaveBeenCalledTimes(1)
    expect(mockUseContactChange).toHaveBeenCalledWith(ContactField.Phone, true)
  })

  it("offers nothing on the account's only login method", async () => {
    const row = await renderRow(PhoneSetting, {
      email: undefined,
      emailVerified: false,
      bothEmailAndPhoneVerified: false,
    })

    expect(row.rightIcon).toBeNull()
    expect(row.rightIconAction).toBeUndefined()
  })

  it("adds a phone number from the row when there is none", async () => {
    const row = await renderRow(PhoneSetting, {
      phone: undefined,
      phoneVerified: false,
      bothEmailAndPhoneVerified: false,
    })

    expect(row.rightIcon).toBe("caret-right")
    row.action?.()
    expect(mockNavigate).toHaveBeenCalledWith("phoneRegistrationInitiate")
  })

  it("hands the modal the change's state and actions", async () => {
    await renderRow(PhoneSetting)

    expect(mockModal).toHaveBeenLastCalledWith({
      field: ContactField.Phone,
      isVisible: mockChange.isNeedsAuthenticatorVisible,
      onClose: mockChange.closeNeedsAuthenticator,
      onSetAuthenticator: mockChange.setAuthenticator,
      onHidden: mockChange.openRequestedOnboarding,
    })
  })
})
