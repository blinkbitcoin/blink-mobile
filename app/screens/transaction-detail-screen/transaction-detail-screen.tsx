import * as React from "react"
import { ActivityIndicator, Linking, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ScrollView } from "react-native-gesture-handler"
import { useFragment } from "@apollo/client"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { TransactionDate } from "@app/components/transaction-date"
import { useDescriptionDisplay } from "@app/components/transaction-item"
import { DeepPartialObject } from "@app/components/transaction-item/index.types"
import { WalletSummary } from "@app/components/wallet-summary"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useResolveTransactionAccount } from "@app/hooks/use-resolve-transaction-account"
import {
  SettlementVia,
  TransactionFragment,
  TransactionFragmentDoc,
  useTransactionListForDefaultAccountLazyQuery,
  useHomeAuthedQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useAppConfig, useClipboard, useTransactionSeenState } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { toWalletAmount } from "@app/types/amounts"
import { NO_TRANSACTIONS, PaymentType } from "@app/types/transaction"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { IconTransaction } from "@app/components/icon-transactions"
import { Screen } from "@app/components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { formatTimeToMempool, timeToMempool } from "./format-time"

// Tappable icon action used in the detail rows (copy / open-in-explorer).
// Built on GaloyIconButton (a Pressable) so taps register inside the
// gesture-handler ScrollView and the icon gets pressed-state feedback —
// unlike the previous TouchableWithoutFeedback, whose injected responder
// props were dropped by GaloyIcon (regressed in #3703, see #3732).
export const IconAction = ({
  name,
  onPress,
}: {
  name: IconNamesType
  onPress: () => void
}) => <GaloyIconButton name={name} size={22} iconOnly onPress={onPress} />

