import React, { useCallback, useEffect, useRef } from "react"
import { View } from "react-native"

import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { logSelfCustodialBackupCompleted } from "@app/self-custodial/analytics"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"
import { testProps } from "@app/utils/testProps"

import { useCompleteBackup } from "../hooks"

type BundleSavedRouteProp = RouteProp<RootStackParamList, "selfCustodialBundleSaved">

/** Long enough to read four words and register that the download worked, short
 *  enough that it does not feel like a stall. */
const DWELL_MS = 1800

/**
 * Confirms the emergency bundle reached the user's device, then finishes the
 * backup on its own.
 *
 * Deliberately actionless: the export already happened, so a button here would
 * only ask the user to acknowledge something that is already true. It mirrors
 * the app's other success interstitials.
 */
export const BundleSavedScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { successMessage } = useRoute<BundleSavedRouteProp>().params ?? {}
  const completeBackup = useCompleteBackup()

  /** One manual backup is one completion, however many times this screen sends
   *  the user onward. Navigating forward again after an iOS back-swipe is
   *  correct; counting it as a second backup is not. */
  const hasLoggedRef = useRef(false)

  const finish = useCallback(() => {
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true
      logSelfCustodialBackupCompleted({ backupMethod: "manual" })
    }
    completeBackup({ method: BackupMethod.Manual, message: successMessage })
  }, [completeBackup, successMessage])

  /** Held in a ref so the dwell is not keyed on finish's identity: finish()
   *  completes the backup, which re-identifies the backup-state context and
   *  finish with it, so an effect depending on it re-arms after every firing -
   *  duplicate analytics, duplicate writes, and the success copy flipping while
   *  the user reads it. */
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  }, [finish])

  /** Focus-scoped rather than mount-scoped. The success screen this pushes stays
   *  above a still-mounted copy of this one and is swipeable back on iOS; since
   *  this screen has no action of its own, a dwell that only ever armed once
   *  would strand the user here with no way forward. */
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => finishRef.current(), DWELL_MS)
      return () => clearTimeout(timer)
    }, []),
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
