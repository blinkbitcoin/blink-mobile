import * as React from "react"
import { useEffect, useState } from "react"
import { Screen } from "../../components/screen"
import type { ScreenType } from "../../types/jsx"
import useToken from "../../utils/use-token"
import useMainQuery from "@app/hooks/use-main-query"
import { ActivityIndicator, Text, View, Alert, Button } from "react-native"

import { validPayment } from "../../utils/parsing"
import { getParams, LNURLPayParams, LNURLWithdrawParams } from "js-lnurl"

import { translate } from "../../i18n"

type RouteLnurlScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, "routeLnurl">
  route: RouteProp<RootStackParamList, "routeLnurl">
}

export const RouteLnurlScreen: ScreenType = ({route, navigation}): RouteLnurlScreenProps => {
  const { tokenNetwork } = useToken()
  const { myPubKey, username } = useMainQuery()
  const [ isLoading, setIsLoading ] = useState(false)

  useEffect(() => {
    const decodeInvoice = async (data) => {
      try {
        setIsLoading(true)
        const { valid, lnurl } = validPayment(data, tokenNetwork, myPubKey, username)
        if (valid && lnurl) {
          const lnurlParams = await getParams(lnurl)

          if ("reason" in lnurlParams) {
            throw lnurlParams.reason
          }

          switch (lnurlParams.tag) {
            case "payRequest":
              setIsLoading(false)
              navigation.navigate("sendBitcoin", {
                payment: data,
                lnurlParams: lnurlParams as LNURLPayParams,
              })
              break
            case "withdrawRequest":
              setIsLoading(false)
              navigation.navigate("receiveBitcoin", {
                payment: data,
                lnurlParams: lnurlParams as LNURLWithdrawParams,
              })
              break
            default:
              setIsLoading(false)
              navigation.navigate("Primary")
              Alert.alert(
                translate("ScanningQRCodeScreen.invalidTitle"),
                translate("ScanningQRCodeScreen.invalidContentLnurl", {
                  found: lnurlParams.tag,
                }),
                [
                  {
                    text: translate("common.ok"),
                  },
                ],
              )
              
              break
          }
        } else {
          setIsLoading(false)
          navigation.navigate("Primary")
          Alert.alert(
            translate("ScanningQRCodeScreen.invalidTitle"),
            translate("ScanningQRCodeScreen.invalidContent", { found: data.toString() }),
            [
              {
                text: translate("common.ok"),
              },
            ],
          )
         
        }
      } catch (err) {
        setIsLoading(false)
        navigation.navigate("Primary")
        Alert.alert(err.toString())
      }
    }
  
    const lnurl = route.params.lnurl
    decodeInvoice(lnurl)
  }, [route.params.lnurl])

  return (
    <Screen>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>
          {isLoading && 
            <ActivityIndicator animating size="large" />
          }
          {!isLoading &&
            <Button
              title={"Return Home"}
              onPress={() => { navigation.navigate("Primary") }}
            />
          }
        </Text>
      </View>
    </Screen>
  )
}
