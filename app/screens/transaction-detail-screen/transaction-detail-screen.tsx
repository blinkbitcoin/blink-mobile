import * as React from "react"
import { Linking, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ScrollView } from "react-native-gesture-handler"
import { useFragment } from "@apollo/client"
import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { TransactionDate } from "@app/components/transaction-date"
import { useDescriptionDisplay } from "@app/components/transaction-item"
import { DeepPartialObject } from "@app/components/transaction-item/index.types"
import { WalletSummary } from "@app/components/wallet-summary"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import {
  SettlementVia,
  TransactionFragment,
  TransactionFragmentDoc,
  useTransactionListForDefaultAccountLazyQuery,
  useHomeAuthedQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useAppConfig, useClipboard, useTransactionSeenState } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toWalletAmount } from "@app/types/amounts"
import { PaymentType } from "@app/types/transaction"
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
  const { isSelfCustodial, wallets } = useActiveWallet()
  const { copyToClipboard } = useClipboard()
  const { formatCurrency } = useDisplayCurrency()

  const selfCustodialPaymentType = React.useMemo(() => {
    if (!isSelfCustodial) return undefined
    for (const wallet of wallets) {
      const match = wallet.transactions.find((t) => t.id === txid)
      if (match) return match.paymentType
    }
    return undefined
  }, [isSelfCustodial, wallets, txid])

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

  const { latestBtcTxId, latestUsdTxId, markTxSeen } = useTransactionSeenState(
    homeData?.me?.defaultAccount?.id || "",
  )

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

  // FIXME doesn't work with storybook
  // TODO: translation
  if (!tx || Object.keys(tx).length === 0)
    return <Text>{"No transaction found with this ID (should not happen)"}</Text>

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

  let spendOrReceiveText: string
  if (isReceive) {
    spendOrReceiveText = LL.TransactionDetailScreen.received()
  } else if (onChainTxNotBroadcasted) {
    spendOrReceiveText = LL.TransactionDetailScreen.sending()
  } else {
    spendOrReceiveText = LL.TransactionDetailScreen.spent()
  }

  console.log("settlementVia: ", settlementVia)
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
            <Text type="h2">{spendOrReceiveText}</Text>
            <Text type="h1">{displayAmount}</Text>
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
