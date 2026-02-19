import React, { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, View } from "react-native"

import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { ActionButton } from "@app/components/action-button"
import { AmountInputModal } from "@app/components/amount-input/amount-input-modal"
import { ContextualInfo } from "@app/components/contextual-info"
import { ModalNfc } from "@app/components/modal-nfc"
import { NoteInput } from "@app/components/note-input"
import { QRCarousel } from "@app/components/qr-carousel"
import { ReceiveAmountRow } from "@app/components/receive-amount-row"
import { Screen } from "@app/components/screen"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useNotificationPermission } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { NfcHeaderButton } from "./nfc-header-button"
import { QRView } from "./qr-view"
import { withMyLnUpdateSub } from "./my-ln-updates-sub"
import { Invoice, InvoiceType, PaymentRequestState } from "./payment/index.types"
import {
  useDisplayPaymentRequest,
  useNfcReceive,
  usePaymentRequest,
  useReceiveCarousel,
  useReceiveFlow,
} from "./hooks"

const AUTO_DISMISS_DELAY = 5000

const ReceiveScreen = () => {
  const requestState = usePaymentRequest()

  if (!requestState) return null

  return <ReceiveScreenContent requestState={requestState} />
}

type ReceiveScreenContentProps = {
  requestState: NonNullable<ReturnType<typeof usePaymentRequest>>
}

