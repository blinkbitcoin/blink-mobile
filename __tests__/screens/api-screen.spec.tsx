import React from "react"
import { Alert, AlertButton } from "react-native"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { Scope } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ApiScreen } from "@app/screens/settings-screen/api-screen"
import { toastShow } from "@app/utils/toast"

import { ContextForScreen } from "./helper"

const makeApiKey = (overrides: Record<string, unknown> = {}) => ({
  __typename: "ApiKey" as const,
  id: "key-1",
  name: "BTCPay",
  createdAt: 1700000000,
  revoked: false,
  expired: false,
  lastUsedAt: null,
  expiresAt: null,
  scopes: [Scope.Read, Scope.Receive],
  readOnly: false,
  ...overrides,
})

const makeQueryResult = (apiKeys: ReturnType<typeof makeApiKey>[]) => ({
  loading: false,
  error: undefined,
  data: {
    me: {
      __typename: "User" as const,
      id: "user-id",
      apiKeys,
    },
  },
})

const apiKeysQueryMock = jest.fn()
const apiKeyRevokeMock = jest.fn(() =>
  Promise.resolve({
    data: { apiKeyRevoke: { apiKey: makeApiKey({ revoked: true }) } },
  }),
)

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    useApiKeysQuery: () => apiKeysQueryMock(),
    useApiKeyRevokeMutation: () => [apiKeyRevokeMock],
  }
})

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

loadLocale("en")
const LL = i18nObject("en")

describe("ApiScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    apiKeysQueryMock.mockReturnValue(makeQueryResult([makeApiKey()]))
  })

  it("renders an active key with scopes and expiry", async () => {
    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    expect(await screen.findByText("BTCPay")).toBeTruthy()
    const subtitle = screen.getByText(/Read, Receive · /)
    expect(subtitle.props.children).toContain(LL.ApiScreen.neverExpires())
  })

  it("renders expiry date for keys that expire", async () => {
    apiKeysQueryMock.mockReturnValue(
      makeQueryResult([makeApiKey({ expiresAt: 1897776000 })]),
    )

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    const expectedDate = new Date(1897776000 * 1000).toLocaleDateString()
    expect(
      await screen.findByText(
        `Read, Receive · ${LL.ApiScreen.expiresOn({ date: expectedDate })}`,
      ),
    ).toBeTruthy()
  })

  it("renders revoked and expired keys with status and no revoke action", async () => {
    apiKeysQueryMock.mockReturnValue(
      makeQueryResult([
        makeApiKey({ id: "key-r", name: "Old key", revoked: true }),
        makeApiKey({ id: "key-e", name: "Stale key", expired: true }),
      ]),
    )

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    expect(await screen.findByText(new RegExp(LL.ApiScreen.revoked()))).toBeTruthy()
    expect(screen.getByText(/Expired/)).toBeTruthy()

    const alertSpy = jest.spyOn(Alert, "alert")
    fireEvent.press(screen.getByTestId("Old key-right"))
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it("renders an expired key without inventing a date when expiresAt is missing", async () => {
    apiKeysQueryMock.mockReturnValue(
      makeQueryResult([
        makeApiKey({ id: "key-e", name: "Stale key", expired: true, expiresAt: null }),
      ]),
    )

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    expect(
      await screen.findByText(`Read, Receive · ${LL.ApiScreen.expiredNoDate()}`),
    ).toBeTruthy()
  })

  it("renders the expiry date on expired keys that have one", async () => {
    apiKeysQueryMock.mockReturnValue(
      makeQueryResult([
        makeApiKey({
          id: "key-e",
          name: "Stale key",
          expired: true,
          expiresAt: 1897776000,
        }),
      ]),
    )

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    const expectedDate = new Date(1897776000 * 1000).toLocaleDateString()
    expect(
      await screen.findByText(
        `Read, Receive · ${LL.ApiScreen.expired({ date: expectedDate })}`,
      ),
    ).toBeTruthy()
  })

  it("keeps the create row available while the key list is loading", async () => {
    apiKeysQueryMock.mockReturnValue({ loading: true, error: undefined, data: undefined })

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    expect(await screen.findByText(LL.ApiScreen.createKey())).toBeTruthy()
  })

  it("shows the empty state and the create row when there are no keys", async () => {
    apiKeysQueryMock.mockReturnValue(makeQueryResult([]))

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    expect(await screen.findByText(LL.ApiScreen.noKeys())).toBeTruthy()
    expect(screen.getByText(LL.ApiScreen.createKey())).toBeTruthy()
  })

  it("revokes a key after confirming the alert", async () => {
    const alertSpy = jest.spyOn(Alert, "alert")

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    await screen.findByText("BTCPay")
    fireEvent.press(screen.getByTestId("BTCPay-right"))

    expect(alertSpy).toHaveBeenCalledWith(
      LL.ApiScreen.revokeTitle(),
      LL.ApiScreen.revokeBody({ name: "BTCPay" }),
      expect.any(Array),
    )

    const buttons = alertSpy.mock.calls[0][2] as AlertButton[]
    const revokeButton = buttons.find((button) => button.style === "destructive")
    expect(revokeButton).toBeTruthy()
    revokeButton?.onPress?.()

    await waitFor(() =>
      expect(apiKeyRevokeMock).toHaveBeenCalledWith({
        variables: { input: { id: "key-1" } },
      }),
    )
    await waitFor(() =>
      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          message: LL.ApiScreen.revokeSuccess(),
        }),
      ),
    )
  })

  it("shows an error toast when revoking fails", async () => {
    apiKeyRevokeMock.mockRejectedValueOnce(new Error("boom"))
    const alertSpy = jest.spyOn(Alert, "alert")

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    await screen.findByText("BTCPay")
    fireEvent.press(screen.getByTestId("BTCPay-right"))

    const buttons = alertSpy.mock.calls[0][2] as AlertButton[]
    buttons.find((button) => button.style === "destructive")?.onPress?.()

    await waitFor(() =>
      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          message: LL.ApiScreen.revokeError(),
        }),
      ),
    )
  })

  it("shows an error box when the key list cannot be loaded", async () => {
    apiKeysQueryMock.mockReturnValue({
      loading: false,
      error: new Error("boom"),
      data: undefined,
    })

    render(
      <ContextForScreen>
        <ApiScreen />
      </ContextForScreen>,
    )

    expect(await screen.findByText(LL.ApiScreen.loadError())).toBeTruthy()
  })
})
