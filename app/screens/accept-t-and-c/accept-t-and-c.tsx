import * as React from "react"
import { Alert, View } from "react-native"
import { Text, makeStyles } from "@rn-vui/themed"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"
import { StorageFailure } from "@app/utils/storage/storage-failure"
import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"

import {
  MigrationCheckpoint,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"

import { Screen } from "../../components/screen"
import { PhoneLoginInitiateType } from "../phone-auth-screen"
import useAppCheckToken from "../get-started-screen/use-device-token"
import { useCreateDeviceAccount } from "../get-started-screen/use-create-device-account"

export const AcceptTermsAndConditionsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "acceptTermsAndConditions">
    >()

  const route = useRoute<RouteProp<RootStackParamList, "acceptTermsAndConditions">>()
  const { flow, mode } = route.params || { flow: "phone" }
  const { saveCheckpoint } = useMigrationCheckpoint()
  /** saveCheckpoint reports a store that refused, but not a save it turned away for want of
   *  an owner, which never reached the store. That one repeats on every tap while the owner
   *  lookup is down, so it is reported once for as long as the screen is mounted, as the
   *  commit screen does: one failure is one event, however many taps it costs. */
  const hasReportedOwnerlessSaveRef = React.useRef(false)
  /** The guard holds a second tap before React has committed the disabled button; the
   *  state is what shows the button busy. Without either, two taps issue two saves and
   *  both answers navigate. */
  const { run: runExclusively } = useInFlightGuard()
  const [isSavingTerms, setIsSavingTerms] = React.useState(false)

  const { deviceAccountEnabled } = useFeatureFlags()
  const appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled })
  const { createDeviceAccountAndLogin, loading } = useCreateDeviceAccount()

  const fallbackToPhoneLogin = () => {
    navigation.navigate("login", {
      type: PhoneLoginInitiateType.CreateAccount,
    })
  }

  const resolveNotSavedMessage = (failure: StorageFailure | null): string => {
    const { storageUnavailable } = LL.AccountMigration
    if (failure === StorageFailure.OutOfSpace) {
      return storageUnavailable.notSavedOutOfSpaceBody()
    }
    if (failure !== null) return storageUnavailable.notSavedBody()
    return LL.errors.generic()
  }

  /** The acceptance is part of the migration's consent trail, so advance only once the
   *  checkpoint write lands; otherwise a failed write would later re-prompt for terms the
   *  user already accepted. */
  const acceptMigrationTerms = async () => {
    setIsSavingTerms(true)
    try {
      const { isSaved, failure } = await saveCheckpoint(MigrationCheckpoint.BackupMethod)
      /** A Continue that answers a tap with nothing reads as a broken button. A store that
       *  refused is named as the device's, a full disk most of all since the user can go
       *  and fix it; a write turned away before it reached the store (no owner yet) is not
       *  the device's fault and keeps the generic copy. */
      if (!isSaved) {
        const isRefusedWithoutOwner = failure === null
        if (isRefusedWithoutOwner && !hasReportedOwnerlessSaveRef.current) {
          hasReportedOwnerlessSaveRef.current = true
          reportError(
            "Migration terms",
            new Error("Migration checkpoint save refused without an owner"),
          )
        }
        toastShow({ message: resolveNotSavedMessage(failure), LL })
        return
      }
      navigation.navigate("selfCustodialBackupMethod")
    } finally {
      setIsSavingTerms(false)
    }
  }

  const isAcceptBusy = loading || isSavingTerms

  const action = async () => {
    if (flow === "migration") {
      await runExclusively(acceptMigrationTerms)
      return
    }

    if (flow === "selfCustodial") {
      navigation.navigate("selfCustodialWalletCreation", { mode })
      return
    }

    if (flow === "phone" || !appCheckToken) {
      fallbackToPhoneLogin()
      return
    }

    if (flow === "trial") {
      createDeviceAccountAndLogin(appCheckToken).catch(fallbackToPhoneLogin)
      return
    }

    Alert.alert("unknown flow")
  }

  return (
    <Screen
      preset="scroll"
      style={styles.screenStyle}
      keyboardOffset="navigationHeader"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.viewWrapper}>
        <View style={styles.textContainer}>
          <Text type={"p1"}>{LL.AcceptTermsAndConditionsScreen.text()}</Text>
        </View>

        <View style={styles.textContainer}>
          <GaloySecondaryButton
            title={LL.AcceptTermsAndConditionsScreen.termsAndConditions()}
            onPress={() => InAppBrowser.open("https://www.blink.sv/en/terms-conditions")}
          />
        </View>
        <View style={styles.textContainer}>
          <GaloySecondaryButton
            title={LL.AcceptTermsAndConditionsScreen.prohibitedCountry()}
            onPress={() => InAppBrowser.open(BLOCKED_COUNTRIES_FAQ_LINK)}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AcceptTermsAndConditionsScreen.accept()}
            onPress={action}
            loading={isAcceptBusy}
            disabled={isAcceptBusy}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  screenStyle: {
    padding: 20,
    flexGrow: 1,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 14,
  },

  inputContainer: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 48,
  },
  textContainer: {
    marginBottom: 20,
  },
  viewWrapper: { flex: 1 },

  inputContainerStyle: {
    flex: 1,
    borderWidth: 2,
    borderBottomWidth: 2,
    paddingHorizontal: 10,
    borderColor: colors.primary5,
    borderRadius: 8,
  },
  errorContainer: {
    marginBottom: 20,
  },
}))
