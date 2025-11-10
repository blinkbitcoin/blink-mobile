import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles } from "@rn-vui/themed"

export type DeviceAccountFailModalProps = {
  isVisible: boolean
  closeModal: () => void
  navigateToPhoneLogin: () => void
  navigateToHomeScreen: () => void
}

export const DeviceAccountFailModal: React.FC<DeviceAccountFailModalProps> = ({
  isVisible,
  closeModal,
  navigateToPhoneLogin,
  navigateToHomeScreen,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={closeModal}
      image={<GaloyIcon name="payment-error" size={100} />}
      title={LL.GetStartedScreen.trialAccountCreationFailed()}
      body={
        <Text style={styles.errorBodyText} type="h2">
          {LL.GetStartedScreen.trialAccountCreationFailedMessage()}
        </Text>
      }
      primaryButtonTitle={LL.GetStartedScreen.registerPhoneAccount()}
      primaryButtonOnPress={navigateToPhoneLogin}
      secondaryButtonTitle={LL.GetStartedScreen.exploreWallet()}
      secondaryButtonOnPress={navigateToHomeScreen}
    />
  )
}

const useStyles = makeStyles(() => ({
  errorBodyText: {
    textAlign: "center",
  },
}))
