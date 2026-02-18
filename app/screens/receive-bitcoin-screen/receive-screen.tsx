import React, { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, Share, TouchableOpacity, View } from "react-native"
import nfcManager from "react-native-nfc-manager"
import { ICarouselInstance } from "react-native-reanimated-carousel"

import { useApolloClient } from "@apollo/client"
import Clipboard from "@react-native-clipboard/clipboard"
import messaging from "@react-native-firebase/messaging"
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { ActionButton } from "@app/components/action-button"
import { ContextualInfo } from "@app/components/contextual-info"
import { CustomIcon } from "@app/components/custom-icon"
import { ModalNfc } from "@app/components/modal-nfc"
import { NoteInput } from "@app/components/note-input"
import { QRCarousel } from "@app/components/qr-carousel"
import { ReceiveAmountRow } from "@app/components/receive-amount-row"
import { Screen } from "@app/components/screen"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  MoneyAmount,
  WalletOrDisplayCurrency,
  isNonZeroMoneyAmount,
} from "@app/types/amounts"
import { addDeviceToken, requestNotificationPermission } from "@app/utils/notifications"
import { testProps } from "@app/utils/testProps"
import { toastShow } from "@app/utils/toast"

import { QRView } from "./qr-view"
import { withMyLnUpdateSub } from "./my-ln-updates-sub"
import { useOnChainAddress } from "./use-onchain-address"
import { useReceiveBitcoin } from "./use-receive-bitcoin"
import { truncateMiddle } from "./payment/helpers"
import { Invoice, InvoiceType, PaymentRequestState } from "./payment/index.types"

enum CarouselPage {
  Lightning = 0,
  OnChain = 1,
}

