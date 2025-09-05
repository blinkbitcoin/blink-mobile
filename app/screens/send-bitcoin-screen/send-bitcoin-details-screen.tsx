import { requestInvoice, utils, Satoshis } from "lnurl-pay"
import React, { useEffect, useState } from "react"
import { TouchableOpacity, TouchableWithoutFeedback, View } from "react-native"
import ReactNativeModal from "react-native-modal"
import Icon from "react-native-vector-icons/Ionicons"

import { gql } from "@apollo/client"
import { AmountInput } from "@app/components/amount-input/amount-input"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { NoteInput } from "@app/components/note-input"
import { PaymentDestinationDisplay } from "@app/components/payment-destination-display"
import { Screen } from "@app/components/screen"
import {
  Network,
  PayoutSpeed,
  usePayoutSpeedsQuery,
  useOnChainTxFeeLazyQuery,
  useSendBitcoinDetailsScreenQuery,
  useSendBitcoinInternalLimitsQuery,
  useSendBitcoinWithdrawalLimitsQuery,
  Wallet,
  WalletCurrency,
} from "@app/graphql/generated"
import { useHideAmount } from "@app/graphql/hide-amount-context"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { getBtcWallet, getDefaultWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { usePriceConversion } from "@app/hooks"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  PayoutSpeedSelector,
  PayoutSpeedModal,
  PayoutSpeedOption,
} from "@app/components/payout-speed"
import {
  DisplayCurrency,
  MoneyAmount,
  toBtcMoneyAmount,
  toUsdMoneyAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"
import { toastShow } from "@app/utils/toast"
import {
  decodeInvoiceString,
  Network as NetworkLibGaloy,
  PaymentType,
} from "@blinkbitcoin/blink-client"
import Clipboard from "@react-native-clipboard/clipboard"
import crashlytics from "@react-native-firebase/crashlytics"
import { NavigationProp, RouteProp, useNavigation } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"
import { ConfirmFeesModal } from "./confirm-fees-modal"
import { isValidAmount } from "./payment-details"
import { PaymentDetail } from "./payment-details/index.types"
import { SendBitcoinDetailsExtraInfo } from "./send-bitcoin-details-extra-info"
import { useOnChainPayoutQueueFeeEstimates } from "./use-fee"

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

  query payoutSpeeds {
    payoutSpeeds {
      speed
      displayName
      description
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

  const { hideAmount } = useHideAmount()

  const { data } = useSendBitcoinDetailsScreenQuery({
    fetchPolicy: "cache-first",
    returnPartialData: true,
    skip: !useIsAuthed(),
  })

  const { formatDisplayAndWalletAmount } = useDisplayCurrency()
  const { LL } = useI18nContext()
  const [isLoadingLnurl, setIsLoadingLnurl] = useState(false)
  const [modalHighFeesVisible, setModalHighFeesVisible] = useState(false)

  const { convertMoneyAmount: _convertMoneyAmount } = usePriceConversion()
  const { zeroDisplayAmount } = useDisplayCurrency()

  const defaultWallet = getDefaultWallet(
    data?.me?.defaultAccount?.wallets,
    data?.me?.defaultAccount?.defaultWalletId,
  )

  const btcWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const network = data?.globals?.network

  const wallets = data?.me?.defaultAccount?.wallets
  const { paymentDestination } = route.params

  const [paymentDetail, setPaymentDetail] =
    useState<PaymentDetail<WalletCurrency> | null>(null)

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

  const isOnchain = paymentDetail?.paymentType === PaymentType.Onchain
  const { data: payoutSpeedsData, loading: payoutSpeedsLoading } = usePayoutSpeedsQuery({
    skip: !isOnchain,
  })

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [asyncErrorMessage, setAsyncErrorMessage] = useState("")

  const [isPayoutSpeedModalVisible, setIsPayoutSpeedModalVisible] = useState(false)
  const [selectedPayoutSpeedOption, setSelectedPayoutSpeedOption] = useState<
    PayoutSpeedOption | undefined
  >()

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
    if (paymentDetail || !defaultWallet || !_convertMoneyAmount) {
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
  ])

  useEffect(() => {
    if (!isOnchain || selectedPayoutSpeedOption || !payoutSpeedsData?.payoutSpeeds) {
      return
    }

    const priority = payoutSpeedsData.payoutSpeeds.find(
      ({ speed }) => speed === PayoutSpeed.Fast,
    )
    if (!priority) return

    const option: PayoutSpeedOption = {
      speed: priority.speed,
      displayName: priority.displayName,
      description: priority.description,
    }
    setSelectedPayoutSpeedOption(option)
    setPayoutSpeed(priority.speed)
  }, [isOnchain, payoutSpeedsData, selectedPayoutSpeedOption])

  const alertHighFees = useOnchainFeeAlert({
    paymentDetail,
    walletId: btcWallet?.id as string,
    network,
    speed: selectedPayoutSpeedOption?.speed,
  })

  const availableSet = new Set((payoutSpeedsData?.payoutSpeeds ?? []).map((p) => p.speed))
  const skipFast = !availableSet.has(PayoutSpeed.Fast)
  const skipMedium = !availableSet.has(PayoutSpeed.Medium)
  const skipSlow = !availableSet.has(PayoutSpeed.Slow)

  const destinationStr = paymentDetail?.destination as string | undefined
  const estimateAddress =
    destinationStr && destinationStr.length > 10
      ? destinationStr
      : fallbackOnchainAddress(network)

  const feeEstimates = useOnChainPayoutQueueFeeEstimates({
    walletId: paymentDetail?.sendingWalletDescriptor?.id,
    address: estimateAddress,
    amount: paymentDetail?.settlementAmount?.amount,
    currency: paymentDetail?.sendingWalletDescriptor?.currency as
      | WalletCurrency
      | undefined,
    skipFast,
    skipMedium,
    skipSlow,
  })

  if (!paymentDetail) {
    return <></>
  }

  const { sendingWalletDescriptor, convertMoneyAmount } = paymentDetail
  const lnurlParams =
    paymentDetail?.paymentType === "lnurl" ? paymentDetail?.lnurlParams : undefined

  const btcBalanceMoneyAmount = toBtcMoneyAmount(btcWallet?.balance)

  const usdBalanceMoneyAmount = toUsdMoneyAmount(usdWallet?.balance)

  const btcWalletText = formatDisplayAndWalletAmount({
    displayAmount: convertMoneyAmount(btcBalanceMoneyAmount, DisplayCurrency),
    walletAmount: btcBalanceMoneyAmount,
  })

  const usdWalletText = formatDisplayAndWalletAmount({
    displayAmount: convertMoneyAmount(usdBalanceMoneyAmount, DisplayCurrency),
    walletAmount: usdBalanceMoneyAmount,
  })

  const amountStatus = isValidAmount({
    paymentDetail,
    usdWalletAmount: usdBalanceMoneyAmount,
    btcWalletAmount: btcBalanceMoneyAmount,
    intraledgerLimits: intraledgerLimitsData?.me?.defaultAccount?.limits?.internalSend,
    withdrawalLimits: withdrawalLimitsData?.me?.defaultAccount?.limits?.withdrawal,
  })

  const toggleModal = () => {
    setIsModalVisible(!isModalVisible)
  }

  const copyToClipboard = () => {
    Clipboard.setString(paymentDetail.destination)
    toastShow({
      type: "success",
      message: LL.SendBitcoinScreen.copiedDestination(),
      LL,
    })
  }

  const chooseWallet = (wallet: Pick<Wallet, "id" | "walletCurrency">) => {
    let updatedPaymentDetail = paymentDetail.setSendingWalletDescriptor({
      id: wallet.id,
      currency: wallet.walletCurrency,
    })

    // switch back to the display currency
    if (updatedPaymentDetail.canSetAmount) {
      const displayAmount = updatedPaymentDetail.convertMoneyAmount(
        paymentDetail.unitOfAccountAmount,
        DisplayCurrency,
      )
      updatedPaymentDetail = updatedPaymentDetail.setAmount(displayAmount)
    }

    setPaymentDetail(updatedPaymentDetail)
    toggleModal()
  }

  const transactionType = () => {
    if (paymentDetail?.paymentType === "intraledger") return LL.common.intraledger()
    if (paymentDetail?.paymentType === "onchain") return LL.common.onchain()
    if (paymentDetail?.paymentType === "lightning") return LL.common.lightning()
    if (paymentDetail?.paymentType === "lnurl") return LL.common.lightning()
  }

  const ChooseWalletModal = wallets && (
    <ReactNativeModal
      style={styles.modal}
      animationIn="fadeInDown"
      animationOut="fadeOutUp"
      isVisible={isModalVisible}
      onBackButtonPress={toggleModal}
      onBackdropPress={toggleModal}
    >
      <View>
        {wallets.map((wallet) => {
          return (
            <TouchableWithoutFeedback
              key={wallet.id}
              {...testProps(wallet.walletCurrency)}
              onPress={() => {
                chooseWallet(wallet)
              }}
            >
              <View style={styles.walletContainer}>
                <View style={styles.walletSelectorTypeContainer}>
                  <View
                    style={
                      wallet.walletCurrency === WalletCurrency.Btc
                        ? styles.walletSelectorTypeLabelBitcoin
                        : styles.walletSelectorTypeLabelUsd
                    }
                  >
                    {wallet.walletCurrency === WalletCurrency.Btc ? (
                      <Text style={styles.walletSelectorTypeLabelBtcText}>BTC</Text>
                    ) : (
                      <Text style={styles.walletSelectorTypeLabelUsdText}>USD</Text>
                    )}
                  </View>
                </View>
                <View style={styles.walletSelectorInfoContainer}>
                  <View style={styles.walletSelectorTypeTextContainer}>
                    {wallet.walletCurrency === WalletCurrency.Btc ? (
                      <Text
                        style={styles.walletCurrencyText}
                      >{`${LL.common.btcAccount()}`}</Text>
                    ) : (
                      <Text
                        style={styles.walletCurrencyText}
                      >{`${LL.common.usdAccount()}`}</Text>
                    )}
                  </View>
                  <View style={styles.walletSelectorBalanceContainer}>
                    {wallet.walletCurrency === WalletCurrency.Btc ? (
                      <Text>{btcWalletText}</Text>
                    ) : (
                      <Text>{usdWalletText}</Text>
                    )}
                  </View>
                  <View />
                </View>
              </View>
            </TouchableWithoutFeedback>
          )
        })}
      </View>
    </ReactNativeModal>
  )

  const goToNextScreen =
    (paymentDetail.sendPaymentMutation ||
      (paymentDetail.paymentType === "lnurl" && paymentDetail.unitOfAccountAmount)) &&
    (async () => {
      let paymentDetailForConfirmation: PaymentDetail<WalletCurrency> = paymentDetail

      if (paymentDetail.paymentType === "lnurl") {
        try {
          setIsLoadingLnurl(true)

          const btcAmount = paymentDetail.convertMoneyAmount(
            paymentDetail.unitOfAccountAmount,
            "BTC",
          )

          const requestInvoiceParams: {
            lnUrlOrAddress: string
            tokens: Satoshis
            comment?: string
          } = {
            lnUrlOrAddress: paymentDetail.destination,
            tokens: utils.toSats(btcAmount.amount),
          }

          if (lnurlParams?.commentAllowed) {
            requestInvoiceParams.comment = paymentDetail.memo
          }

          const result = await requestInvoice(requestInvoiceParams)

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
          if (error instanceof Error) {
            crashlytics().recordError(error)
          }
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
            payoutSpeedLabel: selectedPayoutSpeedOption?.displayName,
            payoutEstimateLabel: selectedPayoutSpeedOption?.description,
          })
        }
      }
    })

  const setAmount = (moneyAmount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setPaymentDetail((paymentDetail) =>
      paymentDetail?.setAmount ? paymentDetail.setAmount(moneyAmount) : paymentDetail,
    )
  }

  const setPayoutSpeed = (payoutSpeed: PayoutSpeed) => {
    setPaymentDetail((paymentDetail) =>
      paymentDetail?.setPayoutSpeed
        ? paymentDetail.setPayoutSpeed(payoutSpeed)
        : paymentDetail,
    )
  }

  const sendAll = () => {
    let moneyAmount: MoneyAmount<WalletCurrency>

    if (paymentDetail.sendingWalletDescriptor.currency === WalletCurrency.Btc) {
      moneyAmount = {
        amount: btcWallet?.balance ?? 0,
        currency: WalletCurrency.Btc,
        currencyCode: "BTC",
      }
    } else {
      moneyAmount = {
        amount: usdWallet?.balance ?? 0,
        currency: WalletCurrency.Usd,
        currencyCode: "USD",
      }
    }

    setPaymentDetail((paymentDetail) =>
      paymentDetail?.setAmount
        ? paymentDetail.setAmount(moneyAmount, true)
        : paymentDetail,
    )
  }

  const speeds = [PayoutSpeed.Fast, PayoutSpeed.Medium, PayoutSpeed.Slow] as const
  const estimateLabelBySpeed = speeds.reduce<Partial<Record<PayoutSpeed, string>>>(
    (result, speed) => {
      const amount = feeEstimates.estimates?.[speed]
      if (!amount) return result

      const walletAmount =
        sendingWalletDescriptor.currency === WalletCurrency.Btc
          ? {
              amount,
              currency: WalletCurrency.Btc,
              currencyCode: WalletCurrency.Btc,
            }
          : {
              amount,
              currency: WalletCurrency.Usd,
              currencyCode: WalletCurrency.Usd,
            }

      const displayAmount = paymentDetail.convertMoneyAmount(
        walletAmount,
        DisplayCurrency,
      )
      result[speed] = formatDisplayAndWalletAmount({ displayAmount, walletAmount })
      return result
    },
    {},
  )

  const selectedLabel =
    selectedPayoutSpeedOption?.displayName || LL.SendBitcoinScreen.selectFee()

  const selectedEstimate =
    selectedPayoutSpeedOption?.speed &&
    estimateLabelBySpeed[selectedPayoutSpeedOption.speed]
      ? estimateLabelBySpeed[selectedPayoutSpeedOption.speed]
      : undefined

  const feeErrorMessage =
    feeEstimates.status === "error" ? feeEstimates.errorMessage : undefined

  return (
    <Screen
      preset="scroll"
      style={styles.screenStyle}
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
    >
      <ConfirmFeesModal
        action={() => {
          setModalHighFeesVisible(false)
          navigation.navigate("sendBitcoinConfirmation", {
            paymentDetail,
            payoutSpeedLabel: selectedPayoutSpeedOption?.displayName,
            payoutEstimateLabel: selectedPayoutSpeedOption?.description,
          })
        }}
        isVisible={modalHighFeesVisible}
        cancel={() => setModalHighFeesVisible(false)}
      />
      <PayoutSpeedModal
        isVisible={isPayoutSpeedModalVisible}
        toggleModal={() => setIsPayoutSpeedModalVisible(false)}
        options={
          payoutSpeedsData?.payoutSpeeds.map(({ speed, displayName, description }) => ({
            speed,
            displayName,
            description,
          })) ?? []
        }
        estimatedFeeBySpeed={estimateLabelBySpeed}
        selectedSpeed={selectedPayoutSpeedOption?.speed}
        onSelect={(selected) => {
          setPayoutSpeed(selected.speed)
          setSelectedPayoutSpeedOption(selected)
          setIsPayoutSpeedModalVisible(false)
        }}
      />

      <View style={styles.sendBitcoinAmountContainer}>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>
            {LL.SendBitcoinScreen.destination()} - {transactionType()}
          </Text>
          <View style={styles.destinationFieldContainer}>
            <View style={styles.disabledFieldBackground}>
              <PaymentDestinationDisplay
                destination={paymentDetail.destination}
                paymentType={paymentDetail.paymentType}
              />
            </View>
            <TouchableOpacity
              style={styles.iconContainer}
              onPress={copyToClipboard}
              hitSlop={30}
            >
              <GaloyIcon name={"copy-paste"} size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.common.from()}</Text>
          <TouchableWithoutFeedback
            {...testProps("choose-wallet-to-send-from")}
            onPress={toggleModal}
            accessible={false}
          >
            <View style={styles.fieldBackground}>
              <View style={styles.walletSelectorTypeContainer}>
                <View
                  style={
                    sendingWalletDescriptor.currency === WalletCurrency.Btc
                      ? styles.walletSelectorTypeLabelBitcoin
                      : styles.walletSelectorTypeLabelUsd
                  }
                >
                  {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (
                    <Text style={styles.walletSelectorTypeLabelBtcText}>BTC</Text>
                  ) : (
                    <Text style={styles.walletSelectorTypeLabelUsdText}>USD</Text>
                  )}
                </View>
              </View>
              <View style={styles.walletSelectorInfoContainer}>
                <View style={styles.walletSelectorTypeTextContainer}>
                  {sendingWalletDescriptor.currency === WalletCurrency.Btc ? (
                    <>
                      <Text style={styles.walletCurrencyText}>
                        {LL.common.btcAccount()}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.walletCurrencyText}>
                        {LL.common.usdAccount()}
                      </Text>
                    </>
                  )}
                </View>
                <View style={styles.walletSelectorBalanceContainer}>
                  <Text
                    {...testProps(`${sendingWalletDescriptor.currency} Wallet Balance`)}
                  >
                    {hideAmount
                      ? "****"
                      : sendingWalletDescriptor.currency === WalletCurrency.Btc
                        ? btcWalletText
                        : usdWalletText}
                  </Text>
                </View>
              </View>

              <View style={styles.pickWalletIcon}>
                <Icon name={"chevron-down"} size={24} color={colors.black} />
              </View>
            </View>
          </TouchableWithoutFeedback>
          {ChooseWalletModal}
        </View>
        <View style={styles.fieldContainer}>
          <View style={styles.amountRightMaxField}>
            <Text {...testProps(LL.SendBitcoinScreen.amount())} style={styles.amountText}>
              {LL.SendBitcoinScreen.amount()}
            </Text>
            {paymentDetail.canSendMax && !paymentDetail.isSendingMax && (
              <GaloyTertiaryButton
                clear
                title={LL.SendBitcoinScreen.maxAmount()}
                onPress={sendAll}
              />
            )}
          </View>
          <View style={styles.currencyInputContainer}>
            <AmountInput
              unitOfAccountAmount={paymentDetail.unitOfAccountAmount}
              setAmount={setAmount}
              convertMoneyAmount={paymentDetail.convertMoneyAmount}
              walletCurrency={sendingWalletDescriptor.currency}
              canSetAmount={paymentDetail.canSetAmount}
              isSendingMax={paymentDetail.isSendingMax}
              maxAmount={lnurlParams?.max ? toBtcMoneyAmount(lnurlParams.max) : undefined}
              minAmount={lnurlParams?.min ? toBtcMoneyAmount(lnurlParams.min) : undefined}
            />
          </View>
        </View>
        {isOnchain && (
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldTitleText}>
              {LL.SendBitcoinScreen.feeSettings()}
            </Text>
            <PayoutSpeedSelector
              label={selectedLabel}
              estimate={selectedEstimate}
              loading={payoutSpeedsLoading || feeEstimates.status === "loading"}
              readOnly={feeEstimates.status === "error"}
              onPress={() => setIsPayoutSpeedModalVisible(true)}
            />
          </View>
        )}
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldTitleText}>{LL.SendBitcoinScreen.note()}</Text>
          <NoteInput
            onChangeText={(text) =>
              paymentDetail.setMemo && setPaymentDetail(paymentDetail.setMemo(text))
            }
            value={paymentDetail.memo || ""}
            editable={paymentDetail.canSetMemo}
          />
        </View>
        <SendBitcoinDetailsExtraInfo
          errorMessage={asyncErrorMessage || feeErrorMessage}
          amountStatus={amountStatus}
          currentLevel={currentLevel}
        />
        <View style={styles.buttonContainer}>
          <GaloyPrimaryButton
            onPress={goToNextScreen || undefined}
            loading={isLoadingLnurl || feeEstimates.status === "loading"}
            disabled={
              !goToNextScreen ||
              !amountStatus.validAmount ||
              (isOnchain &&
                (!selectedPayoutSpeedOption || feeEstimates.status === "error"))
            }
            title={LL.common.next()}
          />
        </View>
      </View>
    </Screen>
  )
}

