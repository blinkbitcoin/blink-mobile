import React, { useCallback } from "react"
import { View } from "react-native"

import {
  RouteProp,
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

type BundleSavedRouteProp = RouteProp<RootStackParamList, "selfCustodialBundleSaved">

/** Long enough to read four words and register that the download worked, short
 *  enough that it does not feel like a stall. */
const DWELL_MS = 1800

/**
 * Confirms the emergency bundle reached the user's device, then moves on to the
 * backup's success screen on its own.
 *
 * Deliberately actionless: the export already happened, so a button here would
 * only ask the user to acknowledge something that is already true. It mirrors
 * the app's other success interstitials. The backup was recorded before the
 * bundle step, so leaving here only navigates and cannot fail, which is what
 * makes a screen without an action safe.
 */
export const BundleSavedScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { successMessage, reBackup } = useRoute<BundleSavedRouteProp>().params ?? {}
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "selfCustodialBundleSaved">
    >()

  /** Cleared when the screen loses focus, so the dwell never navigates out of a
   *  screen the user has already left. */
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        navigation.replace("selfCustodialBackupSuccess", {
          reBackup,
          message: successMessage,
        })
      }, DWELL_MS)
      return () => clearTimeout(timer)
    }, [navigation, reBackup, successMessage]),
  )

  return (
    <Screen preset="fixed" headerShown={false}>
      <View style={styles.container} {...testProps("bundle-saved-screen")}>
        {/* Full-colour asset: it carries its own green, so no iconColor. */}
        <GaloyIcon name="payment-success" size={100} />
        <Text type="p1" style={styles.title}>
          {LL.BackupScreen.BundleExport.savedTitle()}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 20,
  },
  title: {
    textAlign: "center",
  },
}))
