import { gql, useApolloClient, useMutation } from "@apollo/client"
import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
import { useCallback, useMemo, useEffect, useState } from "react"
import { Alert, Keyboard, Platform, ScrollView, TextInput, View } from "react-native"
import EStyleSheet from "react-native-extended-stylesheet"
import ScreenBrightness from "react-native-screen-brightness"
import Swiper from "react-native-swiper"
import Icon from "react-native-vector-icons/Ionicons"
import debounce from "lodash.debounce"

import { GaloyInput } from "../../components/galoy-input"
import { InputPayment } from "../../components/input-payment"
import { Screen } from "../../components/screen"
import { translate } from "../../i18n"
import { MoveMoneyStackParamList } from "../../navigation/stack-param-lists"
import { palette } from "../../theme/palette"
import { ScreenType } from "../../types/jsx"
import { isIos } from "../../utils/helper"
import QRView from "./qr-view"
import {
  useMoneyAmount,
  useMyCurrencies,
  usePrevious,
  useMySubscription,
} from "../../hooks"
import { TextCurrency } from "../../components/text-currency"
import useToken from "../../utils/use-token"
import { Button, Text } from "react-native-elements"
import { hasFullPermissions, requestPermission } from "../../utils/notifications"
import useMainQuery from "@app/hooks/use-main-query"

const styles = EStyleSheet.create({
  buttonContainer: { marginHorizontal: 52, paddingVertical: 200 },

  buttonStyle: {
    backgroundColor: palette.lightBlue,
    borderRadius: 32,
  },

  buttonTitle: {
    fontWeight: "bold",
  },

  screen: {
    // FIXME: doesn't work for some reason
    // justifyContent: "space-around"
  },
  section: {
    flex: 1,
    paddingHorizontal: 50,
  },

  subCurrencyText: {
    color: palette.midGrey,
    fontSize: "16rem",
    marginRight: "10%",
    marginTop: 0,
    paddingTop: 0,
    textAlign: "center",
    width: "90%",
  },
  textButtonWrapper: { alignSelf: "center", marginHorizontal: 52 },
  textStyle: {
    color: palette.darkGrey,
    fontSize: "18rem",
    textAlign: "center",
  },
})

const ADD_NO_AMOUNT_INVOICE = gql`
  mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {
    lnNoAmountInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        paymentRequest
        paymentHash
      }
    }
  }
`

const ADD_INVOICE = gql`
  mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {
    lnInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        paymentRequest
        paymentHash
      }
    }
  }
`

const GET_ONCHAIN_ADDRESS = gql`
  mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {
    onChainAddressCurrent(input: $input) {
      errors {
        message
      }
      address
    }
  }
`

type Props = {
  navigation: StackNavigationProp<MoveMoneyStackParamList, "receiveBitcoin">
}

