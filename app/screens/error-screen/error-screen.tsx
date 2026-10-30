import React, { useEffect } from "react"
import { Alert, View } from "react-native"
import { getReadableVersion } from "react-native-device-info"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import ContactModal, {
  SupportChannels,
} from "@app/components/contact-modal/contact-modal"
import { Screen } from "@app/components/screen"
import { useAppConfig } from "@app/hooks"
import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useAuthenticationContext } from "@app/navigation/navigation-container-wrapper"
import { isIos } from "@app/utils/helper"
import { recordAppError } from "@app/utils/error-reporting"
import { makeStyles, Text } from "@rn-vui/themed"

import HoneyBadgerShovel from "./honey-badger-shovel-01.svg"

export const ErrorScreen = ({
  error,
  resetError,
}: {
  error: Error
  resetError: () => void
}) => {
  const [isContactModalVisible, setIsContactModalVisible] = React.useState(false)
  const { logout } = useLogout()
  const { setAppLocked, setAppUnlocked } = useAuthenticationContext()
  const { LL } = useI18nContext()
  const { appConfig } = useAppConfig()
  const { name: bankName } = appConfig.galoyInstance
  const styles = useStyles()

  useEffect(() => recordAppError(error, { alwaysRecord: true }), [error])

  const resetApp = async () => {
    const { isAppLockKept } = await logout()

    /**
     * The flag only, because this boundary sits outside the navigator: there is nothing to
     * navigate while the fallback is up, and the reset below is what brings the stack back.
     *
     * That reset is also the other half of raising a lock. Clearing the boundary remounts
     * the root stack, which initialises at its own `authenticationCheck` entry (the
     * container keeps no state to restore it to anything else), so the gate is what the
     * user meets. The flag is what defers an incoming deep link until that gate is
     * answered, exactly as the resume relock pairs the two.
     *
     * Both directions are set, never just the one. The flag starts raised, so a crash
     * before the first unlock would otherwise leave it up after the lock itself was erased,
     * with no lock screen left that could lower it.
     */
    const matchLockFlagToLock = isAppLockKept ? setAppLocked : setAppUnlocked
    matchLockFlagToLock()

    resetError()
  }

  const toggleIsContactModalVisible = () => {
    setIsContactModalVisible(!isContactModalVisible)
  }

  const contactMessageBody = LL.support.defaultSupportMessage({
    os: isIos ? "iOS" : "Android",
    version: getReadableVersion(),
    bankName,
  })

  const contactMessageSubject = LL.support.defaultEmailSubject({
    bankName,
  })

  return (
    <Screen preset="scroll" style={styles.screenStyle}>
      <View style={styles.imageContainer}>
        <HoneyBadgerShovel />
      </View>
      <Text type="p1">{LL.errors.fatalError()}</Text>
      <GaloyPrimaryButton
        title={LL.errors.showError()}
        onPress={() => Alert.alert(LL.common.error(), String(error))}
        containerStyle={styles.buttonContainer}
      />
      <GaloyPrimaryButton
        title={LL.support.contactUs()}
        onPress={() => toggleIsContactModalVisible()}
        containerStyle={styles.buttonContainer}
      />
      <GaloyPrimaryButton
        title={LL.common.tryAgain()}
        onPress={() => resetError()}
        containerStyle={styles.buttonContainer}
      />
      <GaloyPrimaryButton
        title={LL.errors.clearAppData()}
        onPress={() => resetApp()}
        containerStyle={styles.buttonContainer}
      />
      <ContactModal
        isVisible={isContactModalVisible}
        toggleModal={toggleIsContactModalVisible}
        messageBody={contactMessageBody}
        messageSubject={contactMessageSubject}
        supportChannels={[
          SupportChannels.Faq,
          SupportChannels.StatusPage,
          SupportChannels.Email,
          SupportChannels.Telegram,
          SupportChannels.Mattermost,
        ]}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  buttonContainer: {
    marginTop: 20,
  },
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
  },
  screenStyle: {
    flexGrow: 1,
    padding: 20,
  },
  imageContainer: {
    alignSelf: "center",
    backgroundColor: colors.grey3,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
}))
