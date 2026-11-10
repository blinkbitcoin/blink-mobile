import React from "react"
import { StyleSheet } from "react-native"
import Modal from "react-native-modal"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { Scope } from "@app/graphql/generated"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ApiScreen } from "@app/screens/settings-screen/api-screen"
import { RevokeApiKeyModal } from "@app/screens/settings-screen/api/revoke-api-key-modal"
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

const INACTIVE_TOGGLE = "inactive-keys-toggle"

const renderScreen = () =>
  render(
    <ContextForScreen>
      <ApiScreen />
    </ContextForScreen>,
  )

/** Holds apiKeyRevoke open until the returned finish() is called. */
const deferRevoke = () => {
  let finish = () => {}
  apiKeyRevokeMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({
            data: { apiKeyRevoke: { apiKey: makeApiKey({ revoked: true }) } },
          })
      }),
  )
  return () => finish()
}

const openRevokeModal = async (name = "BTCPay") => {
  await screen.findByText(name)
  fireEvent.press(screen.getByTestId(`${name}-right`))
  await screen.findByText(LL.ApiScreen.revokeTitle())
}

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

    renderScreen()
    fireEvent.press(await screen.findByTestId(INACTIVE_TOGGLE))

    expect(await screen.findByText(new RegExp(LL.ApiScreen.revoked()))).toBeTruthy()
    expect(screen.getByText(/Expired/)).toBeTruthy()

    fireEvent.press(screen.getByTestId("Old key-right"))
    expect(screen.queryByText(LL.ApiScreen.revokeTitle())).toBeNull()
  })

  it("renders an expired key without inventing a date when expiresAt is missing", async () => {
    apiKeysQueryMock.mockReturnValue(
      makeQueryResult([
        makeApiKey({ id: "key-e", name: "Stale key", expired: true, expiresAt: null }),
      ]),
    )

    renderScreen()
    fireEvent.press(await screen.findByTestId(INACTIVE_TOGGLE))

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

    renderScreen()
    fireEvent.press(await screen.findByTestId(INACTIVE_TOGGLE))

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

  it("asks before revoking in a modal, with the key's name", async () => {
    renderScreen()

    await openRevokeModal()

    expect(screen.getByText(LL.ApiScreen.revokeBody({ name: "BTCPay" }))).toBeTruthy()
    expect(screen.getByText(LL.ApiScreen.revokeGoBack())).toBeTruthy()
    expect(screen.getByText(LL.ApiScreen.revoke())).toBeTruthy()
  })

  it("revokes nothing when going back from the modal", async () => {
    renderScreen()
    await openRevokeModal()

    fireEvent.press(screen.getByText(LL.ApiScreen.revokeGoBack()))

    expect(screen.UNSAFE_getByType(Modal).props.isVisible).toBe(false)
    // the name stays put while the modal fades out
    expect(screen.getByText(LL.ApiScreen.revokeBody({ name: "BTCPay" }))).toBeTruthy()
    expect(apiKeyRevokeMock).not.toHaveBeenCalled()
  })

  it("revokes a key after confirming in the modal", async () => {
    renderScreen()
    await openRevokeModal()

    fireEvent.press(screen.getByText(LL.ApiScreen.revoke()))

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

  it("keeps the modal open and its actions disabled while a revoke is in flight", async () => {
    const finishRevoke = deferRevoke()

    renderScreen()
    await openRevokeModal()
    fireEvent.press(screen.getByText(LL.ApiScreen.revoke()))
    await waitFor(() => expect(apiKeyRevokeMock).toHaveBeenCalledTimes(1))

    const goBack = screen.getByTestId(LL.ApiScreen.revokeGoBack())
    const closeIcon = screen.getByLabelText(LL.common.close())
    expect(goBack.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    )
    expect(closeIcon.props.accessibilityState).toEqual({ disabled: true })

    fireEvent.press(goBack)
    fireEvent.press(closeIcon)
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onBackdropPress()
      screen.UNSAFE_getByType(Modal).props.onBackButtonPress()
    })
    expect(screen.UNSAFE_getByType(Modal).props.isVisible).toBe(true)

    finishRevoke()

    await waitFor(() =>
      expect(screen.UNSAFE_getByType(Modal).props.isVisible).toBe(false),
    )
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: LL.ApiScreen.revokeSuccess() }),
    )
  })

  it("sends one revoke when it is confirmed twice before the first lands", async () => {
    const finishRevoke = deferRevoke()

    renderScreen()
    await openRevokeModal()
    const { onRevoke, apiKey } = screen.UNSAFE_getByType(RevokeApiKeyModal).props
    await act(async () => {
      onRevoke(apiKey)
      onRevoke(apiKey)
    })

    expect(apiKeyRevokeMock).toHaveBeenCalledTimes(1)

    finishRevoke()
    await waitFor(() =>
      expect(screen.UNSAFE_getByType(Modal).props.isVisible).toBe(false),
    )
    expect(toastShow).toHaveBeenCalledTimes(1)
  })

  it("leaves another key's modal open when an earlier revoke lands", async () => {
    apiKeysQueryMock.mockReturnValue(
      makeQueryResult([
        makeApiKey({ id: "key-a", name: "Shop A" }),
        makeApiKey({ id: "key-b", name: "Shop B" }),
      ]),
    )
    const finishRevoke = deferRevoke()

    renderScreen()
    await openRevokeModal("Shop A")
    fireEvent.press(screen.getByText(LL.ApiScreen.revoke()))
    await waitFor(() => expect(apiKeyRevokeMock).toHaveBeenCalledTimes(1))

    act(() => screen.UNSAFE_getByType(RevokeApiKeyModal).props.onClose())
    fireEvent.press(screen.getByTestId("Shop B-right"))
    expect(screen.UNSAFE_getByType(RevokeApiKeyModal).props.apiKey.id).toBe("key-b")

    finishRevoke()

    await waitFor(() => expect(toastShow).toHaveBeenCalledTimes(1))
    expect(screen.UNSAFE_getByType(RevokeApiKeyModal).props.apiKey.id).toBe("key-b")
    expect(screen.UNSAFE_getByType(Modal).props.isVisible).toBe(true)
  })

  it("shows an error toast when revoking fails", async () => {
    apiKeyRevokeMock.mockRejectedValueOnce(new Error("boom"))

    renderScreen()
    await openRevokeModal()
    fireEvent.press(screen.getByText(LL.ApiScreen.revoke()))

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

  describe("inactive keys section", () => {
    const activeKey = makeApiKey({
      id: "key-a",
      name: "Live shop",
      createdAt: 1700000100,
    })
    const revokedKey = makeApiKey({
      id: "key-r",
      name: "Old test",
      revoked: true,
      createdAt: 1700000300,
    })
    const expiredKey = makeApiKey({
      id: "key-e",
      name: "Old bot",
      expired: true,
      createdAt: 1700000200,
    })

    beforeEach(() => {
      apiKeysQueryMock.mockReturnValue(
        makeQueryResult([expiredKey, activeKey, revokedKey]),
      )
    })

    it("lists only active keys, with the inactive ones collapsed under a count", async () => {
      renderScreen()

      expect(await screen.findByText(activeKey.name)).toBeTruthy()
      expect(screen.getByText(LL.ApiScreen.inactiveKeys({ count: 2 }))).toBeTruthy()
      expect(screen.queryByText(revokedKey.name)).toBeNull()
      expect(screen.queryByText(expiredKey.name)).toBeNull()
    })

    it("expands newest first and collapses again", async () => {
      renderScreen()

      const toggle = await screen.findByTestId(INACTIVE_TOGGLE)
      expect(toggle.props.accessibilityState).toEqual({ expanded: false })

      fireEvent.press(toggle)
      expect(screen.getByTestId(INACTIVE_TOGGLE).props.accessibilityState).toEqual({
        expanded: true,
      })
      const names = screen
        .getAllByText(/^Old (test|bot)$/)
        .map((node) => node.props.children)
      expect(names).toEqual([revokedKey.name, expiredKey.name])

      fireEvent.press(screen.getByTestId(INACTIVE_TOGGLE))
      expect(screen.queryByText(revokedKey.name)).toBeNull()
    })

    it("draws inactive keys at full opacity", async () => {
      renderScreen()
      fireEvent.press(await screen.findByTestId(INACTIVE_TOGGLE))

      let node = screen.getByText(revokedKey.name).parent
      while (node) {
        expect(StyleSheet.flatten(node.props.style)?.opacity ?? 1).toBe(1)
        node = node.parent
      }
    })

    it("drops the empty state when every key is inactive", async () => {
      apiKeysQueryMock.mockReturnValue(makeQueryResult([revokedKey, expiredKey]))

      renderScreen()

      expect(await screen.findByTestId(INACTIVE_TOGGLE)).toBeTruthy()
      expect(screen.queryByText(LL.ApiScreen.noKeys())).toBeNull()
      expect(screen.getByText(LL.ApiScreen.createKey())).toBeTruthy()
    })

    it("hides the section when there are no inactive keys", async () => {
      apiKeysQueryMock.mockReturnValue(makeQueryResult([activeKey]))

      renderScreen()

      expect(await screen.findByText(activeKey.name)).toBeTruthy()
      expect(screen.queryByTestId(INACTIVE_TOGGLE)).toBeNull()
    })

    it("hides the section while the key list is loading", async () => {
      apiKeysQueryMock.mockReturnValue({
        loading: true,
        error: undefined,
        data: undefined,
      })

      renderScreen()

      expect(await screen.findByText(LL.ApiScreen.createKey())).toBeTruthy()
      expect(screen.queryByTestId(INACTIVE_TOGGLE)).toBeNull()
    })

    it("moves a key into the section once it's revoked", async () => {
      const { rerender } = renderScreen()
      await screen.findByText(activeKey.name)

      apiKeysQueryMock.mockReturnValue(
        makeQueryResult([expiredKey, { ...activeKey, revoked: true }, revokedKey]),
      )
      rerender(
        <ContextForScreen>
          <ApiScreen />
        </ContextForScreen>,
      )

      expect(screen.getByText(LL.ApiScreen.inactiveKeys({ count: 3 }))).toBeTruthy()
      expect(screen.queryByText(activeKey.name)).toBeNull()
    })
  })
})
