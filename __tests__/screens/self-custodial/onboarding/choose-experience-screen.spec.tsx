import React from "react"
import { Pressable, Text } from "react-native"

import { act, fireEvent, render, within } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { IconHero } from "@app/components/icon-hero"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ChooseExperienceScreen } from "@app/screens/self-custodial/onboarding/choose-experience-screen"
import { AccountMode } from "@app/types/account"

import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

const mockNavigate = jest.fn()
const mockGoBack = jest.fn()
const mockNavReplace = jest.fn()
const mockUnsubscribe = jest.fn()
type BeforeRemoveEvent = {
  data: { action: { type: string } }
  preventDefault: () => void
}
type BeforeRemoveListener = (event: BeforeRemoveEvent) => void
let capturedBeforeRemove: BeforeRemoveListener | undefined
const mockAddListener = jest.fn((event: string, listener: BeforeRemoveListener) => {
  if (event === "beforeRemove") capturedBeforeRemove = listener
  return mockUnsubscribe
})

/** Dispatches the removal the listener sees, so a test names the action it is exercising
 *  rather than the shape react-navigation happens to hand over. */
const dispatchRemoval = (type: string) => {
  const preventDefault = jest.fn()
  capturedBeforeRemove?.({ data: { action: { type } }, preventDefault })
  return preventDefault
}

type RouteParams = RootStackParamList["selfCustodialChooseExperience"]
let mockRouteParams: RouteParams = {
  onContinue: { route: "selfCustodialBackupSuccess", accountId: "sc-account-1" },
}

let mockHasUsdWallet = true

const mockCheckBlockReason = jest.fn()
const mockIsChecking = jest.fn(() => false)

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockNavReplace,
    addListener: mockAddListener,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockSetAccountMode = jest.fn()
const mockSetActiveAccountMode = jest.fn()
let mockAccountMode: string | null = null
let mockStoredModes: Record<string, string> = {}
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({
    accountMode: mockAccountMode,
    getModeFor: (accountId: string) => mockStoredModes[accountId] ?? null,
    setAccountMode: mockSetAccountMode,
    setActiveAccountMode: mockSetActiveAccountMode,
  }),
}))

let mockUsdBalance = 0
let mockWalletReady = true
let mockWalletStatus = "ready"

jest.mock("@app/hooks/use-creation-block", () => ({
  useCreationBlock: () => ({
    checkBlockReason: mockCheckBlockReason,
    isChecking: mockIsChecking(),
    isFirstSignupRuleReady: true,
  }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => ({
    wallets: mockHasUsdWallet
      ? [{ id: "usd-1", walletCurrency: "USD", balance: { amount: mockUsdBalance } }]
      : [],
    isReady: mockWalletReady,
    status: mockWalletStatus,
  }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockRefreshWallets = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ refreshWallets: mockRefreshWallets }),
}))

const mockArmModeSelectionConversion = jest.fn()
jest.mock("@app/screens/conversion-flow/drain-conversion", () => ({
  ...jest.requireActual("@app/screens/conversion-flow/drain-conversion"),
  armModeSelectionConversion: () => mockArmModeSelectionConversion(),
}))

type ConvertModalProps = {
  isVisible: boolean
  toggleModal: () => void
  onTransfer: () => void
}
const mockConvertModal = jest.fn<null, [ConvertModalProps]>(() => null)
jest.mock("@app/self-custodial/components/anon-mode-convert-modal", () => ({
  AnonModeConvertModal: (props: ConvertModalProps) => mockConvertModal(props),
}))

type PrimaryButtonProps = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}
const mockPrimaryButton = jest.fn<null, [PrimaryButtonProps]>()
jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: (props: PrimaryButtonProps) => {
    mockPrimaryButton(props)
    return (
      <Pressable
        testID={`primary-${props.title}`}
        disabled={props.disabled}
        onPress={props.disabled ? undefined : props.onPress}
      >
        <Text>{props.title}</Text>
      </Pressable>
    )
  },
}))

jest.mock("@app/components/icon-hero", () => ({
  IconHero: jest.fn(({ title, subtitle }: { title: string; subtitle: string }) => (
    <>
      <Text>{title}</Text>
      <Text>{subtitle}</Text>
    </>
  )),
}))

loadLocale("en")
const LL = i18nObject("en")
const continueTestId = `primary-${LL.ChooseExperienceScreen.continueButton()}`

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <ChooseExperienceScreen />
    </ContextForScreen>,
  )
  await flushEffects()
  return utils
}