const ReceiveScreenContent: React.FC<ReceiveScreenContentProps> = ({ requestState }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  useNotificationPermission()

  const [isTrialModalVisible, setIsTrialModalVisible] = useState(false)
  const openTrialModal = useCallback(() => setIsTrialModalVisible(true), [])
  const closeTrialModal = useCallback(() => setIsTrialModalVisible(false), [])
  const reopenUpgradeModal = useRef(false)
  const markReopenUpgradeModal = useCallback(() => {
    reopenUpgradeModal.current = true
  }, [])

  const [isLightningModalVisible, setIsLightningModalVisible] = useState(false)
  const toggleLightningModal = useCallback(
    () => setIsLightningModalVisible((prev) => !prev),
    [],
  )

  const carousel = useReceiveCarousel(requestState, openTrialModal)

  const {
    handleSetAmount,
    handleMemoBlur,
    handleToggleWallet,
    handleCopy,
    handleShare,
    receiveViaNFC,
  } = useReceiveFlow(requestState, {
    isOnChainPage: carousel.isOnChainPage,
    onchainWalletCurrency: carousel.onchainWalletCurrency,
    syncOnchainWallet: carousel.syncOnchainWallet,
    onchainAddress: carousel.onchain.address,
  })

  const { displayPaymentRequest, showActions } = useDisplayPaymentRequest(
    requestState,
    carousel.isOnChainPage,
    carousel.onchain.address,
  )

  const {
    displayReceiveNfc,
    setDisplayReceiveNfc,
    isNfcAmountModalOpen,
    closeNfcAmountModal,
    handleNfcAmountSet,
    showNfcButton,
    onNfcPress,
  } = useNfcReceive({
    requestType: requestState.type,
    requestState: requestState.state,
    hasSettlementAmount: Boolean(requestState.settlementAmount),
    handleSetAmount,
    isOnChainPage: carousel.isOnChainPage,
  })

  const titleByInvoiceType: Record<InvoiceType, string> = {
    [Invoice.OnChain]: LL.ReceiveScreen.bitcoinOnchain(),
    [Invoice.Lightning]: LL.ReceiveScreen.lightningInvoice(),
    [Invoice.PayCode]: LL.ReceiveScreen.lightningAddress(),
  }
  const activeInvoiceType = carousel.isOnChainPage
    ? Invoice.OnChain
    : requestState.type ?? Invoice.Lightning
  const dynamicTitle = titleByInvoiceType[activeInvoiceType]

  useEffect(() => {
    navigation.setOptions({ title: dynamicTitle })
  }, [navigation, dynamicTitle])

  useFocusEffect(
    useCallback(() => {
      if (reopenUpgradeModal.current) {
        openTrialModal()
        reopenUpgradeModal.current = false
      }
    }, [openTrialModal]),
  )

  useEffect(() => {
    if (requestState.state !== PaymentRequestState.Paid) return
    const id = setTimeout(() => navigation.goBack(), AUTO_DISMISS_DELAY)
    return () => clearTimeout(id)
  }, [requestState.state, navigation])

  return (
    <Screen
      preset="scroll"
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
      style={styles.screenStyle}
      {...testProps("receive-screen")}
    >
      <QRCarousel
        ref={carousel.ref}
        page0={
          <QRView
            type={requestState.info?.data?.invoiceType || requestState.type}
            getFullUri={requestState.info?.data?.getFullUriFn}
            loading={requestState.state === PaymentRequestState.Loading}
            completed={requestState.state === PaymentRequestState.Paid}
            err={
              requestState.state === PaymentRequestState.Error
                ? LL.ReceiveScreen.error()
                : ""
            }
            expired={requestState.state === PaymentRequestState.Expired}
            regenerateInvoiceFn={requestState.regenerateInvoice}
            copyToClipboard={handleCopy}
            isPayCode={requestState.type === Invoice.PayCode}
            canUsePayCode={requestState.canUsePaycode}
            toggleIsSetLightningAddressModalVisible={toggleLightningModal}
          />
        }
        page1={
          <QRView
            type={Invoice.OnChain}
            getFullUri={carousel.onchain.getFullUriFn}
            loading={carousel.onchain.loading}
            completed={requestState.state === PaymentRequestState.Paid}
            err=""
            expired={false}
            regenerateInvoiceFn={requestState.regenerateInvoice}
            copyToClipboard={handleCopy}
            isPayCode={false}
            canUsePayCode={false}
            toggleIsSetLightningAddressModalVisible={toggleLightningModal}
          />
        }
        onSnap={carousel.handleSnap}
      />

      <Pressable
        style={styles.paymentIdentifier}
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityHint={
          carousel.isOnChainPage
            ? LL.ReceiveScreen.copyClipboardBitcoin()
            : LL.ReceiveScreen.copyClipboard()
        }
      >
        {carousel.isOnChainPage || requestState.type === Invoice.Lightning ? (
          <Text
            {...testProps("readable-payment-request")}
            style={styles.paymentIdentifierText}
          >
            {displayPaymentRequest}
          </Text>
        ) : (
          <Text
            {...testProps("readable-payment-request")}
            style={styles.paymentIdentifierText}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {displayPaymentRequest}
          </Text>
        )}
      </Pressable>

      <View style={styles.inputsContainer}>
        <ReceiveAmountRow
          unitOfAccountAmount={requestState.unitOfAccountAmount}
          walletCurrency={
            carousel.isOnChainPage
              ? carousel.onchainWalletCurrency
              : requestState.receivingWalletDescriptor.currency
          }
          convertMoneyAmount={requestState.convertMoneyAmount}
          setAmount={handleSetAmount}
          canSetAmount={requestState.canSetAmount}
          onToggleWallet={handleToggleWallet}
          canToggleWallet={true}
          disabled={
            carousel.isOnChainPage &&
            carousel.onchainWalletCurrency === WalletCurrency.Usd
          }
        />

        <NoteInput
          onBlur={handleMemoBlur}
          onChangeText={requestState.setMemoChangeText}
          value={requestState.memoChangeText || ""}
          editable={requestState.canSetMemo}
          big={false}
          iconSize={16}
          fontSize={14}
        />

        {showActions && (
          <View style={styles.actionsRow}>
            <ActionButton
              label={LL.ReceiveScreen.copyInvoice()}
              icon="copy-paste"
              onPress={handleCopy}
              accessibilityHint={
                carousel.isOnChainPage
                  ? LL.ReceiveScreen.copyClipboardBitcoin()
                  : LL.ReceiveScreen.copyClipboard()
              }
            />
            <ActionButton
              label={LL.ReceiveScreen.shareInvoice()}
              icon="share"
              onPress={handleShare}
              accessibilityHint={
                carousel.isOnChainPage
                  ? LL.common.shareBitcoin()
                  : LL.common.shareLightning()
              }
            />
          </View>
        )}

        <ContextualInfo
          type={carousel.isOnChainPage ? Invoice.OnChain : requestState.type}
          expirationTime={requestState.expirationTime ?? 0}
          setExpirationTime={requestState.setExpirationTime}
          walletCurrency={requestState.receivingWalletDescriptor.currency}
          canSetExpirationTime={requestState.canSetExpirationTime}
          feesInformation={requestState.feesInformation}
        />
      </View>

      <SetLightningAddressModal
        isVisible={isLightningModalVisible}
        toggleModal={toggleLightningModal}
      />

      <ModalNfc
        isActive={displayReceiveNfc}
        setIsActive={setDisplayReceiveNfc}
        settlementAmount={requestState.settlementAmount}
        receiveViaNFC={receiveViaNFC}
      />

      <AmountInputModal
        moneyAmount={requestState.unitOfAccountAmount}
        walletCurrency={requestState.receivingWalletDescriptor.currency}
        convertMoneyAmount={requestState.convertMoneyAmount}
        onSetAmount={handleNfcAmountSet}
        isOpen={isNfcAmountModalOpen}
        close={closeNfcAmountModal}
      />

      <NfcHeaderButton visible={showNfcButton} onPress={onNfcPress} />

      <TrialAccountLimitsModal
        isVisible={isTrialModalVisible}
        closeModal={closeTrialModal}
        beforeSubmit={markReopenUpgradeModal}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    paddingVertical: 12,
    flexGrow: 1,
  },
  paymentIdentifier: {
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 20,
  },
  paymentIdentifierText: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    columnGap: 10,
  },
  inputsContainer: {
    marginTop: 14,
    paddingHorizontal: 20,
    rowGap: 14,
  },
}))

export default withMyLnUpdateSub(ReceiveScreen)