export default SendBitcoinDetailsScreen

const useStyles = makeStyles(({ colors }) => ({
  sendBitcoinAmountContainer: {
    flex: 1,
  },
  fieldBackground: {
    flexDirection: "row",
    borderStyle: "solid",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    padding: 14,
    minHeight: 60,
  },
  destinationFieldContainer: {
    flexDirection: "row",
    borderStyle: "solid",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    borderRadius: 10,
    alignItems: "center",
    padding: 14,
    minHeight: 60,
  },
  disabledFieldBackground: {
    flex: 1,
    opacity: 0.5,
    flexDirection: "row",
    alignItems: "center",
  },
  walletContainer: {
    flexDirection: "row",
    borderStyle: "solid",
    overflow: "hidden",
    backgroundColor: colors.grey5,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 10,
    minHeight: 60,
  },
  walletSelectorTypeContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    width: 50,
    marginRight: 20,
  },
  walletSelectorTypeLabelBitcoin: {
    height: 30,
    width: 50,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  walletSelectorTypeLabelUsd: {
    height: 30,
    width: 50,
    backgroundColor: colors._green,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  walletSelectorTypeLabelUsdText: {
    fontWeight: "bold",
    color: colors.black,
  },
  walletSelectorTypeLabelBtcText: {
    fontWeight: "bold",
    color: colors.white,
  },
  walletSelectorInfoContainer: {
    flex: 1,
    flexDirection: "column",
  },
  walletCurrencyText: {
    fontWeight: "bold",
    fontSize: 18,
  },
  walletSelectorTypeTextContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  walletSelectorBalanceContainer: {
    flex: 1,
    flexDirection: "row",
  },
  fieldTitleText: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  currencyInputContainer: {
    flexDirection: "column",
  },
  switchCurrencyIconContainer: {
    width: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modal: {
    marginBottom: "90%",
  },
  pickWalletIcon: {
    marginRight: 12,
  },
  screenStyle: {
    padding: 20,
    flexGrow: 1,
  },
  amountText: {
    fontWeight: "bold",
  },
  amountRightMaxField: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 20,
  },
}))

const fallbackOnchainAddress = (network?: Network) =>
  network === "mainnet"
    ? "bc1qk2cpytjea36ry6vga8wwr7297sl3tdkzwzy2cw"
    : "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"

const useOnchainFeeAlert = ({
  paymentDetail,
  walletId,
  network,
  speed = PayoutSpeed.Fast,
}: {
  paymentDetail: PaymentDetail<WalletCurrency> | null
  walletId: string
  network?: Network
  speed?: PayoutSpeed
}) => {
  const dummyAddress = fallbackOnchainAddress(network)

  const isOnchainPayment =
    walletId && paymentDetail && paymentDetail.paymentType === "onchain"

  // we need to have an approximate value for the onchain fees
  // by the time the user tap on the next button
  // so we are fetching some fees when the screen loads
  // the fees are approximate but that doesn't matter for the use case
  // of warning the user if the fees are high compared to the amount sent

  // TODO: check if the BTC wallet is empty, and only USD wallet is used, if the query works
  const [getOnChainTxFee] = useOnChainTxFeeLazyQuery({
    fetchPolicy: "cache-and-network",
    variables: {
      walletId,
      amount: 1000,
      address: dummyAddress,
      speed,
    },
  })

  const [onChainTxFee, setOnChainTxFee] = useState(0)

  useEffect(() => {
    if (isOnchainPayment) {
      ;(async () => {
        const result = await getOnChainTxFee()
        const fees = result.data?.onChainTxFee.amount

        if (fees) {
          setOnChainTxFee(fees)
        } else {
          console.error("failed to get onchain fees")
        }
      })()
    }
  }, [getOnChainTxFee, isOnchainPayment])

  if (!isOnchainPayment) {
    return false
  }

  const { convertMoneyAmount } = paymentDetail

  // alert will shows if amount is less than fees * ratioFeesToAmount
  const ratioFeesToAmount = 2
  const ratioedFees = toBtcMoneyAmount(onChainTxFee * ratioFeesToAmount)

  const alertHighFees =
    paymentDetail.paymentType === "onchain" &&
    convertMoneyAmount(paymentDetail.settlementAmount, WalletCurrency.Btc).amount <
      ratioedFees.amount

  return alertHighFees
}
