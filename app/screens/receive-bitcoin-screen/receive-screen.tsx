import React, { useCallback, useEffect, useRef, useState } from "react"
import { TouchableOpacity, View } from "react-native"
import nfcManager from "react-native-nfc-manager"
import Icon from "react-native-vector-icons/Ionicons"

import { StackNavigationProp } from "@react-navigation/stack"
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import messaging from "@react-native-firebase/messaging"

import { useApolloClient } from "@apollo/client"
import { AmountInput } from "@app/components/amount-input"
import { ExpirationTimeChooser } from "@app/components/expiration-time-chooser"
import { GaloyCurrencyBubble } from "@app/components/atomic/galoy-currency-bubble"
import { ButtonGroup } from "@app/components/button-group"
import { CustomIcon } from "@app/components/custom-icon"
import { ModalNfc } from "@app/components/modal-nfc"
import { NoteInput } from "@app/components/note-input"
import { Screen } from "@app/components/screen"
import { useLevel, AccountLevel } from "@app/graphql/level-context"
import { TrialAccountLimitsModal } from "@app/components/upgrade-account-modal"
import { SetLightningAddressModal } from "@app/components/set-lightning-address-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { addDeviceToken, requestNotificationPermission } from "@app/utils/notifications"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { testProps } from "../../utils/testProps"
import { withMyLnUpdateSub } from "./my-ln-updates-sub"
import { Invoice, InvoiceType, PaymentRequestState } from "./payment/index.types"
import { QRView } from "./qr-view"
import { useReceiveBitcoin } from "./use-receive-bitcoin"