const Row = ({
  entry,
  value,
  content,
  icons = [],
}: {
  entry: string
  value?: string | null | undefined | JSX.Element
  content?: JSX.Element
  icons?: JSX.Element[]
}) => {
  const styles = useStyles()

  return (
    <View style={styles.description}>
      <View style={styles.container}>
        <Text style={styles.entry} selectable={false}>
          {entry}
        </Text>
      </View>
      {content ? (
        content
      ) : (
        <View style={styles.valueContainer}>
          <Text selectable={false} style={styles.value}>
            {value}
          </Text>
          {icons.length > 0 && (
            <View style={styles.valueIcons}>
              {icons.map((icon, index) => (
                <React.Fragment key={index}>{icon}</React.Fragment>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

export const typeDisplay = (
  instance?: SettlementVia | DeepPartialObject<SettlementVia>,
  selfCustodialPaymentType?: PaymentType,
) => {
  if (selfCustodialPaymentType === PaymentType.Spark) return "Spark"

  if (!instance || !instance.__typename) {
    return "Unknown"
  }

  switch (instance.__typename) {
    case "SettlementViaOnChain":
      return "OnChain"
    case "SettlementViaLn":
      return "Lightning"
    case "SettlementViaIntraLedger":
      return "IntraLedger"
    default:
      return "Unknown"
  }
}

type Props = {
  route: RouteProp<RootStackParamList, "transactionDetail">
}

export const TransactionDetailScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()
  const insets = useSafeAreaInsets()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { hideAmount, toggleHideAmount } = useHideAmount()
  const { formatMoneyAmount } = useDisplayCurrency()
  const {
    appConfig: { galoyInstance },
  } = useAppConfig()
  const { txid } = route.params

  const { data: homeData } = useHomeAuthedQuery({ fetchPolicy: "cache-only" })

  const viewInExplorer = (hash: string): Promise<Linking> => {
    if (hash.includes("-")) {
      // if the "hash" contains a dash then it's actually a UUID from spark
      return Linking.openURL(galoyInstance.sparkExplorer + hash)
    }

    return Linking.openURL(galoyInstance.blockExplorer + hash)
  }

  const viewInLightningDecoder = (invoice: string): Promise<Linking> =>
    Linking.openURL("https://dev.blink.sv/decode?invoice=" + invoice)

  const { data: tx } = useFragment<TransactionFragment>({
    fragment: TransactionFragmentDoc,
    fragmentName: "Transaction",
    from: {
      __typename: "Transaction",
      id: txid,
    },
  })

  const [refetch] = useTransactionListForDefaultAccountLazyQuery({
    fetchPolicy: "network-only",
  })
  const [timer, setTimer] = React.useState<number>(0)

  const { LL, locale } = useI18nContext()
  const { isSelfCustodial } = useActiveWallet()
  const { allTransactions: selfCustodialAllTransactions } = useSelfCustodialWallet()
  const { copyToClipboard } = useClipboard()
  const { formatCurrency } = useDisplayCurrency()

  /** The same list home reads, so both screens resolve the same newest transaction and
   *  therefore agree on the seen-state id they write and compare. */
  const selfCustodialTransactions = React.useMemo(
    () => (isSelfCustodial ? selfCustodialAllTransactions : NO_TRANSACTIONS),
    [isSelfCustodial, selfCustodialAllTransactions],
  )

  const selfCustodialPaymentType = React.useMemo(
    () =>
      selfCustodialTransactions.find((transaction) => transaction.id === txid)
        ?.paymentType,
    [selfCustodialTransactions, txid],
  )

  const selfCustodialFragments = useSelfCustodialTransactionFragments(
    selfCustodialTransactions,
  )

  const hasTxData = Boolean(tx) && Object.keys(tx).length > 0
  const { status: resolveStatus, retry: retryResolve } = useResolveTransactionAccount({
    txid,
    hasTx: hasTxData || Boolean(selfCustodialPaymentType),
    recipientUserId: route.params.recipientUserId,
  })

  const description = useDescriptionDisplay({
    tx,
    bankName: galoyInstance.name,
  })

  const onChainTxBroadcasted =
    tx.settlementVia?.__typename === "SettlementViaOnChain" &&
    tx.settlementVia.transactionHash !== null

  const onChainTxNotBroadcasted =
    tx.settlementVia?.__typename === "SettlementViaOnChain" &&
    tx.settlementVia.transactionHash === null

  const arrivalInMempoolEstimatedAt =
    onChainTxNotBroadcasted &&
    tx.settlementVia?.__typename === "SettlementViaOnChain" &&
    tx.settlementVia.arrivalInMempoolEstimatedAt

  const timeDiff =
    typeof arrivalInMempoolEstimatedAt === "number"
      ? timeToMempool(arrivalInMempoolEstimatedAt)
      : NaN

  const countdown =
    typeof arrivalInMempoolEstimatedAt === "number"
      ? formatTimeToMempool(timeDiff, LL, locale)
      : ""

  /**
   * Empty for custodial, which leaves the seen state reading the cached home query;
   * self-custodial has no such cache and must be handed its own transactions, or the
   * screen could never tell that the one being read is the newest and mark it seen.
   */
  const { latestBtcTxId, latestUsdTxId, markTxSeen } = useTransactionSeenState({
    accountId: homeData?.me?.defaultAccount?.id || "",
    isSelfCustodial,
    transactions: selfCustodialFragments,
  })

  React.useEffect(() => {
    let intervalId: NodeJS.Timeout

    const onChainTxNotBroadcasted =
      tx?.settlementVia?.__typename === "SettlementViaOnChain" &&
      tx?.settlementVia?.transactionHash === null

    if (onChainTxNotBroadcasted) {
      intervalId = setInterval(() => {
        if (timer % 30 === 0) {
          refetch()
        } else if (timeDiff <= 0 || Number.isNaN(timeDiff)) {
          refetch()
        }

        setTimer((timer) => timer + 1)
      }, 1000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [tx, refetch, timer, timeDiff])

  React.useEffect(() => {
    if (!txid || !tx.settlementCurrency) return
    const latestId =
      tx.settlementCurrency === WalletCurrency.Btc ? latestBtcTxId : latestUsdTxId

    if (latestId && latestId === txid) {
      markTxSeen(tx.settlementCurrency)
    }
  }, [txid, tx.settlementCurrency, latestBtcTxId, latestUsdTxId, markTxSeen])

  if (!hasTxData) {
    // Missing from the active account's cache — the resolver may be probing the
    // other saved profiles for it (multi-account payment notifications, #3826).
    const resolving =
      resolveStatus === "idle" ||
      resolveStatus === "resolving" ||
      resolveStatus === "switching"
    return (
      <Screen unsafe preset="fixed">
        <View style={[styles.outerContainer, { paddingBottom: insets.bottom }]}>
          <View style={[styles.amountDetailsContainer, { paddingTop: insets.top }]}>
            <View accessible={false} style={styles.closeIconContainer}>
              <GaloyIconButton
                name="close"
                onPress={navigation.goBack}
                iconOnly={true}
                size={"large"}
              />
            </View>
          </View>
          <View style={styles.resolveContainer}>
            {resolving ? (
              <>
                <ActivityIndicator size="large" />
                <Text type="p1" style={styles.resolveText}>
                  {LL.TransactionDetailScreen.findingAccount()}
                </Text>
              </>
            ) : resolveStatus === "notFound" ? (
              <Text type="p1" style={styles.resolveText}>
                {LL.TransactionDetailScreen.txNotFoundInAccounts()}
              </Text>
            ) : (
              <>
                <Text type="p1" style={styles.resolveText}>
                  {LL.TransactionDetailScreen.txLoadFailed()}
                </Text>
                <GaloyPrimaryButton title={LL.common.tryAgain()} onPress={retryResolve} />
              </>
            )}
          </View>
        </View>
      </Screen>
    )
  }

  const {
    id,
    settlementCurrency,
    settlementAmount,
    settlementDisplayFee,
    settlementDisplayAmount,
    settlementDisplayCurrency,
    settlementFee,

    settlementVia,
    initiationVia,
    createdAt,
    status,
  } = tx

  if (
    !settlementCurrency ||
    settlementAmount === undefined ||
    settlementDisplayFee === undefined ||
    settlementDisplayAmount === undefined ||
    !settlementDisplayCurrency ||
    settlementFee === undefined ||
    !settlementVia ||
    !createdAt ||
    !status
  ) {
    return <Text>missing values to render the screen</Text>
  }

  const isReceive = tx.direction === "RECEIVE"

  const walletCurrency = settlementCurrency as WalletCurrency

  const displayAmount = formatCurrency({
    amountInMajorUnits: settlementDisplayAmount,
    currency: settlementDisplayCurrency,
  })

  const formattedPrimaryFeeAmount = formatCurrency({
    amountInMajorUnits: settlementDisplayFee,
    currency: settlementDisplayCurrency,
  })

  const formattedSettlementFee = formatMoneyAmount({
    moneyAmount: toWalletAmount({
      amount: settlementFee,
      currency: settlementCurrency,
    }),
  })

  // only show a secondary amount if it is in a different currency than the primary amount
  const formattedSecondaryFeeAmount =
    tx.settlementDisplayCurrency === tx.settlementCurrency
      ? undefined
      : formattedSettlementFee

  const formattedFeeText =
    formattedPrimaryFeeAmount +
    (formattedSecondaryFeeAmount ? ` (${formattedSecondaryFeeAmount})` : ``)
  const Wallet = (
    <WalletSummary
      amountType={isReceive ? "RECEIVE" : "SEND"}
      settlementAmount={toWalletAmount({
        amount: Math.abs(settlementAmount),
        currency: settlementCurrency,
      })}
      txDisplayAmount={settlementDisplayAmount}
      txDisplayCurrency={settlementDisplayCurrency}
    />
  )

  const handleCopyToClipboard = ({
    content,
    type,
  }: {
    content: string
    type: string
  }) => {
    copyToClipboard({
      content,
      message: LL.common.hasBeenCopiedToClipboard({ type }),
    })
  }

  let spendOrReceiveText = ""
  if (isReceive) {
    spendOrReceiveText = LL.TransactionDetailScreen.received()
  } else if (onChainTxNotBroadcasted) {
    spendOrReceiveText = LL.TransactionDetailScreen.sending()
  } else {
    spendOrReceiveText = LL.TransactionDetailScreen.spent()
  }

  return (
    <Screen unsafe preset="fixed">
      <View style={[styles.outerContainer, { paddingBottom: insets.bottom }]}>
        <View style={[styles.amountDetailsContainer, { paddingTop: insets.top }]}>
          <View accessible={false} style={styles.closeIconContainer}>
            <GaloyIconButton
              name="close"
              onPress={navigation.goBack}
              iconOnly={true}
              size={"large"}
            />
          </View>
          <View style={styles.amountView}>
            <IconTransaction
              isReceive={isReceive}
              walletCurrency={walletCurrency}
              pending={false}
              onChain={settlementVia?.__typename === "SettlementViaOnChain"}
            />
            {/* Pinned to one line: leaving it unbounded lets Android re-break
                it after the first word on a re-layout, and since the container
                height is already fixed by the first measure pass the wrapped
                word lands outside it and is clipped — "You spent" silently
                renders as "You". Shrink rather than ellipsize when the line
                genuinely doesn't fit, so a long locale (the longest is ms
                "Anda dah belanjakan") stays whole under accessibility font
                scaling instead of losing its tail. */}
            <Text type="h2" numberOfLines={1} adjustsFontSizeToFit>
              {spendOrReceiveText}
            </Text>
            <Pressable hitSlop={10} onPress={toggleHideAmount}>
              <View style={styles.amountWrapper}>
                {hideAmount ? (
                  <HiddenBalancePlaceholder size="small" />
                ) : (
                  <Text type="h1">{displayAmount}</Text>
                )}
              </View>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.transactionDetailView}>
          {onChainTxNotBroadcasted && (
            <View style={styles.txNotBroadcast}>
              <GaloyInfo>
                {LL.TransactionDetailScreen.txNotBroadcast({ countdown })}
              </GaloyInfo>
            </View>
          )}
          {onChainTxBroadcasted && (
            <View>
              <Row
                entry="Transaction Hash"
                value={
                  ("transactionHash" in settlementVia &&
                    settlementVia?.transactionHash) ||
                  ""
                }
                icons={[
                  <IconAction
                    key="explorer"
                    name="arrow-square-out"
                    onPress={() =>
                      viewInExplorer(
                        ("transactionHash" in settlementVia &&
                          settlementVia?.transactionHash) ||
                          "",
                      )
                    }
                  />,
                  <IconAction
                    key="copy"
                    name="copy-paste"
                    onPress={() =>
                      handleCopyToClipboard({
                        content:
                          ("transactionHash" in settlementVia &&
                            settlementVia?.transactionHash) ||
                          "",
                        type: "Transaction Hash",
                      })
                    }
                  />,
                ]}
              />
            </View>
          )}
          <Row
            entry={
              isReceive
                ? LL.TransactionDetailScreen.receivingAccount()
                : LL.TransactionDetailScreen.sendingAccount()
            }
            content={Wallet}
          />

          <Row
            entry={LL.common.date()}
            value={
              <TransactionDate createdAt={createdAt} status={status} includeTime={true} />
            }
          />
          {!isReceive && <Row entry={LL.common.fees()} value={formattedFeeText} />}
          <Row
            entry={LL.common.description()}
            value={description}
            icons={[
              <IconAction
                key="copy"
                name="copy-paste"
                onPress={() =>
                  handleCopyToClipboard({
                    content: description ?? "",
                    type: LL.common.description(),
                  })
                }
              />,
            ]}
          />
          {settlementVia?.__typename === "SettlementViaIntraLedger" && (
            <Row
              entry={LL.TransactionDetailScreen.paid()}
              value={settlementVia.counterPartyUsername || galoyInstance.name}
            />
          )}
          <Row
            entry={LL.common.type()}
            value={typeDisplay(settlementVia, selfCustodialPaymentType)}
          />
          {initiationVia?.__typename === "InitiationViaLn" &&
            initiationVia?.paymentHash && (
              <Row
                entry="Hash"
                value={initiationVia?.paymentHash}
                icons={[
                  <IconAction
                    key="copy"
                    name="copy-paste"
                    onPress={() =>
                      handleCopyToClipboard({
                        content: initiationVia?.paymentHash ?? "",
                        type: "Hash",
                      })
                    }
                  />,
                ]}
              />
            )}

          {(settlementVia?.__typename === "SettlementViaLn" ||
            settlementVia?.__typename === "SettlementViaIntraLedger") &&
            settlementVia?.preImage && (
              <Row
                entry={LL.common.preimageProofOfPayment()}
                value={settlementVia?.preImage}
                icons={[
                  <IconAction
                    key="copy"
                    name="copy-paste"
                    onPress={() =>
                      handleCopyToClipboard({
                        content: settlementVia?.preImage ?? "",
                        type: LL.common.preimageProofOfPayment(),
                      })
                    }
                  />,
                ]}
              />
            )}
          {initiationVia?.__typename === "InitiationViaLn" &&
            initiationVia?.paymentRequest && (
              <Row
                entry={LL.common.paymentRequest()}
                value={initiationVia?.paymentRequest}
                icons={[
                  <IconAction
                    key="explorer"
                    name="arrow-square-out"
                    onPress={() =>
                      viewInLightningDecoder(initiationVia?.paymentRequest ?? "")
                    }
                  />,
                  <IconAction
                    key="copy"
                    name="copy-paste"
                    onPress={() =>
                      handleCopyToClipboard({
                        content: initiationVia?.paymentRequest ?? "",
                        type: LL.common.paymentRequest(),
                      })
                    }
                  />,
                ]}
              />
            )}
          {id && !isSelfCustodial && (
            <Row
              entry="Blink Internal Id"
              value={id}
              icons={[
                <IconAction
                  key="copy"
                  name="copy-paste"
                  onPress={() =>
                    handleCopyToClipboard({
                      content: id,
                      type: "Blink Internal Id",
                    })
                  }
                />,
              ]}
            />
          )}
        </ScrollView>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  closeIconContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingRight: 10,
  },

  amountText: {
    fontSize: 18,
    marginVertical: 6,
  },

  amountDetailsContainer: {
    backgroundColor: colors.grey5,
  },

  amountView: {
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -12 }],
  },

  amountWrapper: {
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  description: {
    marginBottom: 6,
  },

  entry: {
    marginVertical: 4,
  },

  transactionDetailView: {
    marginHorizontal: 24,
    paddingVertical: 12,
  },
  valueContainer: {
    flexDirection: "row",
    minHeight: 60,
    padding: 14,
    backgroundColor: colors.grey5,
    alignItems: "center",
    borderRadius: 8,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: "bold",
  },
  valueIcons: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 12,
    gap: 10,
  },
  txNotBroadcast: {
    marginBottom: 16,
  },

  resolveContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },

  resolveText: {
    textAlign: "center",
  },

  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    verticalAlign: "top",
  },

  outerContainer: {
    flex: 1,
  },
}))