/** Stands in for the account already having recorded a mode on an earlier visit. */
const renderScreenWithStoredMode = async (mode: AccountMode) => {
  mockStoredModes = { "sc-account-1": mode }
  return renderScreen()
}

describe("ChooseExperienceScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountMode = null
    mockStoredModes = {}
    mockUsdBalance = 0
    mockHasUsdWallet = true
    mockWalletReady = true
    mockWalletStatus = "ready"
    mockRefreshWallets.mockResolvedValue(undefined)
    mockCheckBlockReason.mockResolvedValue(null)
    mockIsChecking.mockReturnValue(false)
    mockRouteParams = {
      onContinue: { route: "selfCustodialBackupSuccess", accountId: "sc-account-1" },
    }
    capturedBeforeRemove = undefined
  })

  it("renders the spinner hero with the title", async () => {
    await renderScreen()

    const iconHeroMock = IconHero as unknown as jest.Mock
    const props = iconHeroMock.mock.calls[0][0]

    expect(props.icon).toBe("spinner")
    expect(props.title).toBe(LL.ChooseExperienceScreen.title())
  })

  it("renders both mode options", async () => {
    const { getByTestId } = await renderScreen()

    expect(getByTestId("mode-enhanced")).toBeTruthy()
    expect(getByTestId("mode-anon")).toBeTruthy()
  })

  it("marks Enhanced with the magic-wand icon and Anon with the sunglasses one", async () => {
    const { getByTestId } = await renderScreen()

    expect(
      within(getByTestId("mode-enhanced")).getByTestId("icon-magic-wand"),
    ).toBeTruthy()
    expect(within(getByTestId("mode-anon")).getByTestId("icon-sunglasses")).toBeTruthy()
  })

  it("defaults to Enhanced when the user continues without changing the selection", async () => {
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Enhanced)
  })

  it("persists Anon when the user selects it before continuing", async () => {
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Anon)
  })

  it("forwards to the backup success screen", async () => {
    mockRouteParams = {
      onContinue: { route: "selfCustodialBackupSuccess", accountId: "sc-account-1" },
    }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess")
  })

  it("forwards to the migration balances overview during a migration", async () => {
    mockRouteParams = {
      onContinue: {
        route: "accountMigrationBalancesOverview",
        accountId: "sc-account-1",
      },
    }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("accountMigrationBalancesOverview")
  })

  it("reads the stored mode of the account the caller passed", async () => {
    mockRouteParams = {
      onContinue: { route: "selfCustodialBackupSuccess", accountId: "sc-account-2" },
    }
    mockStoredModes = {
      "sc-account-1": AccountMode.Enhanced,
      "sc-account-2": AccountMode.Anon,
    }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    /** The caller's account, not the active one, decides the preselection. */
    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-2", AccountMode.Anon)
  })

  /** Re-entry is reachable: a back press out of the next screen, or a migration resume
   *  landing back here. Continuing must not downgrade a deliberate Anon to the default. */
  it("preselects the stored mode so a re-entry does not overwrite a deliberate Anon", async () => {
    const { getByTestId } = await renderScreenWithStoredMode(AccountMode.Anon)

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Anon)
  })

  it("still lets the user switch away from the stored mode", async () => {
    const { getByTestId } = await renderScreenWithStoredMode(AccountMode.Anon)

    fireEvent.press(getByTestId("mode-enhanced"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Enhanced)
  })

  it("falls back to Enhanced when the account stored no mode", async () => {
    mockStoredModes = {}
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Enhanced)
  })

  it("carries the mode through terms without storing it when the account is new", async () => {
    mockRouteParams = { onContinue: { route: "acceptTermsAndConditions" } }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
      flow: "selfCustodial",
      mode: AccountMode.Enhanced,
    })
    expect(mockSetAccountMode).not.toHaveBeenCalled()
  })

  it("stores the active account's mode and confirms it when entered from settings", async () => {
    mockRouteParams = { entry: "settings" }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-enhanced"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Enhanced)
    expect(mockNavReplace).toHaveBeenCalledWith("selfCustodialModeSwitchSuccess", {
      mode: AccountMode.Enhanced,
    })
    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockSetAccountMode).not.toHaveBeenCalled()
  })

  it("preselects the current mode and skips the write when it is unchanged", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Anon
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("starts from the Enhanced default on onboarding entries even with an Anon active account", async () => {
    mockAccountMode = AccountMode.Anon
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Enhanced)
  })

  it("lets an Enhanced account switch to Anon from settings", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Anon)
    expect(mockNavReplace).toHaveBeenCalledWith("selfCustodialModeSwitchSuccess", {
      mode: AccountMode.Anon,
    })
  })

  it("preselects the stored mode of the account being restored", async () => {
    mockStoredModes = { "sc-account-1": AccountMode.Anon }
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Anon)
  })

  it("demands the dollar conversion before switching an Enhanced account to Anon", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockUsdBalance = 5000
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockConvertModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isVisible: true }),
    )
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("resumes with Anon preselected when returning from the drain conversion", async () => {
    mockRouteParams = { entry: "settings", initialMode: AccountMode.Anon }
    mockAccountMode = AccountMode.Enhanced
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Anon)
    expect(mockNavReplace).toHaveBeenCalledWith("selfCustodialModeSwitchSuccess", {
      mode: AccountMode.Anon,
    })
  })

  it("refreshes the wallet balance on the settings entry", async () => {
    mockRouteParams = { entry: "settings" }
    await renderScreen()

    expect(mockRefreshWallets).toHaveBeenCalledTimes(1)
  })

  it("does not refresh the wallet balance on onboarding entries", async () => {
    await renderScreen()

    expect(mockRefreshWallets).not.toHaveBeenCalled()
  })

  it("does not mount the conversion modal until the gate demands it", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockUsdBalance = 5000
    await renderScreen()

    expect(mockConvertModal).not.toHaveBeenCalled()
  })

  it("routes the conversion modal's Transfer to the conversion flow", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockUsdBalance = 5000
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    const { onTransfer } = mockConvertModal.mock.calls.at(-1)?.[0] as ConvertModalProps
    mockConvertModal.mockClear()
    act(() => onTransfer())

    expect(mockArmModeSelectionConversion).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("conversionDetails")
    /** Closed means unmounted now, not re-rendered hidden. */
    expect(mockConvertModal).not.toHaveBeenCalled()
  })

  it("dismisses the conversion modal without switching", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockUsdBalance = 5000
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    const { toggleModal } = mockConvertModal.mock.calls.at(-1)?.[0] as ConvertModalProps
    mockConvertModal.mockClear()
    act(() => toggleModal())

    expect(mockConvertModal).not.toHaveBeenCalled()
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
  })

  /** The drain conversion resets back here on a stale cached balance. */
  it("holds Continue until the entry refresh lands, even with the wallet already ready", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockWalletReady = true
    mockRefreshWallets.mockReturnValue(new Promise(() => {}))

    const { getByTestId } = await renderScreen()

    /** Only the Anon-bound switch reads the balance, so the wait is only owed once Anon is
     *  the selection. */
    fireEvent.press(getByTestId("mode-anon"))

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true, loading: true }),
    )
  })

  it("releases Continue once the entry refresh settles", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockWalletReady = true

    await renderScreen()

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false, loading: false }),
    )
  })

  /** A refresh that never answers must not strand the screen. */
  it("releases Continue when the entry refresh fails", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockWalletReady = true
    mockRefreshWallets.mockRejectedValue(new Error("offline"))

    await renderScreen()

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false, loading: false }),
    )
  })

  it("never holds Continue on the onboarding entries, which run no refresh", async () => {
    mockWalletReady = false
    mockRefreshWallets.mockReturnValue(new Promise(() => {}))

    await renderScreen()

    expect(mockRefreshWallets).not.toHaveBeenCalled()
    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false, loading: false }),
    )
  })

  it("holds Continue while the wallet is still syncing on the settings entry", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockWalletReady = false
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: true, loading: true }),
    )
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("keeps the conversion gate even if Continue fires before the wallet syncs", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockUsdBalance = 0
    mockWalletReady = false
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    const { onPress } = mockPrimaryButton.mock.calls.at(-1)?.[0] as PrimaryButtonProps
    await act(async () => onPress())

    expect(mockConvertModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ isVisible: true }),
    )
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  /**
   * Offline and Error are settled answers, not stages: waiting on them never ends, which
   * left Continue disabled with a spinner and nothing to say. The refusal is now spoken and
   * the switch is simply not made.
   */
  it("refuses the Anon switch out loud when the wallet is offline", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockWalletReady = false
    mockWalletStatus = "offline"
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false, loading: false }),
    )

    const { onPress } = mockPrimaryButton.mock.calls.at(-1)?.[0] as PrimaryButtonProps
    await act(async () => {
      await onPress()
    })

    expect(mockToastShow).toHaveBeenCalledTimes(1)
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
  })

  it("refuses the Anon switch out loud when the wallet errored", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockWalletReady = false
    mockWalletStatus = "error"
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    const { onPress } = mockPrimaryButton.mock.calls.at(-1)?.[0] as PrimaryButtonProps
    await act(async () => {
      await onPress()
    })

    expect(mockToastShow).toHaveBeenCalledTimes(1)
    expect(mockSetActiveAccountMode).not.toHaveBeenCalled()
  })

  /**
   * Leaving Anon decides nothing about the balance, so it never waits on the wallet. A user
   * who lost connectivity inside Incognito could otherwise never get back out.
   */
  it("lets the Enhanced-bound switch through with an unreachable wallet", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Anon
    mockWalletReady = false
    mockWalletStatus = "offline"
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-enhanced"))

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false, loading: false }),
    )

    const { onPress } = mockPrimaryButton.mock.calls.at(-1)?.[0] as PrimaryButtonProps
    await act(async () => {
      await onPress()
    })

    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Enhanced)
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("does not hold Continue for the Enhanced-bound switch while the wallet syncs", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Anon
    mockWalletReady = false
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-enhanced"))

    expect(mockPrimaryButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ disabled: false, loading: false }),
    )
  })

  it("does not hold Continue for onboarding entries while the wallet syncs", async () => {
    mockWalletReady = false
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetAccountMode).toHaveBeenCalledWith("sc-account-1", AccountMode.Enhanced)
  })

  it("switches to Anon without the conversion gate when there is no dollar wallet", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockHasUsdWallet = false
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    // Nothing to convert means nothing to warn about.
    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Anon)
  })

  it("switches to Anon without the conversion gate when the dollar balance is empty", async () => {
    mockRouteParams = { entry: "settings" }
    mockAccountMode = AccountMode.Enhanced
    mockUsdBalance = 0
    const { getByTestId } = await renderScreen()

    fireEvent.press(getByTestId("mode-anon"))
    fireEvent.press(getByTestId(continueTestId))
    await flushEffects()

    expect(mockSetActiveAccountMode).toHaveBeenCalledWith(AccountMode.Anon)
    expect(mockNavReplace).toHaveBeenCalledWith("selfCustodialModeSwitchSuccess", {
      mode: AccountMode.Anon,
    })
  })

  /**
   * Restore and migration activate the account before this screen and only the screen ahead
   * resets to Primary, so every way backwards has to be refused, not just the header arrow.
   * Hiding that arrow leaves the Android hardware back untouched, which is what this guard
   * is for.
   */
  describe("leaving backwards", () => {
    it("refuses the hardware back on the restore entry, which arrives with a live account", async () => {
      mockRouteParams = {
        onContinue: { route: "selfCustodialBackupSuccess", accountId: "sc-account-1" },
      }
      await renderScreen()

      expect(capturedBeforeRemove).toBeDefined()
      expect(dispatchRemoval("GO_BACK")).toHaveBeenCalled()
    })

    it("refuses the swipe on the restore entry", async () => {
      mockRouteParams = {
        onContinue: { route: "selfCustodialBackupSuccess", accountId: "sc-account-1" },
      }
      await renderScreen()

      expect(dispatchRemoval("POP")).toHaveBeenCalled()
    })

    it("refuses the hardware back on the migration entry, which arrives past its backup", async () => {
      mockRouteParams = {
        onContinue: {
          route: "accountMigrationBalancesOverview",
          accountId: "sc-account-1",
        },
      }
      await renderScreen()

      expect(dispatchRemoval("GO_BACK")).toHaveBeenCalled()
    })

    /** Creation provisioned nothing yet, so the account type screen behind it is a coherent
     *  place to return to and the guard must stay out of the way. */
    it("registers no guard on the creation entry", async () => {
      mockRouteParams = { onContinue: { route: "acceptTermsAndConditions" } }
      await renderScreen()

      expect(mockAddListener).not.toHaveBeenCalledWith(
        "beforeRemove",
        expect.any(Function),
      )
    })

    /** The guard refuses the user's own back, not every removal. An app-lock or
     *  migration-gate reset has to keep working, and blocking those is how a guard meant to
     *  protect the user ends up trapping them instead. */
    it("lets a reset through, which the screen itself did not cause", async () => {
      await renderScreen()

      expect(dispatchRemoval("RESET")).not.toHaveBeenCalled()
    })

    /** Continuing dispatches NAVIGATE, which removes this screen whenever the destination
     *  already sits on the stack. Refusing that would trap the user on the way forward. */
    it("lets the forward navigation through", async () => {
      await renderScreen()

      expect(dispatchRemoval("NAVIGATE")).not.toHaveBeenCalled()
    })

    /** Settings opens this screen over a live session, so the way back to settings is
     *  coherent and the guard has to stay out of the way there as well. */
    it("registers no guard on the settings entry", async () => {
      mockRouteParams = { entry: "settings" }
      await renderScreen()

      expect(mockAddListener).not.toHaveBeenCalledWith(
        "beforeRemove",
        expect.any(Function),
      )
    })
  })

  describe("the region rule on creation", () => {
    const renderCreation = async () => {
      mockRouteParams = { onContinue: { route: "acceptTermsAndConditions" } }
      return renderScreen()
    }

    it("asks about the region once Enhanced is the chosen mode", async () => {
      const { getByTestId } = await renderCreation()

      fireEvent.press(getByTestId("mode-enhanced"))
      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      expect(mockCheckBlockReason).toHaveBeenCalledWith("selfCustodial")
    })

    it("never asks anything about an Anon user, the connection included", async () => {
      const { getByTestId } = await renderCreation()

      fireEvent.press(getByTestId("mode-anon"))
      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      expect(mockCheckBlockReason).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
        flow: "selfCustodial",
        mode: AccountMode.Anon,
      })
    })

    it("opens Unsupported region on a refusal instead of the terms", async () => {
      mockCheckBlockReason.mockResolvedValue("region")
      const { getByTestId } = await renderCreation()

      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion", { reason: "region" })
      expect(mockNavigate).not.toHaveBeenCalledWith(
        "acceptTermsAndConditions",
        expect.anything(),
      )
    })

    /**
     * The asymmetry stated outright: in a country on `selfCustodialCreationBlockedCountries`
     * Enhanced is refused and Incognito is not. It is not an omission. The list is keyed by
     * country, and the only way to learn the country is the lookup Incognito exists to
     * refuse, so asking would resolve the very thing the mode promises not to.
     */
    it("creates in Incognito from a country that refuses an Enhanced creation", async () => {
      mockCheckBlockReason.mockResolvedValue("region")
      const { getByTestId } = await renderCreation()

      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      expect(mockNavigate).toHaveBeenCalledWith("unsupportedRegion", { reason: "region" })

      mockNavigate.mockClear()
      fireEvent.press(getByTestId("mode-anon"))
      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
        flow: "selfCustodial",
        mode: AccountMode.Anon,
      })
      expect(mockNavigate).not.toHaveBeenCalledWith(
        "unsupportedRegion",
        expect.anything(),
      )
    })

    it("holds Continue while the region is being resolved", async () => {
      mockIsChecking.mockReturnValue(true)
      await renderCreation()

      expect(mockPrimaryButton).toHaveBeenLastCalledWith(
        expect.objectContaining({ disabled: true, loading: true }),
      )
    })

    it("does not navigate when the answer lands after the screen is gone", async () => {
      let resolveCheck: (reason: string | null) => void = () => undefined
      mockCheckBlockReason.mockReturnValue(
        new Promise<string | null>((resolve) => {
          resolveCheck = resolve
        }),
      )
      const { getByTestId, unmount } = await renderCreation()

      fireEvent.press(getByTestId(continueTestId))
      unmount()
      resolveCheck("region")
      await flushEffects()

      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it("does nothing at all for an onward route this build does not know", async () => {
      // Only reachable from a stale navigation state, which must not act on a guess.
      mockRouteParams = {
        onContinue: { route: "aRouteThisBuildNeverShipped" },
      } as unknown as RouteParams
      const { getByTestId } = await renderScreen()

      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockSetAccountMode).not.toHaveBeenCalled()
      expect(mockCheckBlockReason).not.toHaveBeenCalled()
    })

    it("holds the mode cards still while a check is running", async () => {
      mockIsChecking.mockReturnValue(true)
      const { getByTestId } = await renderCreation()

      fireEvent.press(getByTestId("mode-anon"))
      const { onPress } = mockPrimaryButton.mock.calls.at(-1)?.[0] as PrimaryButtonProps
      await act(async () => onPress())

      // Anon selected mid-check would otherwise navigate carrying the Enhanced it started on.
      expect(mockNavigate).toHaveBeenCalledWith("acceptTermsAndConditions", {
        flow: "selfCustodial",
        mode: AccountMode.Enhanced,
      })
    })

    it("leaves the entries that already hold an account alone", async () => {
      mockCheckBlockReason.mockResolvedValue("region")
      const { getByTestId } = await renderScreen()

      fireEvent.press(getByTestId(continueTestId))
      await flushEffects()

      // A restore or a migration creates nothing, so no rule may refuse it.
      expect(mockCheckBlockReason).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSuccess")
    })
  })
})