const ReceiveScreen = () => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const client = useApolloClient()
  const reopenUpgradeModal = useRef(false)

  const isAuthed = useIsAuthed()
  const isFocused = useIsFocused()
  const { currentLevel } = useLevel()
  const isLevelZero = currentLevel === AccountLevel.Zero

  const request = useReceiveBitcoin()

  const [isTrialAccountModalVisible, setIsTrialAccountModalVisible] = useState(false)
  const [displayReceiveNfc, setDisplayReceiveNfc] = useState(false)

  const closeTrialAccountModal = () => setIsTrialAccountModalVisible(false)
  const openTrialAccountModal = () => setIsTrialAccountModalVisible(true)

  const nfcText = LL.ReceiveScreen.nfc()
  useEffect(() => {
    ;(async () => {
      if (
        request?.type === "Lightning" &&
        request?.state === "Created" &&
        (await nfcManager.isSupported())
      ) {
        navigation.setOptions({
          headerRight: () => (
            <TouchableOpacity
              style={styles.nfcIcon}
              onPress={() => setDisplayReceiveNfc(true)}
            >
              <Text type="p2">{nfcText}</Text>
              <CustomIcon name="nfc" color={colors.black} />
            </TouchableOpacity>
          ),
        })
      } else {
        navigation.setOptions({ headerRight: () => <></> })
      }
    })()
    // Disable exhaustive-deps because styles.nfcIcon was causing an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nfcText, colors.black, navigation, request?.state, request?.type])

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
      timeout = setTimeout(
        async () => {
          const result = await requestNotificationPermission()
          if (
            result === messaging.AuthorizationStatus.PROVISIONAL ||
            result === messaging.AuthorizationStatus.AUTHORIZED
          ) {
            await addDeviceToken(client)
          }
        }, // no op if already requested
        WAIT_TIME_TO_PROMPT_USER,
      )
    }
    return () => timeout && clearTimeout(timeout)
  }, [isAuthed, isFocused, client])

  useEffect(() => {
    if (request?.state === PaymentRequestState.Paid) {
      const id = setTimeout(() => navigation.goBack(), 5000)
      return () => clearTimeout(id)
    }
  }, [request?.state, navigation])

  if (!request) return <></>

  const OnChainCharge =
    request.feesInformation?.deposit.minBankFee &&
    request.feesInformation?.deposit.minBankFeeThreshold &&
    request.type === Invoice.OnChain ? (
      <View style={styles.onchainCharges}>
        <Text type="p4">
          {LL.ReceiveScreen.fees({
            minBankFee: request.feesInformation?.deposit.minBankFee,
            minBankFeeThreshold: request.feesInformation?.deposit.minBankFeeThreshold,
          })}
        </Text>
      </View>
    ) : undefined

  const isReady = request.state !== PaymentRequestState.Loading

  const handlePressWallet = (id: string) => {
    if (isReady) {
      request.setReceivingWallet(id as WalletCurrency)
      request.setExpirationTime(0)
    }
  }
  return (
    <>
      <Screen
        preset="scroll"
        keyboardOffset="navigationHeader"
        keyboardShouldPersistTaps="handled"
        style={styles.screenStyle}
        {...testProps("receive-screen")}
      >
        <ButtonGroup
          selectedId={request.receivingWalletDescriptor.currency}
          buttons={[
            {
              id: WalletCurrency.Btc,
              text: "Bitcoin",
              icon: {
                selected: <GaloyCurrencyBubble currency="BTC" iconSize={16} />,
                normal: (
                  <GaloyCurrencyBubble currency="BTC" iconSize={16} highlighted={false} />
                ),
              },
            },
            {
              id: WalletCurrency.Usd,
              text: "Dollar",
              icon: {
                selected: <GaloyCurrencyBubble currency="USD" iconSize={16} />,
                normal: (
                  <GaloyCurrencyBubble currency="USD" iconSize={16} highlighted={false} />
                ),
              },
            },
          ]}
          onPress={handlePressWallet}
          style={styles.receivingWalletPicker}
          disabled={!request.canSetReceivingWalletDescriptor}
        />

        <QRView
          type={request.info?.data?.invoiceType || Invoice.OnChain}
          getFullUri={request.info?.data?.getFullUriFn}
          loading={request.state === PaymentRequestState.Loading}
          completed={request.state === PaymentRequestState.Paid}
          err={
            request.state === PaymentRequestState.Error ? LL.ReceiveScreen.error() : ""
          }
          style={styles.qrView}
          expired={request.state === PaymentRequestState.Expired}
          regenerateInvoiceFn={request.regenerateInvoice}
          copyToClipboard={request.copyToClipboard}
          isPayCode={request.type === Invoice.PayCode}
          canUsePayCode={request.canUsePaycode}
          toggleIsSetLightningAddressModalVisible={
            request.toggleIsSetLightningAddressModalVisible
          }
        />

        <View style={styles.invoiceActions}>
          {request.state !== PaymentRequestState.Loading &&
            (request.type !== Invoice.PayCode ||
              (request.type === Invoice.PayCode && request.canUsePaycode)) && (
              <>
                <View style={styles.copyInvoiceContainer}>
                  <TouchableOpacity
                    {...testProps(LL.ReceiveScreen.copyInvoice())}
                    onPress={request.copyToClipboard}
                  >
                    <Text {...testProps("Copy Invoice")} color={colors.grey2}>
                      <Icon color={colors.grey2} name="copy-outline" />
                      <Text> </Text>
                      {LL.ReceiveScreen.copyInvoice()}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View>
                  <Text color={colors.grey2}>{request.extraDetails || ""}</Text>
                </View>
                <View style={styles.shareInvoiceContainer}>
                  <TouchableOpacity
                    {...testProps(LL.ReceiveScreen.shareInvoice())}
                    onPress={request.share}
                  >
                    <Text {...testProps("Share Invoice")} color={colors.grey2}>
                      <Icon color={colors.grey2} name="share-outline" />
                      <Text> </Text>
                      {LL.ReceiveScreen.shareInvoice()}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
        </View>

        <TouchableOpacity style={styles.extraDetails} onPress={request.copyToClipboard}>
          {request.readablePaymentRequest ? (
            request.type === Invoice.OnChain ? (
              <View style={styles.btcHighContainer}>
                <Text ellipsizeMode="middle" numberOfLines={1}>
                  <Text style={styles.btcHigh}>
                    {request.readablePaymentRequest.slice(0, 6)}
                  </Text>
                  <Text style={styles.btcLow}>
                    {request.readablePaymentRequest.substring(
                      6,
                      request.readablePaymentRequest.length - 6,
                    )}
                  </Text>
                  <Text style={styles.btcHigh}>
                    {request.readablePaymentRequest.slice(-6)}
                  </Text>
                </Text>
              </View>
            ) : (
              <Text {...testProps("readable-payment-request")}>
                {request.readablePaymentRequest}
              </Text>
            )
          ) : (
            <></>
          )}
        </TouchableOpacity>

        <ButtonGroup
          selectedId={request.type}
          buttons={[
            {
              id: Invoice.Lightning,
              text: "Lightning",
              icon: "flash",
            },
            { id: Invoice.PayCode, text: "Paycode", icon: "at" },
            {
              id: Invoice.OnChain,
              text: "Onchain",
              icon: "logo-bitcoin",
              disabled: isLevelZero,
            },
          ]}
          onPress={(id) => {
            const isBlockedOnchain = id === Invoice.OnChain && isLevelZero

            if (isBlockedOnchain) {
              openTrialAccountModal()
              return
            }

            if (isReady) {
              request.setType(id as InvoiceType)
            }
          }}
          style={styles.invoiceTypePicker}
        />
        <AmountInput
          unitOfAccountAmount={request.unitOfAccountAmount}
          setAmount={request.setAmount}
          canSetAmount={request.canSetAmount}
          convertMoneyAmount={request.convertMoneyAmount}
          walletCurrency={request.receivingWalletDescriptor.currency}
          showValuesIfDisabled={false}
          big={false}
        />
        <NoteInput
          onBlur={request.setMemo}
          onChangeText={request.setMemoChangeText}
          value={request.memoChangeText || ""}
          editable={request.canSetMemo}
          style={styles.note}
          big={false}
        />
        <ExpirationTimeChooser
          expirationTime={request?.expirationTime ?? 0}
          setExpirationTime={request.setExpirationTime}
          walletCurrency={request.receivingWalletDescriptor.currency}
          disabled={!request.canSetExpirationTime}
          style={styles.note}
        />

        {OnChainCharge}

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
    </>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
    marginTop: 12,
  },
  usdActive: {
    backgroundColor: colors._green,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    width: 150,
    height: 30,
    margin: 5,
  },
  btcActive: {
    backgroundColor: colors.primary,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    width: 150,
    height: 30,
    margin: 5,
  },
  inactiveTab: {
    backgroundColor: colors.grey3,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    width: 150,
    height: 30,
    margin: 5,
  },
  qrView: {
    marginBottom: 10,
  },
  receivingWalletPicker: {
    marginBottom: 10,
  },
  invoiceTypePicker: {
    marginBottom: 10,
  },
  note: {
    marginTop: 10,
  },
  extraDetails: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    minHeight: 20,
  },
  invoiceActions: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    minHeight: 20,
  },
  copyInvoiceContainer: {
    flex: 2,
    marginLeft: 10,
  },
  shareInvoiceContainer: {
    flex: 2,
    alignItems: "flex-end",
    marginRight: 10,
  },
  onchainCharges: { marginTop: 10, alignItems: "center" },
  btcHighContainer: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
  },
  btcHigh: {
    fontWeight: "700",
  },
  btcLow: {},
  nfcIcon: {
    marginTop: -1,
    marginRight: 14,
    padding: 8,
    display: "flex",
    flexDirection: "row",
    columnGap: 4,
    backgroundColor: colors.grey5,
    borderRadius: 4,
  },
}))

export default withMyLnUpdateSub(ReceiveScreen)
