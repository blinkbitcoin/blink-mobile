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

import { RouteProp } from "@react-navigation/native"
import { color } from "../../theme"

type LnurlParams = {
  tag: string
  minWithdrawable: number
  maxWithdrawable: number
  domain: string
  k1: string
  callback: string
  defaultDescription: string
  error: string
}

const styles = EStyleSheet.create({
  buttonContainer: { marginHorizontal: 52, paddingVertical: 200 },

  buttonStyle: {
    backgroundColor: palette.lightBlue,
    borderRadius: 32,
  },

  buttonStyleActive: {
    backgroundColor: palette.blue,
  },

  buttonStyleInactive: {
    backgroundColor: palette.midGrey,
  },

  receiveButtonStyle: {
    backgroundColor: color.primary,
    marginBottom: "32rem",
    marginHorizontal: "24rem",
    marginTop: "32rem",
  },

  buttonTitle: {
    fontWeight: "bold",
  },

  domainText: {
    fontSize: 20,
    marginLeft: "4%",
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
  route: RouteProp<MoveMoneyStackParamList, "receiveBitcoin">
}

export const ReceiveBitcoinScreen: ScreenType = ({ navigation, route }: Props) => {
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

  const [swiperIndex, setSwiperIndex] = useState<integer>(0)
  const swiperRef = React.createRef()

  const { btcWalletId } = useMainQuery()

  const [lnurlError, setLnurlError] = useState("")
  const [lnurlWithdraw, setLnurlWithdraw] = useState<LnurlParams>({
    tag: "",
    minWithdrawable: 0,
    maxWithdrawable: 0,
    k1: "",
    defaultDescription: "",
    callback: "",
    domain: "",
    error: "",
  })

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
    if (route.params?.lnurlParams) {
      const lnurlParams = setLnurlParams({
        params: route.params.lnurlParams as LnurlParams,
      })

      setLnurlWithdraw({ ...lnurlParams })

      if (lnurlParams.defaultDescription) {
        setMemo(lnurlParams.defaultDescription)
      }

      if (primaryAmount.currency === "USD") {
        toggleCurrency()
      }

      if (lnurlParams.minWithdrawable == lnurlParams.maxWithdrawable) {
        setTimeout(() => {
          setPrimaryAmountValue(lnurlParams.minWithdrawable)
        }, 100)
      }
    }
  }, [])

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

  useEffect(() => {
    let lnurlErrorStr = ""
    if (
      primaryAmount &&
      primaryAmount.currency === "BTC" &&
      primaryAmount.value > lnurlWithdraw.maxWithdrawable
    ) {
      lnurlErrorStr = translate("lnurl.overLimit")
    } else if (
      primaryAmount &&
      primaryAmount.currency === "BTC" &&
      primaryAmount.value < lnurlWithdraw.minWithdrawable
    ) {
      lnurlErrorStr = translate("lnurl.underLimit")
    } else if (
      secondaryAmount &&
      secondaryAmount.currency === "BTC" &&
      secondaryAmount.value > lnurlWithdraw.maxWithdrawable
    ) {
      lnurlErrorStr = translate("lnurl.overLimit")
    } else if (
      secondaryAmount &&
      secondaryAmount.currency === "BTC" &&
      secondaryAmount.value < lnurlWithdraw.minWithdrawable
    ) {
      lnurlErrorStr = translate("lnurl.underLimit")
    } else {
      lnurlErrorStr = ""
    }
    setLnurlError(lnurlErrorStr)
  }, [lnurlWithdraw, primaryAmount, secondaryAmount])

  const completeWithdraw = async () => {
    try {
      setLoading(true)

      const response = await fetch(
        `${lnurlWithdraw.callback}${
          lnurlWithdraw.callback.indexOf("?") > -1 ? "&" : "?"
        }k1=${lnurlWithdraw.k1}&pr=${invoice?.paymentRequest}`,
      )

      if (!response.ok) {
        setLnurlError(translate("errors.network.server"))
        return
      }

      const data = await response.json()

      if (data?.status != "OK") {
        setLnurlError(data.reason)
      }
    } catch (err) {
      setLnurlError(translate("errors.network.server"))
    }

    setLoading(false)
  }

  const setLnurlParams = ({ params }): LnurlParams => {
    return {
      tag: params.tag,
      minWithdrawable: params.minWithdrawable / 1000,
      maxWithdrawable: params.maxWithdrawable / 1000,
      domain: params.domain,
      callback: params.callback,
      k1: params.k1,
      defaultDescription: params.defaultDescription,
      error: "",
    }
  }

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
          {lnurlWithdraw.tag.length > 0 && (
            <View style={styles.errorContainer}>
              <Text>
                Min: {lnurlWithdraw.minWithdrawable} sats - Max:{" "}
                {lnurlWithdraw.maxWithdrawable} sats
              </Text>
            </View>
          )}
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
          {lnurlWithdraw.tag.length > 0 && (
            <View>
              <Text style={styles.domainText}>
                {translate("common.domain")}: {lnurlWithdraw.domain}
              </Text>
            </View>
          )}
        </View>
        {/* FIXME: fixed height */}

        {lnurlWithdraw.tag.length == 0 && (
          <View>
            <View style={{flex: 1, flexDirection:"row", alignItems: "center", justifyContent: "center", marginBottom: 5}}>
              <View style={{flex: 1}}>
                <Button
                  style={{paddingLeft: 10, paddingRight: 1}}
                  buttonStyle={(!swiperIndex ? styles.buttonStyleActive : styles.buttonStyleInactive)}
                  title={
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: "center" }}>
                      <Icon style={{color: "white"}} size={20} name="ios-flash" />
                      <Text style={{fontWeight: "bold", color: "white"}}>Lightning</Text>
                    </View>
                  }
                  titleStyle={styles.buttonTitle}
                  onPress={() => {
                    swiperRef.current.scrollTo(0)
                  }}
                />
              </View>
              <View style={{flex: 1}}>
                <Button
                  style={{paddingRight: 10, paddingLeft: 1}}
                  buttonStyle={(swiperIndex ? styles.buttonStyleActive : styles.buttonStyleInactive)}
                  buttonContainer={{flex: 1}}
                  title={
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: "center" }}>
                      <Icon style={{color: "white"}} size={20} name="logo-bitcoin" />
                      <Text style={{fontWeight: "bold", color: "white"}}>On-Chain</Text>
                    </View>
                  }
                  
                  onPress={() => {
                    swiperRef.current.scrollTo(1)
                  }}
                />
              </View>
            </View>
            <Swiper
              height={450}
              loop={false}
              ref={swiperRef}
              onIndexChanged={setSwiperIndex}
              index={btcAddressRequested ? 1 : 0}
              showsButtons={false}
              showDots={false}
              renderPagination={() => {
                // hide the paginator
              }}
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
                    title={translate("ReceiveBitcoinScreen.generateQr")}
                    onPress={onBtcAddressRequestClick}
                    titleStyle={styles.buttonTitle}
                  />
                </Text>
              )}
            </Swiper>
          </View>
        )}

        {lnurlWithdraw.tag.length > 0 && (
          <View>
            {!invoicePaid && (
              <Button
                buttonStyle={styles.receiveButtonStyle}
                title={
                  !primaryAmount.value
                    ? translate("common.amountRequired")
                    : lnurlError
                    ? lnurlError
                    : translate("common.receive")
                }
                onPress={completeWithdraw}
                disabled={!primaryAmount.value || !!lnurlError || invoicePaid || loading}
                titleStyle={styles.buttonTitle}
              />
            )}

            {invoicePaid && (
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
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  )
}
