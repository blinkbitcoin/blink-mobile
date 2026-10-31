import * as React from "react"
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ScrollView } from "react-native-gesture-handler"
import { type ViewShotRef } from "react-native-view-shot"
import { useFragment } from "@apollo/client"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { IconTextButton } from "@app/components/icon-text-button"
import { HiddenBalancePlaceholder } from "@app/components/hidden-balance-placeholder/hidden-balance-placeholder"
import { NoteInput } from "@app/components/note-input"
import {
  formatDateForTransaction,
  TransactionDate,
} from "@app/components/transaction-date"
import { useDescriptionDisplay } from "@app/components/transaction-item"
import { DeepPartialObject } from "@app/components/transaction-item/index.types"
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
import { useScreenshot } from "@app/hooks/use-screenshot"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { toWalletAmount } from "@app/types/amounts"
import { NO_TRANSACTIONS, PaymentType } from "@app/types/transaction"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { PaymentType as ReceiptPaymentType } from "@blinkbitcoin/blink-client"

import { Screen } from "@app/components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { APPROXIMATE_PREFIX } from "@app/config"
import { SendWalletSummary } from "@app/screens/send-bitcoin-screen/amount-entry/send-wallet-summary"
import { ellipsizeMiddle } from "@app/utils/helper"
import { testProps } from "@app/utils/testProps"
import { formatTimeToMempool, timeToMempool } from "./format-time"
import { TransactionReceipt } from "./transaction-receipt"

type RowProps = {
  label: string
  value?: string | null | JSX.Element
  /** Long technical values (hashes, invoices) are set a size down so they wrap tidily. */
  small?: boolean
  /** Drawn underlined: a tap opens it, a long press copies it. */
  link?: boolean
  onPress?: () => void
  onLongPress?: () => void
}

/** A label/value line in a details card. Tapping a copyable row copies its value. */
const Row = ({ label, value, small, link, onPress, onLongPress }: RowProps) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={onPress ? "button" : undefined}
      testID={label}
    >
      <Text type="p3" color={colors.grey1} style={styles.rowLabel}>
        {label}
      </Text>
      <Text
        type={small ? "p4" : "p3"}
        bold
        style={[styles.rowValue, link && styles.rowValueLink]}
      >
        {value}
      </Text>
    </Pressable>
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

const CUSTOM_LABEL_MAX_LENGTH = 140

