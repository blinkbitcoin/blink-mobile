import {
  requestInvoiceWithServiceParams,
  utils,
  Satoshis,
  LnUrlPayServiceResponse,
} from "lnurl-pay"
import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CurrencyKeyboard } from "@app/components/currency-keyboard"
import { NoteInput } from "@app/components/note-input"
import { PercentageSelector } from "@app/components/percentage-selector"
import { Screen } from "@app/components/screen"
import {
  useSendBitcoinInternalLimitsQuery,
  useSendBitcoinWithdrawalLimitsQuery,
  WalletCurrency,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"

import {
  decodeInvoiceString,
  Network as NetworkLibGaloy,
} from "@blinkbitcoin/blink-client"
import { NavigationProp, RouteProp, useNavigation } from "@react-navigation/native"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { useClipboard, usePriceConversion } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  DisplayCurrency,
  greaterThan,
  lessThan,
  MoneyAmount,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { reportError } from "@app/utils/error-logging"

import { FeeTierSelector } from "./fee-tier-selector"
import { shouldWarnAboutHighFee } from "./hooks/onchain-fee-alert"
import { useOnchainFeeTierOptions } from "./hooks/use-onchain-fee-tier-options"
import { useSendWallets } from "./hooks/use-send-wallets"

import { testProps } from "../../utils/testProps"
import { SendAmountHeader } from "./amount-entry/send-amount-header"
import { SendWalletSummary } from "./amount-entry/send-wallet-summary"
import { useSendAmountPad } from "./amount-entry/use-send-amount-pad"
import { ConfirmFeesModal } from "./confirm-fees-modal"
import { AmountInvalidReason, isValidAmount } from "./payment-details"
import { PaymentDetail } from "./payment-details/index.types"
import { SendBitcoinDetailsExtraInfo } from "./send-bitcoin-details-extra-info"

gql`
  query sendBitcoinDetailsScreen {
    globals {
      network
    }
    me {
      id
      defaultAccount {
        id
        defaultWalletId
        wallets {
          id
          walletCurrency
          balance
        }
      }
    }
  }

  query sendBitcoinWithdrawalLimits {
    me {
      id
      defaultAccount {
        id
        limits {
          withdrawal {
            totalLimit
            remainingLimit
            interval
          }
        }
      }
    }
  }

  query sendBitcoinInternalLimits {
    me {
      id
      defaultAccount {
        id
        limits {
          internalSend {
            totalLimit
            remainingLimit
            interval
          }
        }
      }
    }
  }
`

type Props = {
  route: RouteProp<RootStackParamList, "sendBitcoinDetails">
}

const SendBitcoinDetailsScreen: React.FC<Props> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const navigation =
    useNavigation<NavigationProp<RootStackParamList, "sendBitcoinDetails">>()

  const { currentLevel } = useLevel()

  const {
    wallets,
    defaultWallet,
    btcWallet,
    usdWallet,
    network,
    isSelfCustodial,
    loading: isWalletListPending,
  } = useSendWallets()

  const { formatMoneyAmount, getSecondaryAmountIfCurrencyIsDifferent } =
    useDisplayCurrency()
  const { LL } = useI18nContext()
  const { copyToClipboard } = useClipboard()
  const [isLoadingLnurl, setIsLoadingLnurl] = useState(false)
  const [modalHighFeesVisible, setModalHighFeesVisible] = useState(false)
  const [selectedPercent, setSelectedPercent] = useState<number | null>(null)

  const { convertMoneyAmount: _convertMoneyAmount } = usePriceConversion()
  const { zeroDisplayAmount } = useDisplayCurrency()
  const { paymentDestination } = route.params

  const [paymentDetail, setPaymentDetail] =
    useState<PaymentDetail<WalletCurrency> | null>(null)
  const {
    feeTier,
    setFeeTier,
    feeTierOptions,
    feeTierErrorMessage,
    isFeeTierErrorBlocking,
    isQuotingFees,
    isOnchain,
    selectedTierFee,
    hasFeeQuote,
  } = useOnchainFeeTierOptions({
    paymentDetail,
    isSelfCustodial,
    paymentDestination,
    convertMoneyAmount: _convertMoneyAmount,
  })

  const handleFeeTierChange = (tier: typeof feeTier) => {
    const rebuilt = setFeeTier(tier, paymentDetail)
    if (rebuilt) setPaymentDetail(rebuilt)
  }

  const { data: withdrawalLimitsData } = useSendBitcoinWithdrawalLimitsQuery({
    fetchPolicy: "no-cache",
    skip:
      !useIsAuthed() ||
      !paymentDetail?.paymentType ||
      paymentDetail.paymentType === "intraledger",
  })

  const { data: intraledgerLimitsData } = useSendBitcoinInternalLimitsQuery({
    fetchPolicy: "no-cache",
    skip:
      !useIsAuthed() ||
      !paymentDetail?.paymentType ||
      paymentDetail.paymentType !== "intraledger",
  })

  const [asyncErrorMessage, setAsyncErrorMessage] = useState("")

  const setAmount = useCallback((moneyAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setSelectedPercent(null)
    setPaymentDetail((paymentDetail) =>
      paymentDetail?.setAmount ? paymentDetail.setAmount(moneyAmount) : paymentDetail,
    )
  }, [])

  const amountPad = useSendAmountPad({
    walletCurrency:
      paymentDetail?.sendingWalletDescriptor.currency ??
      defaultWallet?.walletCurrency ??
      WalletCurrency.Btc,
    convertMoneyAmount: paymentDetail?.convertMoneyAmount ?? _convertMoneyAmount,
    onAmountChange: setAmount,
  })

  // we are caching the _convertMoneyAmount when the screen loads.
  // this is because the _convertMoneyAmount can change while the user is on this screen
  // and we don't want to update the payment detail with a new convertMoneyAmount
  useEffect(() => {
    if (!_convertMoneyAmount) {
      return
    }

    setPaymentDetail(
      (paymentDetail) =>
        paymentDetail && paymentDetail.setConvertMoneyAmount(_convertMoneyAmount),
    )
  }, [_convertMoneyAmount, setPaymentDetail])

  // we set the default values when the screen loads
  // this only run once (doesn't re-run after paymentDetail is set)
  useEffect(() => {
    /**
     * The wallet list is not final until the region resolves: a restricted verdict drops the
     * dollar wallet from it. Seeding before that picks a `defaultWallet` the verdict is about
     * to withdraw, and this effect never runs again once `paymentDetail` is set, so the
     * screen would go on sending from a wallet it no longer offers.
     */
    if (paymentDetail || !defaultWallet || !_convertMoneyAmount || isWalletListPending) {
      return
    }

    let initialPaymentDetail = paymentDestination.createPaymentDetail({
      convertMoneyAmount: _convertMoneyAmount,
      sendingWalletDescriptor: {
        id: defaultWallet.id,
        currency: defaultWallet.walletCurrency,
      },
    })

    // Start with usd as the unit of account
    if (initialPaymentDetail.canSetAmount) {
      initialPaymentDetail = initialPaymentDetail.setAmount(zeroDisplayAmount)
    }

    setPaymentDetail(initialPaymentDetail)
  }, [
    setPaymentDetail,
    paymentDestination,
    _convertMoneyAmount,
    paymentDetail,
    defaultWallet,
    btcWallet,
    zeroDisplayAmount,
    isWalletListPending,
  ])

  const alertHighFees = shouldWarnAboutHighFee({
    paymentDetail,
    isSelfCustodial,
    selectedTierFee,
    hasFeeQuote,
  })

  /** Held rather than blanked: the seeding above waits for the region, so without this the
   *  user sits on an empty screen for as long as the country takes to resolve. */
  if (isWalletListPending) {
    return (
      <Screen>
        <View style={styles.walletListPendingContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            {...testProps("send-wallet-list-pending")}
          />
        </View>
      </Screen>
    )
  }

  if (!paymentDetail) {
    return <></>
  }

  const { sendingWalletDescriptor, convertMoneyAmount } = paymentDetail
  const lnurlParams =
    paymentDetail?.paymentType === "lnurl" ? paymentDetail?.lnurlParams : undefined

  const btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet?.balance)

  const usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet?.balance)

  const sendingWalletBalance =
    sendingWalletDescriptor.currency === WalletCurrency.Btc
      ? btcBalanceMoneyAmount
      : usdBalanceMoneyAmount

  const amountStatus = isValidAmount({
    paymentDetail,
    usdWalletAmount: usdBalanceMoneyAmount,
    btcWalletAmount: btcBalanceMoneyAmount,
    intraledgerLimits: intraledgerLimitsData?.me?.defaultAccount?.limits?.internalSend,
    withdrawalLimits: withdrawalLimitsData?.me?.defaultAccount?.limits?.withdrawal,
  })

  /**
   * The LNURL service's bounds, which the amount modal this screen replaced enforced before
   * it let an amount through. With the keypad in-screen they hold Next instead.
   */
  const lnurlBoundsErrorMessage = (() => {
    if (!lnurlParams || !paymentDetail.canSetAmount) return undefined
    const amount = paymentDetail.unitOfAccountAmount
    if (!amount.amount) return undefined
    const btcAmount = convertMoneyAmount(amount, WalletCurrency.Btc)
    if (lnurlParams.max) {
      const max = toBtcMoneyAmount(lnurlParams.max)
      if (greaterThan({ value: btcAmount, greaterThan: max })) {
        return LL.AmountInputScreen.maxAmountExceeded({
          maxAmount: formatMoneyAmount({ moneyAmount: max }),
        })
      }
    }
    if (lnurlParams.min) {
      const min = toBtcMoneyAmount(lnurlParams.min)
      if (lessThan({ value: btcAmount, lessThan: min })) {
        return LL.AmountInputScreen.minAmountNotMet({
          minAmount: formatMoneyAmount({ moneyAmount: min }),
        })
      }
    }
    return undefined
  })()

  const handleCopyToClipboard = () => {
    copyToClipboard({
      content: paymentDetail.destination,
      message: LL.SendBitcoinScreen.copiedDestination(),
    })
  }

  const otherWallet = wallets?.find(
    (wallet) => wallet.walletCurrency !== sendingWalletDescriptor.currency,
  )

  const switchWallet =
    otherWallet &&
    (() => {
      let updatedPaymentDetail = paymentDetail.setSendingWalletDescriptor({
        id: otherWallet.id,
        currency: otherWallet.walletCurrency,
      })

      // switch back to the display currency
      if (updatedPaymentDetail.canSetAmount) {
        const displayAmount = updatedPaymentDetail.convertMoneyAmount(
          paymentDetail.unitOfAccountAmount,
          DisplayCurrency,
        )
        updatedPaymentDetail = updatedPaymentDetail.setAmount(displayAmount)
        /** Typing in the old wallet's unit would enter an amount the new wallet isn't in. */
        if (amountPad.padCurrency !== DisplayCurrency) {
          amountPad.showAmount(displayAmount, DisplayCurrency)
        }
      }

      setSelectedPercent(null)
      setPaymentDetail(updatedPaymentDetail)
    })

  const selectPercent = (percent: number) => {
    const amount = {
      ...sendingWalletBalance,
      amount: Math.floor((sendingWalletBalance.amount * percent) / 100),
    }
    /** Where the rail can send the whole balance net of fees, 100% is that send-all rather
     *  than the balance as a plain amount, which the fee would push over. */
    const isSendAll = percent === 100 && Boolean(paymentDetail.canSendMax)

    setPaymentDetail((paymentDetail) =>
      paymentDetail?.setAmount
        ? paymentDetail.setAmount(amount, isSendAll)
        : paymentDetail,
    )
    amountPad.showAmount(amount)
    setSelectedPercent(percent)
  }

  const goToNextScreen =
    (paymentDetail.sendPaymentMutation ||
      (paymentDetail.paymentType === "lnurl" && paymentDetail.unitOfAccountAmount)) &&
    (async () => {
      let paymentDetailForConfirmation: PaymentDetail<WalletCurrency> = paymentDetail

      if (paymentDetail.paymentType === "lnurl" && !paymentDetail.sendPaymentMutation) {
        try {
          setIsLoadingLnurl(true)

          const btcAmount = paymentDetail.convertMoneyAmount(
            paymentDetail.unitOfAccountAmount,
            "BTC",
          )

          // Pay with the service params resolveLnurlDestination already vetted.
          // requestInvoice(lnUrlOrAddress) would resolve the destination a second
          // time and fetch whatever callback that response carries, which lnurl-pay
          // does not require to be https — so the callback the app checked would
          // not be the callback it pays.
          if (!lnurlParams) {
            setIsLoadingLnurl(false)
            setAsyncErrorMessage(LL.SendBitcoinScreen.failedToFetchLnurlInvoice())
            return
          }

          const requestInvoiceParams: {
            params: LnUrlPayServiceResponse
            tokens: Satoshis
            comment?: string
          } = {
            params: lnurlParams,
            tokens: utils.toSats(btcAmount.amount),
          }

          if (lnurlParams?.commentAllowed) {
            requestInvoiceParams.comment = paymentDetail.memo
          }

          const result = await requestInvoiceWithServiceParams(requestInvoiceParams)

          setPaymentDetail(paymentDetail.setSuccessAction(result.successAction))

          setIsLoadingLnurl(false)
          const invoice = result.invoice
          const decodedInvoice = decodeInvoiceString(invoice, network as NetworkLibGaloy)

          if (
            Math.round(Number(decodedInvoice.millisatoshis) / 1000) !== btcAmount.amount
          ) {
            setAsyncErrorMessage(LL.SendBitcoinScreen.lnurlInvoiceIncorrectAmount())
            return
          }

          paymentDetailForConfirmation = {
            ...paymentDetail.setInvoice({
              paymentRequest: invoice,
              paymentRequestAmount: btcAmount,
            }),
            successAction: result.successAction,
          }
        } catch (error) {
          setIsLoadingLnurl(false)
          reportError("send-bitcoin-details", error)
          setAsyncErrorMessage(LL.SendBitcoinScreen.failedToFetchLnurlInvoice())
          return
        }
      }

      if (paymentDetailForConfirmation.sendPaymentMutation) {
        if (alertHighFees) {
          setModalHighFeesVisible(true)
        } else {
          navigation.navigate("sendBitcoinConfirmation", {
            paymentDetail: paymentDetailForConfirmation,
          })
        }
      }
    })

  /**
   * Held while the quote is out, because the high-fee warning is judged by the fee the
   * selector quoted: leaving before it lands is leaving without the warning. The fee this
   * screen probed on mount used to stand in for it, which the picked tier's own fee replaced.
   */
  const isNextDisabled =
    !goToNextScreen ||
    !amountStatus.validAmount ||
    Boolean(lnurlBoundsErrorMessage) ||
    isFeeTierErrorBlocking ||
    isQuotingFees

  /**
   * The extra-info box shows one message, and an invalid amount is the one the sender can
   * act on. A fee error only takes the box once the amount is valid, or when it blocks the
   * send outright, since then there is nothing to continue to whatever the amount reads.
   */
  const shouldShowFeeTierError = amountStatus.validAmount || isFeeTierErrorBlocking
  const extraInfoErrorMessage =
    asyncErrorMessage ||
    lnurlBoundsErrorMessage ||
    (shouldShowFeeTierError ? feeTierErrorMessage : undefined)

  const walletCurrency = sendingWalletDescriptor.currency

  /** Keypad sends type in one currency and show the other beneath it; a fixed amount leads
   *  with the invoice's own denomination. */
  const primaryAmountText = paymentDetail.canSetAmount
    ? amountPad.hasTyped
      ? amountPad.typedAmountText
      : formatMoneyAmount({ moneyAmount: amountPad.padAmount })
    : formatMoneyAmount({ moneyAmount: paymentDetail.unitOfAccountAmount })

  const primaryCurrency = paymentDetail.canSetAmount
    ? amountPad.padCurrency
    : paymentDetail.unitOfAccountAmount.currency

  const secondaryAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: { ...paymentDetail.unitOfAccountAmount, currency: primaryCurrency },
    walletAmount: convertMoneyAmount(paymentDetail.unitOfAccountAmount, walletCurrency),
    displayAmount: convertMoneyAmount(paymentDetail.unitOfAccountAmount, DisplayCurrency),
  })

  const walletBalanceSecondary = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: sendingWalletBalance,
    walletAmount: sendingWalletBalance,
    displayAmount: convertMoneyAmount(sendingWalletBalance, DisplayCurrency),
  })

  const swapTypedCurrency = () =>
    amountPad.toggleCurrency(
      amountPad.padCurrency === DisplayCurrency ? walletCurrency : DisplayCurrency,
    )

  const hasAmount = paymentDetail.unitOfAccountAmount.amount > 0
  const isLowFunds =
    !amountStatus.validAmount &&
    amountStatus.invalidReason === AmountInvalidReason.InsufficientBalance

  /** The wallet card is outlined when the amount is what's wrong for this wallet: over its
   *  balance or limit, or outside the LNURL bounds. Fee and fetch errors leave it alone. */
  const isAmountError =
    Boolean(lnurlBoundsErrorMessage) ||
    (!amountStatus.validAmount &&
      (amountStatus.invalidReason === AmountInvalidReason.InsufficientBalance ||
        amountStatus.invalidReason === AmountInvalidReason.InsufficientLimit))

  const nextButtonTitle = (() => {
    if (paymentDetail.canSetAmount && !hasAmount) return LL.SendBitcoinScreen.addAmount()
    if (isLowFunds) return LL.SendBitcoinScreen.lowFunds()
    return LL.common.next()
  })()

  return (
    <Screen preset="fixed" keyboardOffset="navigationHeader">
      <ConfirmFeesModal
        action={() => {
          setModalHighFeesVisible(false)
          navigation.navigate("sendBitcoinConfirmation", { paymentDetail })
        }}
        isVisible={modalHighFeesVisible}
        cancel={() => setModalHighFeesVisible(false)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <SendAmountHeader
          destination={paymentDetail.destination}
          paymentType={paymentDetail.paymentType}
          primaryAmount={primaryAmountText}
          secondaryAmount={
            secondaryAmount && formatMoneyAmount({ moneyAmount: secondaryAmount })
          }
          primaryCurrency={primaryCurrency}
          onSwapCurrency={paymentDetail.canSetAmount ? swapTypedCurrency : undefined}
          onCopyDestination={handleCopyToClipboard}
        />
        <View style={styles.fields}>
          {/* The one error slot sits right above the wallet card it is usually about. */}
          <View style={styles.walletWithError}>
            <SendBitcoinDetailsExtraInfo
              errorMessage={extraInfoErrorMessage}
              amountStatus={amountStatus}
              currentLevel={currentLevel}
            />
            <SendWalletSummary
              currency={walletCurrency}
              balancePrimary={formatMoneyAmount({ moneyAmount: sendingWalletBalance })}
              balanceSecondary={
                walletBalanceSecondary &&
                formatMoneyAmount({
                  moneyAmount: walletBalanceSecondary,
                  isApproximate: true,
                })
              }
              hasError={isAmountError}
              onSwitch={switchWallet || undefined}
            />
          </View>
          {isOnchain && (
            <FeeTierSelector
              title={LL.SendBitcoinScreen.feeTier()}
              options={feeTierOptions}
              selected={feeTier}
              onSelect={handleFeeTierChange}
              loading={isQuotingFees}
            />
          )}
          <NoteInput
            onChangeText={(text) =>
              paymentDetail.setMemo && setPaymentDetail(paymentDetail.setMemo(text))
            }
            value={paymentDetail.memo || ""}
            editable={paymentDetail.canSetMemo}
            big={false}
            iconSize={16}
            fontSize={14}
          />
        </View>
      </ScrollView>
      <View style={styles.bottom}>
        {paymentDetail.canSetAmount && (
          <>
            <PercentageSelector
              isLocked={false}
              loadingPercent={null}
              selectedPercent={selectedPercent}
              onSelect={selectPercent}
              testIdPrefix="send"
            />
            <View style={styles.keyboard}>
              <CurrencyKeyboard
                onPress={amountPad.onKeyPress}
                disabledKeys={amountPad.disabledKeys}
                safeMode
              />
            </View>
          </>
        )}
        <GaloyPrimaryButton
          // Remounted per label: on Android an in-place change kept the width measured for the
          // previous label, so "Next" → "Add amount" was clipped to "Add".
          key={nextButtonTitle}
          onPress={goToNextScreen || undefined}
          loading={isLoadingLnurl}
          disabled={isNextDisabled}
          title={nextButtonTitle}
          {...testProps(LL.common.next())}
        />
      </View>
    </Screen>
  )
}

export default SendBitcoinDetailsScreen

const useStyles = makeStyles(() => ({
  walletListPendingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  /** Spacing follows the Figma frame: 14 between blocks, 20 at the sides, the hero flush
   *  with the header and the free space falling between it and the wallet card. */
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    rowGap: 14,
    paddingHorizontal: 20,
  },
  fields: {
    rowGap: 14,
  },
  walletWithError: {
    rowGap: 5,
  },
  bottom: {
    rowGap: 14,
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  keyboard: {
    marginVertical: 10,
  },
}))
