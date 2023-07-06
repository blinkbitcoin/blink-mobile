import * as React from "react"
import { Screen } from "../../components/screen"
import type { ScreenType } from "../../types/jsx"
import useMainQuery from "@app/hooks/use-main-query"
import { ActivityIndicator, Text, View, Alert, Button } from "react-native"
import { WebView } from 'react-native-webview'
import { gql, useApolloClient, useMutation } from "@apollo/client"
import { useWalletBalance } from "../../hooks"
import { getOtcBaseUri } from "../../utils/network"
import { palette } from "../../theme/palette"


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
  const { username, phoneNumber, userPreferredLanguage, refetch } = useMainQuery()
  const { walletId: myDefaultWalletId, satBalance, loading } = useWalletBalance()

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
      const js = `
        window.dispatchEvent(new CustomEvent("toggleLoadingOn"));

        true;
      `;
      this.webview.injectJavaScript(js);

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
      handlePaymentError(err)
    }
  }

  const createInvoice = async(satAmount) => {
    console.log('create invoice', satAmount)
    try {
      const js = `
        window.dispatchEvent(new CustomEvent("toggleLoadingOn"));

        true;
      `;
      this.webview.injectJavaScript(js);

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
    const js = `
      window.dispatchEvent(new CustomEvent("toggleLoadingOff"));
      true;
    `;
    
    this.webview.injectJavaScript(js);

    if (status === "SUCCESS") {
      setTimeout(() => {
        const js = `
          window.dispatchEvent(new CustomEvent("submitOrder"));

          true;
        `;
        this.webview.injectJavaScript(js);
      }, 250)

    } else if (status === "PENDING") {
      console.log("pending...")
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

  const handlePaymentError = (error) => {
   Alert.alert(translate("errors.generic"))
  }

  const handleInvoiceReturn = (invoice, errors) => {    
    console.log(invoice, errors)
    const js = `
      window.dispatchEvent(new CustomEvent("toggleLoadingOff"));
      true;
    `;
    
    this.webview.injectJavaScript(js);

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

  return (
    <Screen>
      <View style={{flex: 1}}>
        <WebView
          ref={(ref) => (this.webview = ref)}
          source={{
            uri: `${getOtcBaseUri()}?key=E4WE5GgDr6g8HFyS4K4m5rdJ&fromBJ=true&phone=${encodeURIComponent(phoneNumber)}&username=${encodeURIComponent(username)}&lang=${userPreferredLanguage}`,
          }}
          onMessage={async (event) => {
            const data = JSON.parse(event.nativeEvent.data)

            switch(data.action) {
              case "invoice":
                const invoice = data.bolt11
                await payLightning(invoice)

                break;

              case "createInvoice":
                await createInvoice(data.satAmount)

                break;

              case "complete":
                Alert.alert("Order submitted successfully!")
                navigation.navigate("moveMoney")

                break;
            }

            
          }}
          injectedJavaScript={runFirst}
        />
      </View>
    </Screen>
  )
}