export const TransactionDetailScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const insets = useSafeAreaInsets()

  const viewRef = React.useRef<ViewShotRef>(null)
  const { isTakingScreenshot, captureAndShare } = useScreenshot(viewRef)
  // Not saved yet: the label lives only while the screen is open
  const [customLabel, setCustomLabel] = React.useState("")
  const [advancedOpen, setAdvancedOpen] = React.useState(false)

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

  const displayAmount = formatCurrency({
    amountInMajorUnits: Math.abs(Number(settlementDisplayAmount)),
    currency: settlementDisplayCurrency,
    withSign: false,
  })

  // What moved in the wallet's own currency
  const walletAmount = formatMoneyAmount({
    moneyAmount: toWalletAmount({
      amount: Math.abs(settlementAmount),
      currency: settlementCurrency,
    }),
  })
  // The hero's second line, only when the wallet currency isn't the display currency
  const secondaryAmount =
    settlementDisplayCurrency === settlementCurrency ? undefined : walletAmount

  // The balance card: the wallet amount, then the display amount
  const walletSecondaryAmount =
    settlementDisplayCurrency === settlementCurrency
      ? undefined
      : `${APPROXIMATE_PREFIX} ${displayAmount}`

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

  // Sends always show their fee; a receive only when it was charged one (on-chain deposits)
  const feeLabel = isReceive ? LL.TransactionDetailScreen.depositFee() : LL.common.fees()
  const showFee = !isReceive || settlementFee !== 0

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

  const copyRow = (type: string, content: string) => () =>
    handleCopyToClipboard({ content, type })

  let spendOrReceiveText = ""
  if (isReceive) {
    spendOrReceiveText = LL.TransactionDetailScreen.received()
  } else if (onChainTxNotBroadcasted) {
    spendOrReceiveText = LL.TransactionDetailScreen.sending()
  } else {
    spendOrReceiveText = LL.TransactionDetailScreen.sent()
  }

  const transactionHash =
    onChainTxBroadcasted && "transactionHash" in settlementVia
      ? settlementVia.transactionHash ?? ""
      : ""
  const paymentHash =
    initiationVia?.__typename === "InitiationViaLn" ? initiationVia.paymentHash : ""
  const paymentRequest =
    initiationVia?.__typename === "InitiationViaLn" ? initiationVia.paymentRequest : ""
  const preImage =
    (settlementVia?.__typename === "SettlementViaLn" ||
      settlementVia?.__typename === "SettlementViaIntraLedger") &&
    settlementVia.preImage
      ? settlementVia.preImage
      : ""
  const counterParty =
    settlementVia?.__typename === "SettlementViaIntraLedger"
      ? settlementVia.counterPartyUsername || galoyInstance.name
      : ""
  const internalId = id && !isSelfCustodial ? id : ""
  const typeText = typeDisplay(settlementVia, selfCustodialPaymentType)

  // The shared receipt is the send receipt, filled from this transaction
  const ellipsize = (value: string) =>
    ellipsizeMiddle(value, { maxLength: 50, maxResultLeft: 13, maxResultRight: 8 })
  const otherParty =
    initiationVia?.__typename === "InitiationViaOnChain" && initiationVia.address
      ? ellipsize(initiationVia.address)
      : initiationVia?.__typename === "InitiationViaLn" && initiationVia.paymentRequest
        ? ellipsize(initiationVia.paymentRequest)
        : counterParty
  const receiptPaymentType =
    selfCustodialPaymentType === PaymentType.Spark
      ? typeText
      : settlementVia?.__typename === "SettlementViaOnChain"
        ? ReceiptPaymentType.Onchain
        : settlementVia?.__typename === "SettlementViaIntraLedger"
          ? ReceiptPaymentType.Intraledger
          : ReceiptPaymentType.Lightning

  const hasAdvanced = Boolean(
    transactionHash || paymentHash || preImage || paymentRequest || internalId,
  )

  // Every row on the screen, in screen order, as one block of plain text
  const copyAllData = () => {
    const timeText = formatDateForTransaction({ createdAt, locale, includeTime: true })
    const allDataText = [
      customLabel && `${LL.TransactionDetailScreen.customLabel()}: ${customLabel}`,
      `${spendOrReceiveText}: ${displayAmount}${secondaryAmount ? ` (${secondaryAmount})` : ""}`,
      showFee && `${feeLabel}: ${formattedFeeText}`,
      `${LL.TransactionDetailScreen.time()}: ${timeText}`,
      `${LL.common.type()}: ${typeText}`,
      counterParty && `${LL.TransactionDetailScreen.paid()}: ${counterParty}`,
      description && `${LL.common.note()}: ${description}`,
      transactionHash &&
        `${LL.TransactionDetailScreen.transactionId()}: ${transactionHash}`,
      paymentHash && `${LL.TransactionDetailScreen.hash()}: ${paymentHash}`,
      preImage && `${LL.common.preimageProofOfPayment()}: ${preImage}`,
      paymentRequest && `${LL.common.paymentRequest()}: ${paymentRequest}`,
      internalId && `${LL.TransactionDetailScreen.blinkInternalId()}: ${internalId}`,
    ]
      .filter(Boolean)
      .join("\n")

    handleCopyToClipboard({
      content: allDataText,
      type: LL.TransactionDetailScreen.allData(),
    })
  }

  return (
    <Screen unsafe preset="fixed">
      <View style={[styles.outerContainer, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.section}>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <GaloyIcon
                  name={isReceive ? "receive" : "send"}
                  size={32}
                  color={isReceive ? colors._green : colors.primary}
                />
              </View>
              <View style={styles.heroText}>
                {/* Pinned to one line: leaving it unbounded lets Android re-break
                    it after the first word on a re-layout, and since the container
                    height is already fixed by the first measure pass the wrapped
                    word lands outside it and is clipped — "You sent" silently
                    renders as "You". Shrink rather than ellipsize when the line
                    genuinely doesn't fit, so a long locale stays whole under
                    accessibility font scaling instead of losing its tail. */}
                <Text
                  type="p3"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.centered}
                  testID="transaction-heading"
                >
                  {spendOrReceiveText}
                </Text>
                {/* Hiding keeps both amount lines laid out but invisible, with the
                    placeholder drawn over them, so the hero is the same height either
                    way at any font size and nothing below it moves. */}
                <Pressable
                  hitSlop={10}
                  onPress={toggleHideAmount}
                  style={styles.amounts}
                  accessibilityRole="button"
                >
                  <View
                    style={[styles.amounts, hideAmount && styles.invisible]}
                    importantForAccessibility={
                      hideAmount ? "no-hide-descendants" : "auto"
                    }
                    accessibilityElementsHidden={hideAmount}
                  >
                    <Text type="h1" bold style={styles.centered}>
                      {displayAmount}
                    </Text>
                    {secondaryAmount ? (
                      <Text type="p3" style={styles.centered}>
                        {secondaryAmount}
                      </Text>
                    ) : null}
                  </View>
                  {hideAmount && (
                    <View style={styles.hiddenOverlay}>
                      <HiddenBalancePlaceholder size="small" />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {onChainTxNotBroadcasted && (
              <GaloyInfo backgroundColor={colors.grey7}>
                {LL.TransactionDetailScreen.txNotBroadcast({ countdown })}
              </GaloyInfo>
            )}

            <NoteInput
              value={customLabel}
              onChangeText={setCustomLabel}
              editable
              big={false}
              fontSize={14}
              iconSize={16}
              placeholder={LL.TransactionDetailScreen.customLabel()}
              maxLength={CUSTOM_LABEL_MAX_LENGTH}
              style={styles.labelField}
            />
            <View style={styles.group}>
              <Text type="p3">
                {isReceive
                  ? LL.TransactionDetailScreen.receivingAccount()
                  : LL.TransactionDetailScreen.sendingAccount()}
              </Text>
              <SendWalletSummary
                inactive
                currency={settlementCurrency}
                balancePrimary={walletAmount}
                balanceSecondary={walletSecondaryAmount}
              />
            </View>

            <View style={styles.card}>
              {showFee && <Row label={feeLabel} value={formattedFeeText} />}
              <Row
                label={LL.TransactionDetailScreen.time()}
                value={
                  <TransactionDate
                    createdAt={createdAt}
                    status={status}
                    includeTime={true}
                  />
                }
              />
              <Row label={LL.common.type()} value={typeText} />
              {counterParty ? (
                <Row label={LL.TransactionDetailScreen.paid()} value={counterParty} />
              ) : null}
              {description ? (
                <Row
                  label={LL.common.note()}
                  value={description}
                  onPress={copyRow(LL.common.note(), description)}
                />
              ) : null}
            </View>
          </View>

          {hasAdvanced && (
            <Pressable
              style={styles.advancedToggle}
              onPress={() => setAdvancedOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: advancedOpen }}
              {...testProps(LL.common.advanced())}
            >
              <GaloyIcon
                name={advancedOpen ? "caret-down" : "caret-right"}
                size={16}
                color={colors.black}
              />
              <Text type="p3">{LL.common.advanced()}</Text>
            </Pressable>
          )}

          {hasAdvanced && advancedOpen && (
            <>
              <View style={styles.card}>
                {transactionHash ? (
                  <Row
                    small
                    link
                    label={LL.TransactionDetailScreen.transactionId()}
                    value={transactionHash}
                    onPress={() => viewInExplorer(transactionHash)}
                    onLongPress={copyRow(
                      LL.TransactionDetailScreen.transactionId(),
                      transactionHash,
                    )}
                  />
                ) : null}
                {paymentHash ? (
                  <Row
                    small
                    label={LL.TransactionDetailScreen.hash()}
                    value={paymentHash}
                    onPress={copyRow(LL.TransactionDetailScreen.hash(), paymentHash)}
                  />
                ) : null}
                {preImage ? (
                  <Row
                    small
                    label={LL.common.preimageProofOfPayment()}
                    value={preImage}
                    onPress={copyRow(LL.common.preimageProofOfPayment(), preImage)}
                  />
                ) : null}
                {paymentRequest ? (
                  <Row
                    small
                    link
                    label={LL.common.paymentRequest()}
                    value={paymentRequest}
                    onPress={() => viewInLightningDecoder(paymentRequest)}
                    onLongPress={copyRow(LL.common.paymentRequest(), paymentRequest)}
                  />
                ) : null}
                {internalId ? (
                  <Row
                    small
                    label={LL.TransactionDetailScreen.blinkInternalId()}
                    value={internalId}
                    onPress={copyRow(
                      LL.TransactionDetailScreen.blinkInternalId(),
                      internalId,
                    )}
                  />
                ) : null}
              </View>
              <IconTextButton
                icon="copy-paste"
                label={LL.TransactionDetailScreen.copyAllData()}
                onPress={copyAllData}
              />
            </>
          )}
        </ScrollView>

        <View style={[styles.buttonGroup, { paddingBottom: 20 + insets.bottom }]}>
          <GaloyPrimaryButton
            title={LL.common.share()}
            onPress={captureAndShare}
            loading={isTakingScreenshot}
          />
        </View>

        {/* What Share captures: the send receipt, drawn off screen at the size of the
            screen and only while the capture runs. */}
        {isTakingScreenshot && (
          <TransactionReceipt
            ref={viewRef}
            isReceive={isReceive}
            currencyAmount={displayAmount}
            satAmount={secondaryAmount}
            currencyFeeAmount={showFee ? formattedPrimaryFeeAmount : undefined}
            satFeeAmount={showFee ? formattedSecondaryFeeAmount : undefined}
            counterParty={otherParty}
            createdAt={createdAt}
            paymentType={receiptPaymentType}
            note={tx.memo ?? undefined}
          />
        )}

        <View style={[styles.closeButton, { top: insets.top + 14 }]}>
          <GaloyIconButton
            name="close"
            size="medium"
            backgroundColor={colors.grey5}
            onPress={navigation.goBack}
          />
        </View>
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

  closeButton: {
    position: "absolute",
    right: 20,
  },

  outerContainer: {
    flex: 1,
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 14,
  },

  section: {
    gap: 14,
  },

  hero: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
  },

  heroIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  heroText: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 5,
  },

  centered: {
    textAlign: "center",
  },

  amounts: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 5,
  },

  invisible: {
    opacity: 0,
  },

  hiddenOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },

  labelField: {
    borderRadius: 8,
    paddingLeft: 14,
    paddingRight: 10,
  },

  group: {
    gap: 8,
  },

  card: {
    backgroundColor: colors.grey7,
    borderRadius: 8,
    padding: 14,
    gap: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  rowPressed: {
    opacity: 0.6,
  },

  rowLabel: {
    flex: 1,
    maxWidth: 100,
  },

  rowValue: {
    flex: 1,
    textAlign: "right",
  },

  rowValueLink: {
    textDecorationLine: "underline",
  },

  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
  },

  buttonGroup: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: colors.white,
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

  amountDetailsContainer: {
    backgroundColor: colors.grey5,
  },
}))
