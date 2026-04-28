import * as React from "react"
import { useMemo } from "react"
import { RefreshControl, View, Alert, Pressable } from "react-native"
import { gql } from "@apollo/client"
import Modal from "react-native-modal"
import { useNavigation, useIsFocused, useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import { ScrollView, TouchableWithoutFeedback } from "react-native-gesture-handler"

import { AppUpdate } from "@app/components/app-update/app-update"
import { GaloyErrorBox } from "@app/components/atomic/galoy-error-box"
import { GaloyIcon, icons } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BulletinsCard } from "@app/components/notifications/bulletins"
import { SetDefaultAccountModal } from "@app/components/set-default-account-modal"
import { StableSatsModal } from "@app/components/stablesats-modal"
import WalletOverview from "@app/components/wallet-overview/wallet-overview"
import { BalanceHeader, useTotalBalance } from "@app/components/balance-header"
import { BalanceMode, useBalanceMode } from "@app/hooks/use-balance-mode"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { toBtcMoneyAmount } from "@app/types/amounts"
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
import { BackupNudgeModal } from "@app/components/backup-nudge-modal"
import { NetworkStatusBanner } from "@app/components/network-status-banner"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { useBackupNudgeState } from "@app/hooks/use-backup-nudge-state"
import { TrustModelModal } from "@app/components/trust-model-modal"
import { useTrustModelSeen } from "@app/screens/spark-onboarding/trust-model-screen"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UnclaimedDepositBanner } from "@app/components/unclaimed-deposit-banner"
import { testProps } from "@app/utils/testProps"
import { isIos } from "@app/utils/helper"
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
  useHasPromptedSetDefaultAccountQuery,
  useHomeAuthedQuery,
  useHomeUnauthedQuery,
  useRealtimePriceQuery,
  useSettingsScreenQuery,
} from "@app/graphql/generated"
import { useLevel } from "@app/graphql/level-context"

const TransactionCountToTriggerSetDefaultAccountModal = 1
const UPGRADE_MODAL_INITIAL_DELAY_MS = 1500

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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { balanceLimitToTriggerUpgradeModal, upgradeModalCooldownDays } =
    useRemoteConfig()

  const { data: { hasPromptedSetDefaultAccount } = {} } =
    useHasPromptedSetDefaultAccountQuery()
  const [setDefaultAccountModalVisible, setSetDefaultAccountModalVisible] =
    React.useState(false)
  const reopenUpgradeModal = React.useRef(false)
  const toggleSetDefaultAccountModal = () =>
    setSetDefaultAccountModalVisible(!setDefaultAccountModalVisible)

  const { isAtLeastLevelOne } = useLevel()

  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial } = activeWallet
  const { refreshWallets: refreshSelfCustodialWallets, isStableBalanceActive } =
    useSelfCustodialWallet()
  const { stableBalanceEnabled } = useFeatureFlags()
  const { mode: balanceMode, toggleMode: toggleBalanceMode } = useBalanceMode()
  const { shouldShowBanner, shouldShowModal, dismissBanner } = useBackupNudgeState()
  const {
    seen: trustModelSeen,
    loaded: trustModelLoaded,
    markAsSeen: markTrustModelSeen,
  } = useTrustModelSeen()
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

  const {
    refetch: refetchUnauthed,
    loading: loadingUnauthed,
    data: dataUnauthed,
  } = useHomeUnauthedQuery({
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

  const loading = isSelfCustodial
    ? activeWallet.status === "loading"
    : loadingAuthed || loadingPrice || loadingUnauthed || loadingSettings

  const { username, phone } = currentUser?.me ?? {}
  const usernameTitle = username || phone || LL.common.blinkUser()

  const wallets = isSelfCustodial
    ? activeWallet.wallets.map((w) => ({
        id: w.id,
        balance: w.balance.amount,
        walletCurrency: w.walletCurrency,
      }))
    : dataAuthed?.me?.defaultAccount?.wallets
  const { formattedBalance: defaultFormattedBalance, satsBalance } =
    useTotalBalance(wallets)

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

  const closeUpgradeModal = () => setIsUpgradeModalVisible(false)
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
      target === "receiveBitcoin" &&
      !hasPromptedSetDefaultAccount &&
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

  const buttons = [
    {
      title: LL.HomeScreen.receive(),
      target: "receiveBitcoin" as Target,
      icon: "receive" as IconNamesType,
    },
    {
      title: LL.HomeScreen.send(),
      target: "sendBitcoinDestination" as Target,
      icon: "send" as IconNamesType,
    },
    {
      title: LL.HomeScreen.scan(),
      target: "scanningQRCode" as Target,
      icon: "qr-code" as IconNamesType,
    },
  ]

  const isIosWithBalance = isIos && satsBalance > 0

  const shouldShowTransferButton =
    isSelfCustodial ||
    !isIos ||
    dataUnauthed?.globals?.network !== "mainnet" ||
    levelAccount === AccountLevel.Two ||
    levelAccount === AccountLevel.Three ||
    isIosWithBalance

  if (shouldShowTransferButton) {
    buttons.unshift({
      title: LL.ConversionDetailsScreen.transfer(),
      target: "conversionDetails" as Target,
      icon: "transfer" as IconNamesType,
    })
  }

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

  const showTrustModel =
    isSelfCustodial && trustModelLoaded && !trustModelSeen && satsBalance > 0

  return (
    <Screen headerShown={false}>
      {AccountCreationNeededModal}
      <StableSatsModal
        isVisible={isStablesatModalVisible}
        setIsVisible={setIsStablesatModalVisible}
      />
      <TrialAccountLimitsModal
        isVisible={isUpgradeModalVisible}
        closeModal={closeUpgradeModal}
        beforeSubmit={() => {
          reopenUpgradeModal.current = true
        }}
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
              <Pressable onPress={isAtLeastLevelOne ? handleSwitchPress : null}>
                <View style={styles.profileContainer}>
                  <Text type="p2">{usernameTitle}</Text>
                  {isAtLeastLevelOne && <GaloyIcon name={"caret-down"} size={18} />}
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
                <GaloyIconButton
                  name={item.icon}
                  size="large"
                  weight="regular"
                  text={item.title}
                  onPress={() => onMenuClick(item.target)}
                />
              </View>
            </React.Fragment>
          ))}
        </View>
        {isSelfCustodial && <UnclaimedDepositBanner />}
        <NetworkStatusBanner />
        {shouldShowBanner && <BackupNudgeBanner onDismiss={dismissBanner} />}
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
      <TrustModelModal isVisible={showTrustModel} onDismiss={markTrustModelSeen} />
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
