import * as React from "react"
import { View } from "react-native"
import { LocalizedString } from "typesafe-i18n"

import { useI18nContext } from "@app/i18n/i18n-react"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rneui/themed"

export type TrialAccountLimitsModalProps = {
  isVisible: boolean
  closeModal: () => void
}

const UPGRADE_TO = 1

export const TrialAccountLimitsModal: React.FC<TrialAccountLimitsModalProps> = ({
  isVisible,
  closeModal,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "getStarted">>()

  const navigateToPhoneLogin = () => {
    navigation.navigate("login", {
      type: PhoneLoginInitiateType.CreateAccount,
      title: LL.UpgradeAccountModal.upgradeToLevel({ level: UPGRADE_TO }),
      upgrade: true,
    })
    closeModal()
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={closeModal}
      image={<GaloyIcon name="info" color={colors.primary3} size={100} />}
      title={LL.UpgradeAccountModal.title()}
      body={
        <View style={styles.modalBody}>
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.recoveryOption()} />
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.dailyLimit()} />
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.onchainReceive()} />
        </View>
      }
      primaryButtonTitle={LL.UpgradeAccountModal.upgradeToLevel({ level: UPGRADE_TO })}
      primaryButtonOnPress={navigateToPhoneLogin}
      secondaryButtonTitle={LL.UpgradeAccountModal.notNow()}
      secondaryButtonOnPress={closeModal}
    />
  )
}

const LimitItem = ({ text }: { text: LocalizedString }) => {
  const styles = useStyles()

  return (
    <View style={styles.limitRow}>
      <Text type="h2" style={styles.limitText}>
        - {text}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  limitText: {
    marginLeft: 12,
  },
  modalBody: {
    rowGap: 8,
  },
}))
