import * as React from "react"
import { useMemo } from "react"
import { RefreshControl, View, Alert, Pressable } from "react-native"
import { gql } from "@apollo/client"
import Modal from "react-native-modal"
import { useNavigation, useIsFocused, useFocusEffect } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { ScrollView, TouchableWithoutFeedback } from "react-native-gesture-handler"

import { AppUpdate } from "@app/components/app-update/app-update"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon, icons } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { DisabledFeature } from "@app/components/disabled-feature"
import { BulletinsCard } from "@app/components/notifications/bulletins"
import { SetDefaultAccountModal } from "@app/components/set-default-account-modal"
import { StableSatsModal } from "@app/components/stablesats-modal"
import { DollarBalanceRestrictionModal } from "@app/components/dollar-balance-restriction-modal"
import { UsdConvertToBtcModal } from "@app/components/usd-convert-to-btc-modal"
import WalletOverview from "@app/components/wallet-overview/wallet-overview"
import { BalanceHeader, useTotalBalance } from "@app/components/balance-header"
import { BalanceMode, useBalanceMode } from "@app/hooks/use-balance-mode"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { StableTokenConvertToBtcModal } from "@app/screens/conversion-flow/stable-token-convert-to-btc-modal"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import SlideUpHandle from "@app/components/slide-up-handle"
import { Screen } from "@app/components/screen"
import {
  UnseenTxAmountBadge,
  useUnseenTxAmountBadge,
  useOutgoingBadgeVisibility,
  useIncomingBadgeAutoSeen,
} from "@app/components/unseen-tx-amount-badge"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { BackupNudgeBanner } from "@app/components/backup-nudge-banner"
import { SelfCustodialInfoBulletin } from "@app/components/self-custodial-info-bulletin"
import { BackupNudgeModal } from "@app/components/backup-nudge-modal"
import { NetworkStatusBanner } from "@app/components/network-status-banner"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useDefaultAccountModalShown } from "@app/hooks/use-default-account-modal-shown"
import {
  useDollarBalanceRestricted,
  useDollarBalanceRestrictionSync,
} from "@app/hooks/use-dollar-balance-restricted"
import { useDollarBalanceForcedConversion } from "@app/hooks/use-dollar-balance-forced-conversion"
import { MigrateNowModal } from "@app/components/migrate-now-modal"
import { MigrationReminderBulletin } from "@app/components/migration-reminder-bulletin"
/** Deep import on purpose: keeps the migration hooks barrel out of the home graph. */
import { useWindDownHomeNudges } from "@app/screens/account-migration/hooks/use-wind-down-home-nudges"
import {
  useTransferBlocked,
  useTransferBlockedSync,
} from "@app/hooks/use-transfer-blocked"
import { useSelfCustodialNetworkMismatchToast } from "@app/self-custodial/hooks/use-network-mismatch-toast"
import { useNonCustodialConversionLimits } from "@app/self-custodial/hooks"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { ConvertDirection } from "@app/types/payment"
import { useBackupNudgeState } from "@app/hooks/use-backup-nudge-state"
import { useSelfCustodialInfoBulletinState } from "@app/hooks/use-self-custodial-info-bulletin-state"
import { getErrorMessages } from "@app/graphql/utils"
import { getBtcWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UnclaimedDepositBanner } from "@app/components/unclaimed-deposit-banner"
import { testProps } from "@app/utils/testProps"
import { extractLightningAddressUsername } from "@app/utils/pay-links"
import {
  useAppConfig,
  useAutoShowUpgradeModal,
  useTransactionSeenState,
} from "@app/hooks"
import {
  AccountLevel,
  TransactionFragment,
  TxDirection,
  TxStatus,
  useBulletinsQuery,
  useHomeAuthedQuery,
  useHomeUnauthedQuery,
  useRealtimePriceQuery,
  useSettingsScreenQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { AccountType } from "@app/types/wallet"
import { useLevel } from "@app/graphql/level-context"

const TransactionCountToTriggerSetDefaultAccountModal = 1
const UPGRADE_MODAL_INITIAL_DELAY_MS = 1500
/** Floor for conversions without a pool minimum (custodial intraledger always,
 *  self-custodial when the SDK reports none): any positive cent converts. */
const ANY_POSITIVE_CENT_MINIMUM = 1

gql`
  query homeAuthed {
    me {
      id
      language
      username
      phone
      email {
        address
        verified
      }

      defaultAccount {
        id
        level
        defaultWalletId
        pendingIncomingTransactions {
          ...Transaction
        }
        transactions(first: 20) {
          ...TransactionList
        }
        wallets {
          id
          balance
          walletCurrency
        }
      }
    }
  }

  query homeUnauthed {
    globals {
      network
    }

    currencyList {
      id
      flag
      name
      symbol
      fractionDigits
    }
  }

  query Bulletins($first: Int!, $after: String) {
    me {
      id
      unacknowledgedStatefulNotificationsWithBulletinEnabled(
        first: $first
        after: $after
      ) {
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            id
            title
            body
            createdAt
            acknowledgedAt
            bulletinEnabled
            icon
            action {
              ... on OpenDeepLinkAction {
                deepLink
                label
              }
              ... on OpenExternalLinkAction {
                url
                label
              }
            }
          }
          cursor
        }
      }
    }
  }
`

export const HomeScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { balanceLimitToTriggerUpgradeModal, upgradeModalCooldownDays } =
    useRemoteConfig()

  const { defaultAccountModalShown } = useDefaultAccountModalShown()
  const [setDefaultAccountModalVisible, setSetDefaultAccountModalVisible] =
    React.useState(false)
  const reopenUpgradeModal = React.useRef(false)
  const toggleSetDefaultAccountModal = () =>
    setSetDefaultAccountModalVisible(!setDefaultAccountModalVisible)

  const { isAtLeastLevelOne } = useLevel()

  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial } = activeWallet
  useSelfCustodialNetworkMismatchToast()
  const {
    refreshWallets: refreshSelfCustodialWallets,
    isStableBalanceActive,
    lightningAddress: selfCustodialLightningAddress,
  } = useSelfCustodialWallet()
  const { accounts, activeAccount } = useAccountRegistry()
  const hasMultipleAccounts = accounts.length > 1
  const { stableBalanceEnabled } = useFeatureFlags()
  const { mode: balanceMode, toggleMode: toggleBalanceMode } = useBalanceMode()
  const { shouldShowBanner, shouldShowModal, dismissBanner } = useBackupNudgeState()
  const {
    shouldShow: shouldShowSelfCustodialInfoBulletin,
    dismiss: dismissSelfCustodialInfoBulletin,
  } = useSelfCustodialInfoBulletinState()
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { id: galoyInstanceId },
    },
  } = useAppConfig()

  const isFocused = useIsFocused()

  const {
    data: dataAuthed,
    loading: loadingAuthed,
    error,
    refetch: refetchAuthed,
  } = useHomeAuthedQuery({
    skip: !isAuthed || isSelfCustodial,
    fetchPolicy: "network-only",
    errorPolicy: "all",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  const { loading: loadingPrice, refetch: refetchRealtimePrice } = useRealtimePriceQuery({
    skip: !isAuthed || isSelfCustodial,
    fetchPolicy: "network-only",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  const { refetch: refetchUnauthed, loading: loadingUnauthed } = useHomeUnauthedQuery({
    skip: !isAuthed,
    fetchPolicy: "network-only",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  // keep settings info cached and ignore network call if it's already cached
  const { data: currentUser, loading: loadingSettings } = useSettingsScreenQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  // load bulletins on home screen
  const {
    data: bulletins,
    loading: bulletinsLoading,
    refetch: refetchBulletins,
  } = useBulletinsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
    variables: { first: 1 },
  })

  // not loaded yet: no wallets while not ready (a loaded account keeps its balance
  // when a refresh goes offline, and a ready empty account shows zero, not a skeleton)
  const queryLoading = isSelfCustodial
    ? !activeWallet.isReady && activeWallet.wallets.length === 0
    : loadingAuthed || loadingPrice || loadingUnauthed || loadingSettings

  const { username, phone } = currentUser?.me ?? {}
  const selfCustodialFallbackTitle = hasMultipleAccounts ? LL.common.anonymousUser() : ""

  const selfCustodialUsername = extractLightningAddressUsername(
    selfCustodialLightningAddress,
  )
  const usernameTitle = isSelfCustodial
    ? selfCustodialUsername ?? selfCustodialFallbackTitle
    : username || phone || LL.common.blinkUser()
  const canSwitchAccount = isSelfCustodial ? hasMultipleAccounts : isAtLeastLevelOne

  const wallets = isSelfCustodial
    ? activeWallet.wallets.map((w) => ({
        id: w.id,
        balance: w.balance.amount,
        walletCurrency: w.walletCurrency,
      }))
    : dataAuthed?.me?.defaultAccount?.wallets
  const {
    formattedBalance: defaultFormattedBalance,
    satsBalance,
    isLoading: balanceConversionLoading,
  } = useTotalBalance(wallets)

  const loading = queryLoading || balanceConversionLoading

  const showStableBalanceToggle =
    stableBalanceEnabled && isSelfCustodial && isStableBalanceActive

  const { formatMoneyAmount } = useDisplayCurrency()

  const formattedBalance =
    showStableBalanceToggle && balanceMode === BalanceMode.Btc
      ? formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(satsBalance) })
      : defaultFormattedBalance

  const accountId = dataAuthed?.me?.defaultAccount?.id
  const levelAccount = dataAuthed?.me?.defaultAccount.level
  const pendingIncomingTransactions =
    dataAuthed?.me?.defaultAccount?.pendingIncomingTransactions
  const transactionsEdges = dataAuthed?.me?.defaultAccount?.transactions?.edges

  const transactions = useMemo(() => {
    const txs: TransactionFragment[] = []
    if (pendingIncomingTransactions) txs.push(...pendingIncomingTransactions)
    const settled =
      transactionsEdges
        ?.map((e) => e.node)
        .filter(
          (tx) => tx.status !== TxStatus.Pending || tx.direction === TxDirection.Send,
        ) ?? []
    txs.push(...settled)
    return txs
  }, [pendingIncomingTransactions, transactionsEdges])

  const { hasUnseenBtcTx, hasUnseenUsdTx, markTxSeen } = useTransactionSeenState(
    accountId || "",
    transactions,
  )

  const { canShowUpgradeModal, markShownUpgradeModal } = useAutoShowUpgradeModal({
    cooldownDays: upgradeModalCooldownDays,
    enabled: isAuthed && levelAccount === AccountLevel.Zero,
  })

  const { latestUnseenTx, unseenAmountText, handleUnseenBadgePress, isOutgoing } =
    useUnseenTxAmountBadge({
      transactions,
      hasUnseenBtcTx,
      hasUnseenUsdTx,
    })

  const handleOutgoingBadgeHide = React.useCallback(() => {
    if (latestUnseenTx?.settlementCurrency) {
      markTxSeen(latestUnseenTx.settlementCurrency)
    }
  }, [latestUnseenTx?.settlementCurrency, markTxSeen])

  const showOutgoingBadge = useOutgoingBadgeVisibility({
    txId: latestUnseenTx?.id,
    amountText: unseenAmountText,
    isOutgoing,
    onHide: handleOutgoingBadgeHide,
  })

  const showIncomingBadge = useIncomingBadgeAutoSeen({
    isFocused,
    isOutgoing,
    unseenCurrency: latestUnseenTx?.settlementCurrency,
    markTxSeen,
  })

  const [modalVisible, setModalVisible] = React.useState(false)
  const [isStablesatModalVisible, setIsStablesatModalVisible] = React.useState(false)
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = React.useState(false)
  const [isRestrictionModalVisible, setIsRestrictionModalVisible] = React.useState(false)
  const isDollarBalanceRestricted = useDollarBalanceRestricted()
  useDollarBalanceRestrictionSync()

  const isTransferBlocked = useTransferBlocked()
  useTransferBlockedSync()

  const restrictedUsdWallet = getUsdWallet(dataAuthed?.me?.defaultAccount?.wallets)
  const restrictedBtcWallet = getBtcWallet(dataAuthed?.me?.defaultAccount?.wallets)
  /** Balance and restriction policy must resolve for the SAME account type: right
   *  after switching to self-custodial the SDK is still connecting (so
   *  `isSelfCustodial` is false) while the restriction already applies the
   *  self-custodial policy; reading the cached custodial balance in that window
   *  would trigger the previous account's modal. */
  const isCustodialAccount = activeWallet.accountType === AccountType.Custodial
  const selfCustodialUsdWallet = activeWallet.wallets.find(
    (w) => w.walletCurrency === WalletCurrency.Usd,
  )
  const custodialUsdWalletBalance = restrictedUsdWallet?.balance ?? 0
  const selfCustodialUsdWalletBalance = selfCustodialUsdWallet?.balance.amount ?? 0
  const restrictedUsdWalletBalance = isCustodialAccount
    ? custodialUsdWalletBalance
    : selfCustodialUsdWalletBalance
  /** Memoized so the self-custodial quote does not refire on unrelated re-renders. */
  const restrictedUsdMoneyAmount = useMemo(
    () => toUsdMoneyAmount(restrictedUsdWalletBalance),
    [restrictedUsdWalletBalance],
  )

  /** The limits fetch only runs when a forced conversion is actually on the
   *  table (the hook skips entirely on an undefined direction), and gating on
   *  focus re-runs it on each home visit, so one failed fetch cannot mute the
   *  trigger for the whole session. Below the Breez pool minimum the trigger
   *  stays closed: the bridge rejects below-minimum conversions, so the modal
   *  would nag with a retry that can never succeed. */
  const shouldCheckConversionMinimum =
    !isCustodialAccount &&
    isDollarBalanceRestricted &&
    restrictedUsdWalletBalance > 0 &&
    isFocused
  const { limits: stableTokenConversionLimits } = useNonCustodialConversionLimits(
    shouldCheckConversionMinimum ? ConvertDirection.UsdToBtc : undefined,
  )
  /** A fetched limits response without a minimum means "none": mirror the bridge
   *  (`checkConversionMinimum`), which lets any positive amount through. */
  const stableTokenConversionMinimum = stableTokenConversionLimits
    ? stableTokenConversionLimits.minFromAmount ?? ANY_POSITIVE_CENT_MINIMUM
    : null
  const minimumConvertibleBalance = isCustodialAccount
    ? ANY_POSITIVE_CENT_MINIMUM
    : stableTokenConversionMinimum

  const { isConvertModalVisible, closeConvertModal } = useDollarBalanceForcedConversion({
    accountId: activeAccount?.id,
    isRestricted: isDollarBalanceRestricted,
    usdWalletBalance: restrictedUsdWalletBalance,
    minimumBalance: minimumConvertibleBalance,
    isFocused,
  })

  /** Each account type renders its own convert modal; the guards keep them exclusive
   *  locally instead of relying on the skipped custodial query staying empty. */
  const custodialConvertWallets =
    isCustodialAccount && restrictedUsdWallet && restrictedBtcWallet
      ? { usdWalletId: restrictedUsdWallet.id, btcWalletId: restrictedBtcWallet.id }
      : null
  const shouldShowStableTokenConvertModal = isSelfCustodial && isConvertModalVisible

  const { migrateNowPrompt, reminderBulletin, receiveBlocked } = useWindDownHomeNudges()
  const { dismissForSession: dismissMigrateNowPrompt } = migrateNowPrompt
  /** Dismissing first keeps the modal from floating over the pushed migration flow. */
  const goToMigration = React.useCallback(() => {
    dismissMigrateNowPrompt()
    navigation.navigate("accountMigrationEntry")
  }, [dismissMigrateNowPrompt, navigation])
  /** The migrate-now push is the lowest-priority nudge: two native modals cannot
   *  present at once on iOS, so it waits while any other home modal is up. */
  const isAnotherHomeModalVisible =
    isConvertModalVisible ||
    isUpgradeModalVisible ||
    isRestrictionModalVisible ||
    isStablesatModalVisible ||
    modalVisible
  const shouldShowMigrateNowPrompt =
    migrateNowPrompt.isVisible && !isAnotherHomeModalVisible

  const closeUpgradeModal = () => setIsUpgradeModalVisible(false)
  const closeRestrictionModal = () => setIsRestrictionModalVisible(false)
  const openUpgradeModal = React.useCallback(() => {
    setIsUpgradeModalVisible(true)
  }, [])

  const triggerUpgradeModal = React.useCallback(() => {
    if (!accountId || levelAccount !== AccountLevel.Zero) return
    if (!canShowUpgradeModal || satsBalance <= balanceLimitToTriggerUpgradeModal) return

    openUpgradeModal()
    markShownUpgradeModal()
  }, [
    accountId,
    levelAccount,
    canShowUpgradeModal,
    satsBalance,
    balanceLimitToTriggerUpgradeModal,
    markShownUpgradeModal,
    openUpgradeModal,
  ])

  const refetch = React.useCallback(() => {
    if (isSelfCustodial) {
      refreshSelfCustodialWallets()
      return
    }

    if (!isAuthed) return

    Promise.all([
      refetchRealtimePrice(),
      refetchAuthed(),
      refetchUnauthed(),
      refetchBulletins(),
    ]).then(() => {
      // Triggers the upgrade trial account modal after refetch
      triggerUpgradeModal()
    })
  }, [
    isAuthed,
    isSelfCustodial,
    refreshSelfCustodialWallets,
    refetchAuthed,
    refetchBulletins,
    refetchRealtimePrice,
    refetchUnauthed,
    triggerUpgradeModal,
  ])

  const numberOfTxs = transactions.length

  const onMenuClick = (target: Target) => {
    if (!isSelfCustodial && !isAuthed) {
      setModalVisible(true)
      return
    }

    if (
      !isSelfCustodial &&
      !isDollarBalanceRestricted &&
      target === "receiveBitcoin" &&
      !defaultAccountModalShown &&
      numberOfTxs >= TransactionCountToTriggerSetDefaultAccountModal &&
      galoyInstanceId === "Main"
    ) {
      toggleSetDefaultAccountModal()
      return
    }

    navigation.navigate(target)
  }

  const activateWallet = () => {
    setModalVisible(false)
    navigation.navigate("acceptTermsAndConditions", { flow: "phone" })
  }

  // debug code. verify that we have 2 wallets. mobile doesn't work well with only one wallet
  // TODO: add this code in a better place
  React.useEffect(() => {
    if (isSelfCustodial) return
    if (wallets?.length !== undefined && wallets?.length !== 2) {
      Alert.alert(LL.HomeScreen.walletCountNotTwo())
    }
  }, [wallets, LL, isSelfCustodial])

  // Trigger the upgrade trial account modal
  useFocusEffect(
    React.useCallback(() => {
      if (reopenUpgradeModal.current) {
        openUpgradeModal()
        reopenUpgradeModal.current = false
        return
      }

      const id = setTimeout(() => {
        triggerUpgradeModal()
      }, UPGRADE_MODAL_INITIAL_DELAY_MS)

      return () => clearTimeout(id)
    }, [openUpgradeModal, triggerUpgradeModal]),
  )

  type Target =
    | "scanningQRCode"
    | "sendBitcoinDestination"
    | "receiveBitcoin"
    | "conversionDetails"
  type IconNamesType = keyof typeof icons

  type HomeButton = {
    title: string
    target: Target
    icon: IconNamesType
    disabled?: boolean
    onDisabledPress?: () => void
  }

  const buttons: HomeButton[] = [
    {
      title: LL.HomeScreen.receive(),
      target: "receiveBitcoin",
      icon: "receive",
      disabled: receiveBlocked.isBlocked,
      onDisabledPress: receiveBlocked.onDisabledPress,
    },
    {
      title: LL.HomeScreen.send(),
      target: "sendBitcoinDestination",
      icon: "send",
    },
    {
      title: LL.HomeScreen.scan(),
      target: "scanningQRCode",
      icon: "qr-code",
    },
  ]

  const isTransferDisabled = isDollarBalanceRestricted || isTransferBlocked

  buttons.unshift({
    title: LL.ConversionDetailsScreen.transfer(),
    target: "conversionDetails",
    icon: "transfer",
    disabled: isTransferDisabled,
    onDisabledPress: () => setIsRestrictionModalVisible(true),
  })

  const AccountCreationNeededModal = (
    <Modal
      style={styles.modal}
      isVisible={modalVisible}
      swipeDirection={modalVisible ? ["down"] : ["up"]}
      onSwipeComplete={() => setModalVisible(false)}
      animationOutTiming={1}
      swipeThreshold={50}
    >
      <View style={styles.flex}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.cover} />
        </TouchableWithoutFeedback>
      </View>
      <View style={styles.viewModal}>
        <GaloyIcon name="minus" size={64} color={colors.grey3} style={styles.icon} />
        <Text type="h1">{LL.common.needWallet()}</Text>
        <View style={styles.openWalletContainer}>
          <GaloyPrimaryButton
            title={LL.GetStartedScreen.logInCreateAccount()}
            onPress={activateWallet}
          />
        </View>
        <View style={styles.flex} />
      </View>
    </Modal>
  )

  const handleSwitchPress = () => {
    navigation.navigate("profileScreen")
  }

  return (
    <Screen headerShown={false}>
      {AccountCreationNeededModal}
      <StableSatsModal
        isVisible={isStablesatModalVisible}
        setIsVisible={setIsStablesatModalVisible}
        variant={isSelfCustodial ? "selfCustodial" : "custodial"}
      />
      <TrialAccountLimitsModal
        isVisible={isUpgradeModalVisible}
        closeModal={closeUpgradeModal}
        beforeSubmit={() => {
          reopenUpgradeModal.current = true
        }}
      />
      <DollarBalanceRestrictionModal
        isVisible={isRestrictionModalVisible}
        toggleModal={closeRestrictionModal}
      />
      {custodialConvertWallets && (
        <UsdConvertToBtcModal
          isVisible={isConvertModalVisible}
          toggleModal={closeConvertModal}
          usdWalletBalance={restrictedUsdMoneyAmount}
          usdWalletId={custodialConvertWallets.usdWalletId}
          btcWalletId={custodialConvertWallets.btcWalletId}
        />
      )}
      {shouldShowStableTokenConvertModal && (
        <StableTokenConvertToBtcModal
          isVisible={isConvertModalVisible}
          toggleModal={closeConvertModal}
          usdWalletBalance={restrictedUsdMoneyAmount}
          conversionMinimum={stableTokenConversionMinimum}
        />
      )}
      {/* Kept mounted (not conditionally rendered) so its exit animation plays on dismiss. */}
      <MigrateNowModal
        isVisible={shouldShowMigrateNowPrompt}
        toggleModal={migrateNowPrompt.dismissForSession}
        onMigrate={goToMigration}
        deadlineTimestamp={migrateNowPrompt.deadlineTimestamp}
        timezone={migrateNowPrompt.timezone}
      />
      <View style={styles.balanceContainer}>
        <View style={styles.header}>
          <GaloyIconButton
            onPress={() => navigation.navigate("priceHistory")}
            size={"medium"}
            name="graph"
            iconOnly={true}
            weight="bold"
          />
          <View>
            {!loading && usernameTitle && (
              <Pressable onPress={canSwitchAccount ? handleSwitchPress : null}>
                <View style={styles.profileContainer}>
                  <Text type="p2">{usernameTitle}</Text>
                  {canSwitchAccount && <GaloyIcon name={"caret-down"} size={18} />}
                </View>
              </Pressable>
            )}
          </View>
          <GaloyIconButton
            onPress={() => navigation.navigate("settings")}
            size={"medium"}
            name="menu"
            iconOnly={true}
            weight="bold"
          />
        </View>
      </View>
      <BalanceHeader
        loading={loading}
        formattedBalance={formattedBalance}
        showStableBalanceToggle={showStableBalanceToggle}
        mode={balanceMode}
        onModeChange={toggleBalanceMode}
      />
      <View style={styles.badgeSlot}>
        <UnseenTxAmountBadge
          key={latestUnseenTx?.id}
          amountText={unseenAmountText ?? ""}
          visible={
            isOutgoing
              ? showOutgoingBadge
              : showIncomingBadge && Boolean(unseenAmountText)
          }
          onPress={handleUnseenBadgePress}
          isOutgoing={isOutgoing}
        />
      </View>
      <ScrollView
        {...testProps("home-screen")}
        contentContainerStyle={styles.scrollViewContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading && isFocused}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <WalletOverview
          loading={loading}
          setIsStablesatModalVisible={setIsStablesatModalVisible}
          onRestrictedTap={() => setIsRestrictionModalVisible(true)}
          wallets={wallets}
          showBtcNotification={isOutgoing ? false : hasUnseenBtcTx}
          showUsdNotification={isOutgoing ? false : hasUnseenUsdTx}
        />
        {error && <GaloyErrorBox errorMessage={getErrorMessages(error)} />}
        <View style={styles.listItemsContainer}>
          {buttons.map((item) => (
            <React.Fragment key={item.icon}>
              {item.icon === "qr-code" && <View style={styles.actionsSeparator} />}
              <View style={styles.button}>
                <DisabledFeature
                  disabled={Boolean(item.disabled)}
                  onDisabledPress={item.onDisabledPress}
                >
                  <GaloyIconButton
                    name={item.icon}
                    size="large"
                    weight="regular"
                    text={item.title}
                    onPress={() => onMenuClick(item.target)}
                  />
                </DisabledFeature>
              </View>
            </React.Fragment>
          ))}
        </View>
        {isSelfCustodial && <UnclaimedDepositBanner />}
        <NetworkStatusBanner />
        {shouldShowBanner && <BackupNudgeBanner onDismiss={dismissBanner} />}
        {reminderBulletin.isVisible && (
          <MigrationReminderBulletin
            onMigrate={goToMigration}
            deadlineTimestamp={reminderBulletin.deadlineTimestamp}
            timezone={reminderBulletin.timezone}
          />
        )}
        {shouldShowSelfCustodialInfoBulletin && (
          <SelfCustodialInfoBulletin onDismiss={dismissSelfCustodialInfoBulletin} />
        )}
        <BulletinsCard loading={bulletinsLoading} bulletins={bulletins} />
        <AppUpdate />
        <SetDefaultAccountModal
          isVisible={setDefaultAccountModalVisible}
          toggleModal={() => {
            toggleSetDefaultAccountModal()
            navigation.navigate("receiveBitcoin")
          }}
        />
      </ScrollView>
      <SlideUpHandle
        bottomOffset={15}
        onAction={() => navigation.navigate("transactionHistory")}
      />
      <BackupNudgeModal
        isVisible={shouldShowModal && isFocused}
        onClose={dismissBanner}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollViewContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    rowGap: 20,
  },
  listItemsContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 12,
  },
  noTransaction: {
    alignItems: "center",
  },
  icon: {
    height: 34,
    top: -22,
  },
  modal: {
    marginBottom: 0,
    marginHorizontal: 0,
  },
  flex: {
    flex: 1,
  },
  cover: {
    height: "100%",
    width: "100%",
  },
  viewModal: {
    alignItems: "center",
    backgroundColor: colors.white,
    height: "30%",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
  },
  openWalletContainer: {
    alignSelf: "stretch",
    marginTop: 20,
  },
  recentTransaction: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    columnGap: 10,
    backgroundColor: colors.grey5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderColor: colors.grey5,
    borderBottomWidth: 2,
    paddingVertical: 14,
  },
  button: {
    maxWidth: "25%",
    flexGrow: 1,
    alignItems: "center",
  },
  balanceContainer: {
    marginTop: 7,
    flexDirection: "column",
    flex: 1,
    height: 40,
    maxHeight: 40,
  },
  header: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 6,
  },
  error: {
    alignSelf: "center",
    color: colors.error,
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionsSeparator: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.grey4,
  },
  badgeSlot: {
    height: 35,
    marginVertical: 3,
    justifyContent: "center",
    alignItems: "center",
  },
}))