const ReceiveScreen = () => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const client = useApolloClient()
  const reopenUpgradeModal = useRef(false)
  const carouselRef = useRef<ICarouselInstance>(null)
  const prevPaymentRequest = useRef("")

  const isAuthed = useIsAuthed()
  const isFocused = useIsFocused()
  const { currentLevel } = useLevel()
  const isLevelZero = currentLevel === AccountLevel.Zero

  const request = useReceiveBitcoin()

  const [onchainWalletCurrency, setOnchainWalletCurrency] = useState<WalletCurrency>(
    WalletCurrency.Btc,
  )
  const onchainWalletId =
    onchainWalletCurrency === WalletCurrency.Btc
      ? request?.btcWalletId
      : request?.usdWalletId
  const onchain = useOnChainAddress(onchainWalletId, {
    amount: request?.settlementAmount?.amount,
    memo: request?.memo || undefined,
  })

  const [isTrialAccountModalVisible, setIsTrialAccountModalVisible] = useState(false)
  const [displayReceiveNfc, setDisplayReceiveNfc] = useState(false)

  const closeTrialAccountModal = () => setIsTrialAccountModalVisible(false)
  const openTrialAccountModal = () => setIsTrialAccountModalVisible(true)

  const [activePage, setActivePage] = useState(CarouselPage.Lightning)
  const isOnChainPage = activePage === CarouselPage.OnChain

  const titleByInvoiceType: Record<InvoiceType, string> = {
    [Invoice.OnChain]: LL.ReceiveScreen.bitcoinOnchain(),
    [Invoice.Lightning]: LL.ReceiveScreen.lightningInvoice(),
    [Invoice.PayCode]: LL.ReceiveScreen.lightningAddress(),
  }

  const activeInvoiceType = isOnChainPage
    ? Invoice.OnChain
    : request?.type ?? Invoice.Lightning
  const dynamicTitle = titleByInvoiceType[activeInvoiceType]

  const isReady = Boolean(request) && request?.state !== PaymentRequestState.Loading

  const showActions = isOnChainPage
    ? Boolean(onchain.address)
    : Boolean(request) && (request?.type !== Invoice.PayCode || request?.canUsePaycode)

  const activePaymentRequest = isOnChainPage
    ? onchain.address
    : request?.readablePaymentRequest
  const displayPaymentRequest = activePaymentRequest || prevPaymentRequest.current

  const handleSetAmount = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
      if (!request) return
      request.setAmount(amount)
      if (isNonZeroMoneyAmount(amount) && request.type === Invoice.PayCode) {
        request.setType(Invoice.Lightning)
        return
      }
      if (
        !isNonZeroMoneyAmount(amount) &&
        request.type === Invoice.Lightning &&
        request.canUsePaycode &&
        !request.memoChangeText
      ) {
        request.setType(Invoice.PayCode)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [request?.setAmount, request?.type, request?.canUsePaycode, request?.memoChangeText],
  )

  const handleMemoBlur = useCallback(() => {
    if (!request) return
    request.setMemo()
    if (request.memoChangeText && request.type === Invoice.PayCode) {
      request.setType(Invoice.Lightning)
      return
    }
    if (
      !request.memoChangeText &&
      request.type === Invoice.Lightning &&
      request.canUsePaycode &&
      !isNonZeroMoneyAmount(request.unitOfAccountAmount)
    ) {
      request.setType(Invoice.PayCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    request?.setMemo,
    request?.memoChangeText,
    request?.type,
    request?.canUsePaycode,
    request?.unitOfAccountAmount,
  ])

  const handleCopy = useCallback(() => {
    if (isOnChainPage) {
      if (!onchain.address) return
      Clipboard.setString(onchain.address)
      toastShow({
        message: (translations) => translations.ReceiveScreen.copyClipboardBitcoin(),
        LL,
        type: "success",
      })
      return
    }
    request?.copyToClipboard?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnChainPage, onchain.address, LL, request?.copyToClipboard])

  const handleShare = useCallback(async () => {
    if (isOnChainPage) {
      if (!onchain.address) return
      await Share.share({ message: onchain.address }).catch(() => {})
      return
    }
    request?.share?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnChainPage, onchain.address, request?.share])

  const handleCarouselSnap = useCallback(
    (index: number) => {
      if (index === CarouselPage.OnChain && isLevelZero) {
        openTrialAccountModal()
        carouselRef.current?.scrollTo({ index: CarouselPage.Lightning, animated: true })
        return
      }
      setActivePage(index === 0 ? CarouselPage.Lightning : CarouselPage.OnChain)
    },
    [isLevelZero],
  )

  const handleToggleWallet = useCallback(() => {
    if (!isReady || !request) return

    if (isOnChainPage) {
      setOnchainWalletCurrency((prev) =>
        prev === WalletCurrency.Btc ? WalletCurrency.Usd : WalletCurrency.Btc,
      )
      return
    }

    if (request.type === Invoice.PayCode) {
      request.setType(Invoice.Lightning)
    }
    const next =
      request.receivingWalletDescriptor.currency === WalletCurrency.Btc
        ? WalletCurrency.Usd
        : WalletCurrency.Btc
    request.setReceivingWallet(next)
    request.setExpirationTime(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isReady,
    isOnChainPage,
    request?.type,
    request?.receivingWalletDescriptor.currency,
    request?.setType,
    request?.setReceivingWallet,
    request?.setExpirationTime,
  ])

  useEffect(() => {
    navigation.setOptions({ title: dynamicTitle })
  }, [navigation, dynamicTitle])

  useEffect(() => {
    if (activePaymentRequest) prevPaymentRequest.current = activePaymentRequest
  }, [activePaymentRequest])

  useEffect(() => {
    ;(async () => {
      if (
        request?.type === Invoice.Lightning &&
        request?.state === PaymentRequestState.Created &&
        (await nfcManager.isSupported())
      ) {
        navigation.setOptions({
          headerRight: () => (
            <TouchableOpacity
              style={styles.nfcIcon}
              onPress={() => setDisplayReceiveNfc(true)}
            >
              <CustomIcon name="nfc" color={colors.black} size={24} />
            </TouchableOpacity>
          ),
        })
      } else {
        navigation.setOptions({ headerRight: () => <></> })
      }
    })()
    // Disable exhaustive-deps because styles.nfcIcon was causing an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors.black, navigation, request?.state, request?.type])

  useFocusEffect(
    useCallback(() => {
      if (reopenUpgradeModal.current) {
        openTrialAccountModal()
        reopenUpgradeModal.current = false
      }
    }, []),
  )

  // notification permission
  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isAuthed && isFocused && client) {
      const WAIT_TIME_TO_PROMPT_USER = 5000
      timeout = setTimeout(async () => {
        const result = await requestNotificationPermission()
        if (
          result === messaging.AuthorizationStatus.PROVISIONAL ||
          result === messaging.AuthorizationStatus.AUTHORIZED
        ) {
          await addDeviceToken(client)
        }
      }, WAIT_TIME_TO_PROMPT_USER)
    }
    return () => timeout && clearTimeout(timeout)
  }, [isAuthed, isFocused, client])

  useEffect(() => {
    if (request?.state === PaymentRequestState.Paid) {
      const id = setTimeout(() => navigation.goBack(), 5000)
      return () => clearTimeout(id)
    }
  }, [request?.state, navigation])

  if (!request) return null

  return (
    <Screen
      preset="scroll"
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
      style={styles.screenStyle}
      {...testProps("receive-screen")}
    >
      <QRCarousel
        ref={carouselRef}
        page0={
          <QRView
            type={request.info?.data?.invoiceType || request.type}
            getFullUri={request.info?.data?.getFullUriFn}
            loading={request.state === PaymentRequestState.Loading}
            completed={request.state === PaymentRequestState.Paid}
            err={
              request.state === PaymentRequestState.Error ? LL.ReceiveScreen.error() : ""
            }
            expired={request.state === PaymentRequestState.Expired}
            regenerateInvoiceFn={request.regenerateInvoice}
            copyToClipboard={handleCopy}
            isPayCode={request.type === Invoice.PayCode}
            canUsePayCode={request.canUsePaycode}
            toggleIsSetLightningAddressModalVisible={
              request.toggleIsSetLightningAddressModalVisible
            }
          />
        }
        page1={
          <QRView
            type={Invoice.OnChain}
            getFullUri={onchain.getFullUriFn}
            loading={onchain.loading}
            completed={request.state === PaymentRequestState.Paid}
            err=""
            expired={false}
            regenerateInvoiceFn={request.regenerateInvoice}
            copyToClipboard={handleCopy}
            isPayCode={false}
            canUsePayCode={false}
            toggleIsSetLightningAddressModalVisible={
              request.toggleIsSetLightningAddressModalVisible
            }
          />
        }
        onSnap={handleCarouselSnap}
      />

      <Pressable
        style={styles.paymentIdentifier}
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityHint={
          isOnChainPage
            ? LL.ReceiveScreen.copyClipboardBitcoin()
            : LL.ReceiveScreen.copyClipboard()
        }
      >
        {isOnChainPage || request.type === Invoice.Lightning ? (
          <Text
            {...testProps("readable-payment-request")}
            style={styles.paymentIdentifierText}
          >
            {truncateMiddle(displayPaymentRequest)}
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

      {/* TODO: request.extraDetails (expiration countdown, paid/LNURL label) not yet wired into this UI */}
      <View style={styles.inputsContainer}>
        <ReceiveAmountRow
          unitOfAccountAmount={request.unitOfAccountAmount}
          walletCurrency={
            isOnChainPage
              ? onchainWalletCurrency
              : request.receivingWalletDescriptor.currency
          }
          convertMoneyAmount={request.convertMoneyAmount}
          setAmount={handleSetAmount}
          canSetAmount={request.canSetAmount}
          onToggleWallet={handleToggleWallet}
          canToggleWallet={isOnChainPage || request.canSetReceivingWalletDescriptor}
          disabled={isOnChainPage && onchainWalletCurrency === WalletCurrency.Usd}
        />

        <NoteInput
          onBlur={handleMemoBlur}
          onChangeText={request.setMemoChangeText}
          value={request.memoChangeText || ""}
          editable={request.canSetMemo}
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
                isOnChainPage
                  ? LL.ReceiveScreen.copyClipboardBitcoin()
                  : LL.ReceiveScreen.copyClipboard()
              }
            />
            <ActionButton
              label={LL.ReceiveScreen.shareInvoice()}
              icon="share"
              onPress={handleShare}
              accessibilityHint={
                isOnChainPage ? LL.common.shareBitcoin() : LL.common.shareLightning()
              }
            />
          </View>
        )}

        <ContextualInfo
          type={isOnChainPage ? Invoice.OnChain : request.type}
          expirationTime={request.expirationTime ?? 0}
          setExpirationTime={request.setExpirationTime}
          walletCurrency={request.receivingWalletDescriptor.currency}
          canSetExpirationTime={request.canSetExpirationTime}
          feesInformation={request.feesInformation}
        />
      </View>

      <SetLightningAddressModal
        isVisible={request.isSetLightningAddressModalVisible}
        toggleModal={request.toggleIsSetLightningAddressModalVisible}
      />

      <ModalNfc
        isActive={displayReceiveNfc}
        setIsActive={setDisplayReceiveNfc}
        settlementAmount={request.settlementAmount}
        receiveViaNFC={request.receiveViaNFC}
      />

      <TrialAccountLimitsModal
        isVisible={isTrialAccountModalVisible}
        closeModal={closeTrialAccountModal}
        beforeSubmit={() => {
          reopenUpgradeModal.current = true
        }}
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
  nfcIcon: {
    marginRight: 10,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
  },
}))

export default withMyLnUpdateSub(ReceiveScreen)
