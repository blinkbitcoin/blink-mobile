import * as React from "react"
import { useMemo } from "react"
import { RefreshControl, View, Alert, Pressable } from "react-native"
import { gql } from "@apollo/client"
import Modal from "react-native-modal"
import Icon from "react-native-vector-icons/Ionicons"
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
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import SlideUpHandle from "@app/components/slide-up-handle"
import { Screen } from "@app/components/screen"
import {
  IncomingAmountBadge,
  useIncomingAmountBadge,
} from "@app/components/incoming-amount-badge"

import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getErrorMessages } from "@app/graphql/utils"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { isIos } from "@app/utils/helper"
import {
  useAppConfig,
  useAutoShowUpgradeModal,
  useTransactionsNotification,
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
              }
              ... on OpenExternalLinkAction {
                url
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
    skip: !isAuthed,
    fetchPolicy: "network-only",
    errorPolicy: "all",

    // this enables offline mode use-case
    nextFetchPolicy: "cache-and-network",
  })

  const { loading: loadingPrice, refetch: refetchRealtimePrice } = useRealtimePriceQuery({
    skip: !isAuthed,
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

  const loading = loadingAuthed || loadingPrice || loadingUnauthed || loadingSettings

  const { username, phone } = currentUser?.me ?? {}
  const usernameTitle = username || phone || LL.common.blinkUser()

  const wallets = dataAuthed?.me?.defaultAccount?.wallets
  const { formattedBalance, satsBalance } = useTotalBalance(wallets)

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

  const { hasUnseenBtcTx, hasUnseenUsdTx } = useTransactionsNotification(transactions)

  const { canShowUpgradeModal, markShownUpgradeModal } = useAutoShowUpgradeModal({
    cooldownDays: upgradeModalCooldownDays,
    enabled: isAuthed && levelAccount === AccountLevel.Zero,
  })

  const { latestIncomingTx, incomingAmountText, handleIncomingBadgePress, isOutgoing } =
    useIncomingAmountBadge({
      transactions,
      hasUnseenBtcTx,
      hasUnseenUsdTx,
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
    refetchAuthed,
    refetchBulletins,
    refetchRealtimePrice,
    refetchUnauthed,
    triggerUpgradeModal,
  ])

  const numberOfTxs = transactions.length

  const onMenuClick = (target: Target) => {
    if (isAuthed) {
      if (
        target === "receiveBitcoin" &&
        !hasPromptedSetDefaultAccount &&
        numberOfTxs >= TransactionCountToTriggerSetDefaultAccountModal &&
        galoyInstanceId === "Main"
      ) {
        toggleSetDefaultAccountModal()
        return
      }

      // we are using any because Typescript complain on the fact we are not passing any params
      // but there is no need for a params and the types should not necessitate it
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigation.navigate(target as any)
    } else {
      setModalVisible(true)
    }
  }

  const activateWallet = () => {
    setModalVisible(false)
    navigation.navigate("acceptTermsAndConditions", { flow: "phone" })
  }

  // debug code. verify that we have 2 wallets. mobile doesn't work well with only one wallet
  // TODO: add this code in a better place
  React.useEffect(() => {
    if (wallets?.length !== undefined && wallets?.length !== 2) {
      Alert.alert(LL.HomeScreen.walletCountNotTwo())
    }
  }, [wallets, LL])

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

  type Target = "scanningQRCode" | "sendBitcoinDestination" | "receiveBitcoin"
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

  if (
    !isIos ||
    dataUnauthed?.globals?.network !== "mainnet" ||
    levelAccount === AccountLevel.Two ||
    levelAccount === AccountLevel.Three ||
    isIosWithBalance
  ) {
    buttons.unshift({
      title: LL.ConversionDetailsScreen.title(),
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
        <Icon name="remove" size={64} color={colors.grey3} style={styles.icon} />
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
          />
        </View>
      </View>
      <BalanceHeader loading={loading} formattedBalance={formattedBalance} />
      <View style={styles.badgeSlot}>
        <IncomingAmountBadge
          key={latestIncomingTx?.id}
          text={incomingAmountText ?? ""}
          visible={Boolean(incomingAmountText)}
          onPress={handleIncomingBadgePress}
          outgoing={isOutgoing}
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
          showBtcNotification={hasUnseenBtcTx}
          showUsdNotification={hasUnseenUsdTx}
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
                  text={item.title}
                  onPress={() => onMenuClick(item.target)}
                />
              </View>
            </React.Fragment>
          ))}
        </View>
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
        onAction={() => navigation.navigate("transactionHistory", { showLoading: true })}
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
