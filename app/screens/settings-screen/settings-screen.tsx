import * as React from "react"
import { Alert, Text, TextStyle } from "react-native"
import Share from "react-native-share"
import { Divider, Icon, ListItem } from "react-native-elements"
import { StackNavigationProp } from "@react-navigation/stack"
import {
  gql,
  OperationVariables,
  QueryLazyOptions,
  useLazyQuery,
  useQuery,
} from "@apollo/client"
import type { ViewStyleProp } from "react-native/Libraries/StyleSheet/StyleSheet"

import { Screen } from "../../components/screen"
import { VersionComponent } from "../../components/version"
import { palette } from "../../theme/palette"
import { LN_PAGE_DOMAIN, WHATSAPP_CONTACT_NUMBER } from "../../constants/support"
import { translate } from "../../i18n"
import { openWhatsApp } from "../../utils/external"
import KeyStoreWrapper from "../../utils/storage/secureStorage"
import type { ScreenType } from "../../types/jsx"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import Clipboard from "@react-native-community/clipboard"
import { toastShow } from "../../utils/toast"
import useToken from "../../utils/use-token"
import { MAIN_QUERY } from "../../graphql/query"
import useLogout from "../../hooks/use-logout"

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "settings">
}

export const SettingsScreen: ScreenType = ({ navigation }: Props) => {
  const { hasToken } = useToken()
  const { logout } = useLogout()

  const { data } = useQuery(MAIN_QUERY, {
    variables: { hasToken },
  })

  const securityAction = async () => {
    const isBiometricsEnabled = await KeyStoreWrapper.getIsBiometricsEnabled()
    const isPinEnabled = await KeyStoreWrapper.getIsPinEnabled()
    const isSendLockEnabled = await KeyStoreWrapper.getIsSendLockEnabled()

    navigation.navigate("security", {
      mIsBiometricsEnabled: isBiometricsEnabled,
      mIsPinEnabled: isPinEnabled,
      mIsSendLockEnabled: isSendLockEnabled,
    })
  }

  const logoutAction = async () => {
    try {
      await logout()
      Alert.alert(translate("common.loggedOut"), "", [
        {
          text: translate("common.ok"),
          onPress: () => {
            navigation.goBack()
          },
        },
      ])
    } catch (err) {
      // TODO: figure out why ListItem onPress is swallowing errors
      console.error(err)
    }
  }

  const onGetCsvCallback = async (data) => {
    const csvEncoded = data.me?.defaultAccount?.csvTransactions

    try {
      await Share.open({
        // title: "export-csv-title.csv",
        url: `data:text/csv;base64,${csvEncoded}`,
        type: "text/csv",
        // subject: 'csv export',
        filename: "export.csv",
        // message: 'export message'
      })
    } catch (err) {
      console.error(err)
    }
  }

  const me = data?.me || {}
  const defaultWalletId = me.defaultAccount?.defaultWalletId

  const [getCsv] = useLazyQuery(
    gql`
      query getWalletCSVTransactions($defaultWalletId: WalletId!) {
        me {
          id
          defaultAccount {
            id
            csvTransactions(walletIds: [$defaultWalletId])
          }
        }
      }
    `,
    { onCompleted: onGetCsvCallback },
  )

  return (
    <SettingsScreenJSX
      hasToken={hasToken}
      navigation={navigation}
      username={me.username}
      phone={me.phone}
      language={translate(`Languages.${me.language || "DEFAULT"}`)}
      csvAction={() => getCsv({ variables: { defaultWalletId } })}
      securityAction={securityAction}
      logoutAction={logoutAction}
    />
  )
}

type SettingsScreenProps = {
  hasToken: boolean
  navigation: StackNavigationProp<RootStackParamList, "settings">
  username: string
  phone: string
  language: string
  notificationsEnabled: boolean
  csvAction: (options?: QueryLazyOptions<OperationVariables>) => void
  securityAction: () => void
  logoutAction: () => Promise<void>
}

