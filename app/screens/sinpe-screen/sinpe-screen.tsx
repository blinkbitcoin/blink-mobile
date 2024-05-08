import * as React from "react"
import { useState, useEffect } from "react"
import SendSMS from 'react-native-sms'
// import { SendDirectSms } from 'react-native-send-direct-sms'
import { Screen } from "../../components/screen"
import type { ScreenType } from "../../types/jsx"
import useMainQuery from "@app/hooks/use-main-query"
import { ActivityIndicator, Text, View, Alert, Button, Platform, BackHandler } from "react-native"
import { WebView } from 'react-native-webview'
import { gql, useApolloClient, useMutation } from "@apollo/client"
import { useWalletBalance } from "../../hooks"
import { getOtcBaseUri } from "../../utils/network"
import { palette } from "../../theme/palette"
import { validPayment } from "../../utils/parsing"
import useToken from "../../utils/use-token"
import { useMySubscription } from "../../hooks/user-hooks"
// import analytics from "@react-native-firebase/analytics"

import { translate } from "../../i18n"

export const LN_PAY = gql`
  mutation lnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
    lnInvoicePaymentSend(input: $input) {
      errors {
        message
      }
      status
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

type SinpeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, "sinpe">
  route: RouteProp<RootStackParamList, "sinpe">
}

export const SinpeScreen: ScreenType = ({route, navigation}): SinpeScreenProps => {
  let webview = null
  const { myPubKey, username, phoneNumber, userPreferredLanguage, refetch } = useMainQuery()
  const { walletId: myDefaultWalletId, satBalance, loading } = useWalletBalance()
  const { tokenNetwork } = useToken()
  const { formatCurrencyAmount } = useMySubscription()
  const [mySatBalance, setMySatBalance] = useState(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const otcBaseUri = getOtcBaseUri()

  const handleBackButtonPress = () => {
    try {
      if(canGoBack) {
        this.webview.goBack()
        return true
      }
    } catch (err) {
      console.log("[handleBackButtonPress] Error : ", err.message)
    }

    return false
  }

  const sendMessage = (data) => {
    console.log('sendMessage', data)
    if(false && Platform.OS === 'android') {
      // SendDirectSms(data.to, decodeURIComponent(data.message))
      // .then((res) => {
      //   if(res && res === 'SMS sent') {
      //     const js = `
      //       window.dispatchEvent(new CustomEvent("smsSent"));

      //       true;
      //     `;
      //     this.webview.injectJavaScript(js);
      //   }
      // })
      // .catch((err) => console.log("catch", err))
    } else {
      console.log('manual send')
      SendSMS.send({
        body: data.message,
        recipients: [data.to],
        allowAndroidSendWithoutReadPermission: true,
        successTypes: ['all'],
      }, (completed, cancelled, error) => {
        console.log(completed,cancelled,error)

        if(completed) {
          const js = `
            window.dispatchEvent(new CustomEvent("smsSent"));

            true;
          `;
          this.webview.injectJavaScript(js);
        }
      })
    }
  }

  useState(() => {
    setMySatBalance(satBalance)
  }, [])

  const runFirst = `
    true;
  `;

  const [lnPay] = useMutation(LN_PAY, {
    onCompleted: () => refetch(),
  })

  const [addInvoice] = useMutation(ADD_INVOICE, {
    onCompleted: () => refetch(),
  })

  const payLightning = async (bolt11) => {
    try {
      const { amount } = validPayment(bolt11, tokenNetwork, myPubKey, username)

      if (amount > satBalance) {
        Alert.alert('Error!', translate("SendBitcoinConfirmationScreen.totalExceedWithAmount", {
          balance: formatCurrencyAmount({ sats: satBalance, currency: "USD" }),
          amount: formatCurrencyAmount({sats: amount, currency: "USD"}),
        }))
        return
      }

      const { data, errors } = await lnPay({
        variables: {
          input: {
            walletId: myDefaultWalletId,
            paymentRequest: bolt11,
            memo: 'SINPE',
          },
        },
      })

      const status = data.lnInvoicePaymentSend.status
      const errs = errors
        ? errors.map((error) => {
            return { message: error.message }
          })
        : data.lnInvoicePaymentSend.errors
      handlePaymentReturn(status, errs)
    } catch (err) {
      console.log('error', err)
      handlePaymentError(err)
    }
  }

  const createInvoice = async(satAmount) => {
    console.log('create invoice', satAmount)
    try {
      const { data, errors } = await addInvoice({
        variables: {
          input: { 
            walletId: myDefaultWalletId,
            amount: satAmount, 
            memo: `SINPE to BTC (${satAmount} sats)`
          },
        },
      })

      console.log(data, errors)

      const errs = errors
        ? errors.map((error) => {
            return { message: error.message }
          })
        : data.lnInvoiceCreate.errors
      handleInvoiceReturn(data.lnInvoiceCreate.invoice.paymentRequest, errs)
    } catch(err) {
      handleInvoiceError(err)
    }
  }

  const handlePaymentReturn = (status, errors) => {    
    if (status === "SUCCESS" || status === "PENDING" || status === "ALREADY_PAID") {
     
    } else {
      let errorMessage = ''
      if (errors && Array.isArray(errors)) {
        errorMessage = errors.map((error) => error.message).join(", ")
      } else {
        errorMessage = translate("errors.generic")
      }

      Alert.alert("Error!", errorMessage)
    }
  }

  const handleInvoiceReturn = (invoice, errors) => {    
    console.log(invoice, errors)
    if (!errors || !errors.length) {
      setTimeout(() => {
        const js = `
          window.dispatchEvent(new CustomEvent("invoiceCreated", {detail: { bolt11: "${invoice}"}}));

          true;
        `;
        this.webview.injectJavaScript(js);
      }, 250)

    } else {
      let errorMessage = ''
      if (errors && Array.isArray(errors)) {
        errorMessage = errors.map((error) => error.message).join(", ")
      } else {
        errorMessage = translate("errors.generic")
      }

      Alert.alert("Error!", errorMessage)
    }
  }

  const handleInvoiceError = (error) => {
   Alert.alert(translate("errors.generic"))
  }

  const confirmLightning = async (amount) => {
    Alert.alert(
      translate("SendBitcoinConfirmationScreen.confirmPayment"),
      translate(
        "SendBitcoinConfirmationScreen.areYouSure", 
        {
          satAmount: formatCurrencyAmount({sats: Number(amount * 100000000), currency: "BTC"}),
          fiatAmount: formatCurrencyAmount({sats: amount * 100000000, currency: "USD"}),
        }
      ), 
      [
        {
          text: translate("common.cancel"),
          onPress: () => console.log('canceled'),
          style: 'cancel',
        },
        {
          text: translate("common.ok"),
          onPress: async () => {
            setTimeout(() => {
              const js = `
                window.dispatchEvent(new CustomEvent("userConfirmed"));

                true;
              `;
              this.webview.injectJavaScript(js);
            }, 250)
          }
        },
      ]
    );
  }

  useEffect(() => {
    if(Platform.OS === 'android') {
      BackHandler.addEventListener("hardwareBackPress", handleBackButtonPress)
      return () => {
        BackHandler.removeEventListener("hardwareBackPress", handleBackButtonPress)
      }
    }
  }, [canGoBack])

  return (
    <Screen>
      <View style={{flex: 1}}>
        {mySatBalance !== null &&
          <WebView
            ref={(ref) => (this.webview = ref)}
            source={{
              uri: `${otcBaseUri.url}?key=E4WE5GgDr6g8HFyS4K4m5rdJ&fromBJ=true&phone=${encodeURIComponent(phoneNumber)}&username=${encodeURIComponent(username)}&lang=${userPreferredLanguage}&satBalance=${mySatBalance}`,
              headers: {
                'x-bj-wallet': "true",
              },
            }}
            onMessage={async (event) => {
              const data = JSON.parse(event.nativeEvent.data)

              switch(data.action) {
                case "confirm":
                  await confirmLightning(data.amount)

                  break;

                case "invoice":
                  const invoice = data.bolt11
                  await payLightning(invoice)

                  break;

                case "createInvoice":
                  await createInvoice(data.satAmount)

                  break;

                case "complete":
                  Alert.alert(data.title, data.subtext)
                  // analytics().logScreenView({
                  //   screen_name: "sinpeConfirmationScreen",
                  //   screen_class: "sinpeConfirmationScreen",
                  // })
                  navigation.navigate("moveMoney")

                  break;

                case "sendSms":
                  sendMessage(data)
                  break;
              }
            }}
            allowsBackForwardNavigationGestures={true}
            injectedJavaScript={runFirst}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack)
            }}
            sharedCookiesEnabled={true}
            basicAuthCredential={{
              username: otcBaseUri.username,
              password: otcBaseUri.password
            }}   
          />
        }
      </View>
    </Screen>
  )
}
