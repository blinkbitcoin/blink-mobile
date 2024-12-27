import * as React from "react"
import { Alert, Text, TextStyle } from "react-native"
import { Divider, Icon, ListItem } from "react-native-elements"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import { readNfcTag, writeNfcTag } from "../../utils/nfc"
import { validPayment } from "../../utils/parsing"
import { getParams, LNURLPayParams, LNURLWithdrawParams } from "js-lnurl"
import useToken from "../../utils/use-token"
import useMainQuery from "@app/hooks/use-main-query"
import { GALOY_PAY_DOMAIN } from "../../constants/support"
import { getLnurlPayEncodedString } from "../../utils/bech32"
import { Screen } from "../../components/screen"

type AdvancedFeaturesScreenProps = {
  navigation: any
}

type FeatureRow = {
  id: string
  icon: string
  category: string
  action: () => void
  enabled?: boolean
  greyed?: boolean
  hidden?: boolean
  styleDivider?: any
}

export const AdvancedFeaturesScreen: React.FC<AdvancedFeaturesScreenProps> = ({ navigation }) => {
  const { tokenNetwork } = useToken()
  const { myPubKey, username } = useMainQuery()
  const { hasToken } = useToken()

  const writeNfcTagAction = async () => {
    if (!username) {
      Alert.alert(translate("common.error"), translate("SettingsScreen.lnurlNoUsername"))
      return
    }

    const lnurlEncodedString = getLnurlPayEncodedString(username)
    const nfcTagWriteResult = await writeNfcTag(
      'lightning:' + lnurlEncodedString,
      GALOY_PAY_DOMAIN + username,
    )

    if (nfcTagWriteResult.success) {
      Alert.alert(translate("common.success"), translate("nfc.writeSuccess"), [
        {
          text: translate("common.ok"),
        },
      ])
    } else if (nfcTagWriteResult.errorMessage != "UserCancel") {
      Alert.alert(
        translate("common.error"),
        translate(`nfc.${nfcTagWriteResult.errorMessage}`),
        [
          {
            text: translate("common.ok"),
          },
        ],
      )
    }
  }

  const handleScanNfc = async () => {
    try {
      const nfcTagReadResult = await readNfcTag()

      if (nfcTagReadResult.success) {
        await decodeInvoice(nfcTagReadResult.data)
      } else if (nfcTagReadResult.errorMessage !== "UserCancel") {
        Alert.alert(
          translate("common.error"),
          translate(`nfc.${nfcTagReadResult.errorMessage}`),
          [
            {
              text: translate("common.ok"),
            },
          ],
        )
      }
    } catch (err) {
      Alert.alert(translate("common.error"), err.toString())
    }
  }

  const decodeInvoice = async (data) => {
    try {
      const { valid, lnurl } = validPayment(data, tokenNetwork, myPubKey, username)
      if (valid && lnurl) {
        const lnurlParams = await getParams(lnurl)

        if ("reason" in lnurlParams) {
          throw lnurlParams.reason
        }

        switch (lnurlParams.tag) {
          case "payRequest":
            navigation.navigate("sendBitcoin", {
              payment: data,
              lnurlParams: lnurlParams as LNURLPayParams,
            })
            break
          case "withdrawRequest":
            navigation.navigate("receiveBitcoin", {
              payment: data,
              lnurlParams: lnurlParams as LNURLWithdrawParams,
            })
            break
          default:
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
      Alert.alert(err.toString())
    }
  }

  const featureList: FeatureRow[] = [
    {
      category: translate("AdvancedFeaturesScreen.scanNfcTag"),
      icon: "scan-outline",
      id: "scan-nfc",
      action: handleScanNfc,
      enabled: true,
      greyed: false,
    },
    {
      category: translate("SettingsScreen.programNfcTag"),
      icon: "pencil",
      id: "program-nfc",
      action: writeNfcTagAction,
      enabled: true,
      greyed: false,
    },
  ]

  return (
    <Screen preset="scroll">
      {featureList.map((feature, i) => {
        if (feature.hidden) {
          return null
        }
        const featureColor = feature.greyed ? palette.midGrey : palette.darkGrey
        const featureStyle: TextStyle = { color: featureColor }
        return (
          <React.Fragment key={`feature-option-${i}`}>
            <ListItem onPress={feature.action} disabled={!feature.enabled}>
              <Icon name={feature.icon} type="ionicon" color={featureColor} />
              <ListItem.Content>
                <ListItem.Title style={featureStyle}>
                  <Text>{feature.category}</Text>
                </ListItem.Title>
              </ListItem.Content>
              {feature.enabled && <ListItem.Chevron />}
            </ListItem>
            <Divider style={feature.styleDivider} />
          </React.Fragment>
        )
      })}
    </Screen>
  )
} 