type SettingRow = {
  id: string
  icon: string
  category: string
  hidden?: boolean
  enabled?: boolean
  subTitleText?: string
  subTitleDefaultValue?: string
  action?: () => void
  greyed?: boolean
  styleDivider?: ViewStyleProp
}

export const SettingsScreenJSX: ScreenType = (params: SettingsScreenProps) => {
  const {
    hasToken,
    navigation,
    username,
    phone,
    language,
    csvAction,
    securityAction,
    logoutAction,
  } = params
  const copyToClipBoard = (username) => {
    Clipboard.setString(LN_PAGE_DOMAIN + username)
    Clipboard.getString().then((data) =>
      toastShow(translate("tippingLink.copied", { data }), {
        backgroundColor: palette.lightBlue,
      }),
    )
  }

  const openWhatsAppAction = () =>
    openWhatsApp(WHATSAPP_CONTACT_NUMBER, translate("whatsapp.defaultSupportMessage"))

  const settingList: SettingRow[] = [
    {
      category: translate("common.phoneNumber"),
      icon: "call",
      id: "phone",
      subTitleDefaultValue: translate("SettingsScreen.tapLogIn"),
      subTitleText: phone,
      action: () => navigation.navigate("phoneValidation"),
      enabled: !hasToken,
      greyed: hasToken,
    },
    {
      category: translate("common.username"),
      icon: "ios-person-circle",
      id: "username",
      subTitleDefaultValue: translate("SettingsScreen.tapUserName"),
      subTitleText: username,
      action: () => navigation.navigate("setUsername"),
      enabled: hasToken && !username,
      greyed: !hasToken || !!(hasToken && username),
    },
    {
      category: translate("common.language"),
      icon: "ios-language",
      id: "language",
      subTitleText: language,
      action: () => navigation.navigate("language"),
      enabled: hasToken,
      greyed: !hasToken,
    },
    {
      category: translate("common.security"),
      icon: "lock-closed-outline",
      id: "security",
      action: securityAction,
      enabled: hasToken,
      greyed: !hasToken,
    },
    {
      category: translate("common.csvExport"),
      icon: "ios-download",
      id: "csv",
      action: () => csvAction(),
      enabled: hasToken,
      greyed: !hasToken,
    },
    {
      category: translate("tippingLink.title"),
      icon: "cash-outline",
      id: "tippingLink",
      action: () => copyToClipBoard(username),
      enabled: hasToken && username !== null,
      greyed: !hasToken || username === null,
    },
    {
      category: translate("whatsapp.contactUs"),
      icon: "ios-logo-whatsapp",
      id: "contact-us",
      action: openWhatsAppAction,
      enabled: true,
      greyed: false,
      styleDivider: { backgroundColor: palette.lighterGrey, height: 18 },
    },
    {
      category: translate("common.logout"),
      id: "logout",
      icon: "ios-log-out",
      action: () => logoutAction(),
      enabled: hasToken,
      greyed: !hasToken,
      hidden: !hasToken,
    },
  ]

  return (
    <Screen preset="scroll">
      {settingList.map((setting, i) => {
        if (setting.hidden) {
          return null
        }
        const settingColor = setting.greyed ? palette.midGrey : palette.darkGrey
        const settingStyle: TextStyle = { color: settingColor }
        return (
          <React.Fragment key={`setting-option-${i}`}>
            <ListItem onPress={setting.action} disabled={!setting.enabled}>
              <Icon name={setting.icon} type="ionicon" color={settingColor} />
              <ListItem.Content>
                <ListItem.Title style={settingStyle}>
                  <Text>{setting.category}</Text>
                </ListItem.Title>
                {setting.subTitleText && (
                  <ListItem.Subtitle style={settingStyle}>
                    {setting.subTitleText}
                  </ListItem.Subtitle>
                )}
              </ListItem.Content>
              {setting.enabled && <ListItem.Chevron />}
            </ListItem>
            <Divider style={setting.styleDivider} />
          </React.Fragment>
        )
      })}
      <VersionComponent />
    </Screen>
  )
}
