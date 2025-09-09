import * as React from "react"
import { Linking, Platform, Pressable, View } from "react-native"
import DeviceInfo from "react-native-device-info"
import ReactNativeModal from "react-native-modal"

import { gql } from "@apollo/client"
import { VersionComponent } from "@app/components/version"
import { APP_STORE_LINK, PLAY_STORE_LINK } from "@app/config"
import { useMobileUpdateQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rneui/themed"

import { isIos } from "../../utils/helper"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import { isUpdateAvailableOrRequired } from "./app-update.logic"

gql`
  query mobileUpdate {
    mobileVersions {
      platform
      currentSupported
      minSupported
    }
  }
`

const useStyles = makeStyles(() => ({
  bottom: {
    alignItems: "center",
  },

  lightningText: {
    fontSize: 20,
    marginBottom: 12,
    textAlign: "center",
  },

  versionComponent: { flex: 1, justifyContent: "flex-end", marginVertical: 48 },
  main: { flex: 5, justifyContent: "center" },
  button: { marginVertical: 12 },
}))

export const AppUpdate: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const { data } = useMobileUpdateQuery({ fetchPolicy: "no-cache" })

  const buildNumber = Number(DeviceInfo.getBuildNumber())
  const mobileVersions = data?.mobileVersions

  const { available, required } = isUpdateAvailableOrRequired({
    buildNumber,
    mobileVersions,
    OS: Platform.OS,
  })

  const openInStore = async () => {
    if (isIos) {
      Linking.openURL(APP_STORE_LINK)
    } else {
      // TODO: differentiate between PlayStore and Huawei AppGallery
      Linking.openURL(PLAY_STORE_LINK)
    }
  }

  const linkUpgrade = () =>
    openInStore().catch((err) => {
      console.log({ err }, "error app link on link")
    })

  if (available) {
    return (
      <View style={styles.bottom}>
        <Pressable onPress={linkUpgrade}>
          <Text style={styles.lightningText}>{LL.HomeScreen.updateAvailable()}</Text>
        </Pressable>
      </View>
    )
  }

  return <AppUpdateModal isVisible={required} linkUpgrade={linkUpgrade} />
}

export const AppUpdateModal = ({
  linkUpgrade,
  isVisible,
}: {
  linkUpgrade: () => void
  isVisible: boolean
}) => {
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  const styles = useStyles()

  return (
    <ReactNativeModal
      isVisible={isVisible}
      backdropColor={colors.white}
      backdropOpacity={0.92}
    >
      <View style={styles.main}>
        <Text style={styles.lightningText}>{LL.AppUpdate.versionNotSupported()}</Text>
        <Text style={styles.lightningText}>{LL.AppUpdate.updateMandatory()}</Text>
        <GaloyPrimaryButton
          buttonStyle={styles.button}
          onPress={linkUpgrade}
          title={LL.AppUpdate.tapHereUpdate()}
        />
      </View>
      <View style={styles.versionComponent}>
        <VersionComponent />
      </View>
    </ReactNativeModal>
  )
}