export const ReceiveBitcoinScreen: ScreenType = ({ navigation }: Props) => {
  const client = useApolloClient()
  const { hasToken } = useToken()

  const { primaryCurrency, secondaryCurrency, toggleCurrency } = useMyCurrencies()

  const [primaryAmount, _, setPrimaryAmount, setPrimaryAmountValue] =
    useMoneyAmount(primaryCurrency)
  const prevPrimaryAmount: MoneyAmount = usePrevious(primaryAmount)

  const [secondaryAmount, convertSecondaryAmount, setSecondaryAmount] =
    useMoneyAmount(secondaryCurrency)

  const satAmount =
    primaryCurrency === "BTC" ? primaryAmount.value : secondaryAmount.value

  const [addNoAmountInvoice] = useMutation(ADD_NO_AMOUNT_INVOICE)
  const [addInvoice] = useMutation(ADD_INVOICE)
  const [getOnchainAddress] = useMutation(GET_ONCHAIN_ADDRESS)

  const [lastOnChainAddress, setLastOnChainAddress] = useState<string>()
  const [btcAddressRequested, setBtcAddressRequested] = useState<boolean>(false)

  const { btcWalletId } = useMainQuery()

  const onBtcAddressRequestClick = async () => {
    try {
      setLoading(true)
      const {
        data: {
          onChainAddressCurrent: { address },
        },
      } = await getOnchainAddress({
        variables: { input: { walletId: btcWalletId } },
      })
      setLastOnChainAddress(address)
      setBtcAddressRequested(true)
    } catch (err) {
      console.log(err)
      setLastOnChainAddress("issue with the QRcode")
    } finally {
      setLoading(false)
    }
  }

  const [memo, setMemo] = useState("")
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<{
    paymentHash: string
    paymentRequest: string
  } | null>(null)
  const [err, setErr] = useState("")
  const { lnUpdate } = useMySubscription()
  const [brightnessInitial, setBrightnessInitial] = useState(null)

  const updateInvoice = useMemo(
    () =>
      debounce(
        async ({ walletId, satAmount, memo }) => {
          setLoading(true)
          try {
            if (satAmount === 0) {
              const {
                data: {
                  lnNoAmountInvoiceCreate: { invoice, errors },
                },
              } = await addNoAmountInvoice({
                variables: { input: { walletId, memo } },
              })
              if (errors && errors.length !== 0) {
                console.error(errors, "error with lnNoAmountInvoiceCreate")
                setErr(translate("ReceiveBitcoinScreen.error"))
                return
              }
              setInvoice(invoice)
            } else {
              const {
                data: {
                  lnInvoiceCreate: { invoice, errors },
                },
              } = await addInvoice({
                variables: {
                  input: { walletId, amount: satAmount, memo },
                },
              })
              if (errors && errors.length !== 0) {
                console.error(errors, "error with lnInvoiceCreate")
                setErr(translate("ReceiveBitcoinScreen.error"))
                return
              }
              setInvoice(invoice)
            }
          } catch (err) {
            console.error(err, "error with AddInvoice")
            setErr(`${err}`)
            throw err
          } finally {
            setLoading(false)
          }
        },
        1000,
        { trailing: true },
      ),
    [addNoAmountInvoice, addInvoice],
  )

  useEffect(() => {
    if (primaryCurrency !== primaryAmount.currency) {
      const tempAmount = { ...secondaryAmount }
      setSecondaryAmount(primaryAmount)
      setPrimaryAmount(tempAmount)
    }
  }, [
    primaryAmount,
    primaryCurrency,
    secondaryAmount,
    setPrimaryAmount,
    setSecondaryAmount,
  ])

  useEffect((): void | (() => void) => {
    if (btcWalletId) {
      updateInvoice({ walletId: btcWalletId, satAmount, memo })
      return () => updateInvoice.cancel()
    }
  }, [satAmount, memo, updateInvoice, btcWalletId])

  useEffect(() => {
    const fn = async () => {
      // android required permission, and open the settings page for it
      // it's probably not worth the hurdle
      //
      // only doing the brightness for iOS for now
      //
      // only need     <uses-permission android:name="android.permission.WRITE_SETTINGS" tools:ignore="ProtectedPermissions"/>
      // in the manifest
      // see: https://github.com/robinpowered/react-native-screen-brightness/issues/38
      //
      if (!isIos) {
        return
      }

      // let hasPerm = await ScreenBrightness.hasPermission();

      // if(!hasPerm){
      //   ScreenBrightness.requestPermission();
      // }

      // only enter this loop when brightnessInitial is not set
      // if (!brightnessInitial && hasPerm) {
      if (!brightnessInitial) {
        ScreenBrightness.getBrightness().then((brightness: number) => {
          setBrightnessInitial(brightness)
          ScreenBrightness.setBrightness(1) // between 0 and 1
        })
      }
    }

    fn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () =>
      brightnessInitial
        ? () => ScreenBrightness.setBrightness(brightnessInitial)
        : () => null,
    [brightnessInitial],
  )

  useEffect(() => {
    const notifRequest = async () => {
      const waitUntilAuthorizationWindow = 5000

      if (Platform.OS === "ios") {
        if (await hasFullPermissions()) {
          return
        }

        setTimeout(
          () =>
            Alert.alert(
              translate("common.notification"),
              translate("ReceiveBitcoinScreen.activateNotifications"),
              [
                {
                  text: translate("common.later"),
                  // todo: add analytics
                  onPress: () => console.log("Cancel/Later Pressed"),
                  style: "cancel",
                },
                {
                  text: translate("common.ok"),
                  onPress: () => hasToken && requestPermission(client),
                },
              ],
              { cancelable: true },
            ),
          waitUntilAuthorizationWindow,
        )
      }
    }
    notifRequest()
  }, [client, hasToken])

  useEffect(() => {
    if (
      primaryAmount.currency === "USD" &&
      primaryAmount?.value === prevPrimaryAmount?.value
    ) {
      // USD/BTC price has changed so don't update
      // TODO come up with a better way of updating the lightning invoice when price changes.
      return
    }
    convertSecondaryAmount(primaryAmount)
  }, [primaryAmount, prevPrimaryAmount?.value, convertSecondaryAmount])

  const inputMemoRef = React.useRef<TextInput>()

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidHide", _keyboardDidHide)
    return () => subscription.remove()
  })

  const _keyboardDidHide = useCallback(() => {
    inputMemoRef?.current?.blur()
  }, [inputMemoRef])

  const invoicePaid =
    lnUpdate?.paymentHash === invoice?.paymentHash && lnUpdate?.status === "PAID"

  return (
    <Screen backgroundColor={palette.lighterGrey} style={styles.screen} preset="fixed">
      <ScrollView keyboardShouldPersistTaps="always">
        <View style={styles.section}>
          <InputPayment
            editable={!invoicePaid}
            forceKeyboard={false}
            toggleCurrency={toggleCurrency}
            onUpdateAmount={setPrimaryAmountValue}
            primaryAmount={primaryAmount}
            secondaryAmount={secondaryAmount}
            sub
          />
          <TextCurrency
            amount={secondaryAmount.value}
            currency={secondaryAmount.currency}
            style={styles.subCurrencyText}
          />
          <GaloyInput
            placeholder={translate("ReceiveBitcoinScreen.setNote")}
            value={memo}
            onChangeText={setMemo}
            // eslint-disable-next-line react-native/no-inline-styles
            containerStyle={{ marginTop: 0 }}
            inputStyle={styles.textStyle}
            leftIcon={
              <Icon name="ios-create-outline" size={21} color={palette.darkGrey} />
            }
            ref={inputMemoRef}
            disabled={invoicePaid}
          />
        </View>
        {/* FIXME: fixed height */}

        <Swiper
          height={450}
          loop={false}
          index={btcAddressRequested ? 1 : 0}
          showsButtons={true}
        >
          <QRView
            data={invoice?.paymentRequest}
            type="lightning"
            amount={satAmount}
            memo={memo}
            loading={loading}
            completed={invoicePaid}
            navigation={navigation}
            err={err}
          />
          {btcAddressRequested && lastOnChainAddress && (
            <QRView
              data={lastOnChainAddress}
              type="bitcoin"
              amount={satAmount}
              memo={memo}
              loading={loading}
              completed={invoicePaid}
              navigation={navigation}
              err={err}
            />
          )}
          {!btcAddressRequested && !lastOnChainAddress && (
            <Text style={styles.textButtonWrapper}>
              <Button
                buttonStyle={styles.buttonStyle}
                containerStyle={styles.buttonContainer}
                title={"Generate BTC Address"}
                onPress={onBtcAddressRequestClick}
                titleStyle={styles.buttonTitle}
              />
            </Text>
          )}
        </Swiper>
      </ScrollView>
    </Screen>
  )
}
