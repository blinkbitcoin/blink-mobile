import * as React from "react"
import { Alert, Pressable, View } from "react-native"
import Modal from "react-native-modal"
import NfcManager, { Ndef, NdefRecord, NfcTech } from "react-native-nfc-manager"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/Ionicons"

import { LNURL_DOMAINS } from "@app/config"
import {
  WalletCurrency,
  useAccountDefaultWalletLazyQuery,
  useScanningQrCodeScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { usePriceConversion } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { parseDestination } from "@app/screens/send-bitcoin-screen/payment-destination"
import {
  DestinationDirection,
  ReceiveDestination,
} from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { WalletAmount, toUsdMoneyAmount } from "@app/types/amounts"
import { logParseDestinationResult } from "@app/utils/analytics"
import { isIOS } from "@rn-vui/base"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloySecondaryButton } from "../atomic/galoy-secondary-button"

export const ModalNfc: React.FC<{
  isActive: boolean
  setIsActive: (arg: boolean) => void
  settlementAmount?: WalletAmount<WalletCurrency>
  receiveViaNFC: (destination: ReceiveDestination) => Promise<void>
}> = ({ isActive, setIsActive, settlementAmount, receiveViaNFC }) => {
  const { data } = useScanningQrCodeScreenQuery({ skip: !useIsAuthed() })
  const wallets = data?.me?.defaultAccount.wallets
  const bitcoinNetwork = data?.globals?.network

  const [accountDefaultWalletQuery] = useAccountDefaultWalletLazyQuery({
    fetchPolicy: "no-cache",
  })

  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  const dismiss = React.useCallback(() => {
    setIsActive(false)
    NfcManager.cancelTechnologyRequest()
  }, [setIsActive])

  const { convertMoneyAmount } = usePriceConversion()

  React.useEffect(() => {
    if (isActive && !settlementAmount) {
      Alert.alert(LL.ReceiveScreen.enterAmountFirst())
      setIsActive(false)
      return
    }

    if (!convertMoneyAmount) return

    if (
      isActive &&
      settlementAmount &&
      convertMoneyAmount &&
      convertMoneyAmount(toUsdMoneyAmount(settlementAmount?.amount), WalletCurrency.Btc)
        .amount === 0
    ) {
      Alert.alert(LL.ReceiveScreen.cantReceiveZeroSats())
      setIsActive(false)
      return
    }

    if (
      !LL ||
      !wallets ||
      !bitcoinNetwork ||
      !isActive ||
      !receiveViaNFC ||
      !settlementAmount
    ) {
      return
    }

    const init = async () => {
      let result: NdefRecord | undefined
      let lnurl: string

      try {
        const isSupported = await NfcManager.isSupported()

        // TODO: menu should only appear if this is a supported feature?
        if (!isSupported) {
          Alert.alert(LL.SettingsScreen.nfcNotSupported())
          dismiss()
          return
        }

        console.log("starting scanNFCTag")
        NfcManager.start()

        await NfcManager.requestTechnology(NfcTech.Ndef)

        const tag = await NfcManager.getTag()

        result = tag?.ndefMessage?.find((record) => {
          const payload = record.payload
          const payloadString = Ndef.text.decodePayload(new Uint8Array(payload))
          console.log("decodedPayloadString: " + payloadString)

          if (payloadString.toLowerCase().includes("lnurl")) {
            return record
          }

          return false
        })

        if (!result) {
          Alert.alert(LL.SettingsScreen.nfcNotCompatible())
          dismiss()
          return
        }

        lnurl = Ndef.text.decodePayload(new Uint8Array(result.payload))
      } catch (error) {
        if (!isIOS) {
          // TODO: error that show as an Alert or onscreen message
          // but only when it's not user initiated
          // currently error returned is empty
          Alert.alert(LL.SettingsScreen.nfcError())
        }

        console.error({ error }, `can't fetch the Ndef payload`)
        dismiss()
        return
      }

      // TODO: add a loading icon because this call do a fetch() to an external server
      // and the response can be arbitrary long

      const destination = await parseDestination({
        rawInput: lnurl,
        myWalletIds: wallets.map((wallet) => wallet.id),
        bitcoinNetwork,
        lnurlDomains: LNURL_DOMAINS,
        accountDefaultWalletQuery,
      })
      logParseDestinationResult(destination)

      if (destination.valid && settlementAmount && convertMoneyAmount) {
        if (destination.destinationDirection === DestinationDirection.Send) {
          Alert.alert(LL.SettingsScreen.nfcOnlyReceive())
        } else {
          let amount = settlementAmount.amount
          if (settlementAmount.currency === WalletCurrency.Usd) {
            amount = convertMoneyAmount(
              toUsdMoneyAmount(settlementAmount.amount),
              WalletCurrency.Btc,
            ).amount
          }

          destination.validDestination.minWithdrawable = amount * 1000 // coz msats
          destination.validDestination.maxWithdrawable = amount * 1000 // coz msats

          receiveViaNFC(destination)
        }
      }

      dismiss()
    }

    init()
    // Necessary because receiveViaNFC gets rerendered at useReceiveBitcoin
    // And rerendering that shouldn't cause this useEffect to retrigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    LL,
    wallets,
    bitcoinNetwork,
    accountDefaultWalletQuery,
    isActive,
    dismiss,
    settlementAmount,
    setIsActive,
    convertMoneyAmount,
  ])

  return (
    <Modal
      swipeDirection={["down"]}
      isVisible={isActive && !isIOS}
      onSwipeComplete={dismiss}
      onBackdropPress={dismiss}
      backdropOpacity={0.3}
      backdropColor={colors.grey3}
      swipeThreshold={50}
      propagateSwipe
      style={styles.modal}
    >
      <Pressable style={styles.flex} onPress={dismiss}></Pressable>
      <SafeAreaView style={styles.modalForeground}>
        <View style={styles.iconContainer}>
          <Icon name="remove" size={72} color={colors.grey3} style={styles.icon} />
        </View>
        <Text type="h1" bold style={styles.message}>
          {LL.SettingsScreen.nfcScanNow()}
        </Text>
        <View style={styles.scanIconContainer}>
          <Icon name="scan" size={140} color={colors.grey1} />
        </View>
        <View style={styles.buttonContainer}>
          <GaloySecondaryButton title={LL.common.cancel()} onPress={dismiss} />
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  flex: {
    maxHeight: "25%",
    flex: 1,
  },

  buttonContainer: {
    marginBottom: 32,
  },

  icon: {
    height: 40,
    top: -40,
  },

  iconContainer: {
    height: 14,
  },

  scanIconContainer: {
    height: 40,
    flex: 1,
  },

  message: {
    marginVertical: 8,
  },

  modal: {
    margin: 0,
    flex: 3,
  },

  modalForeground: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    flex: 1,
    backgroundColor: colors.white,
  },

  modalContent: {
    backgroundColor: "white",
  },
}))
