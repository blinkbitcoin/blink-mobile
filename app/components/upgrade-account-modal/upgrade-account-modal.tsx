import * as React from "react"
import { View } from "react-native"
import { LocalizedString } from "typesafe-i18n"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { PhoneLoginInitiateType } from "@app/screens/phone-auth-screen"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

export type UpgradeAccountModalProps = {
  isVisible: boolean
  closeModal: () => void
}

export const UpgradeAccountModal: React.FC<UpgradeAccountModalProps> = ({
  isVisible,
  closeModal,
}) => {
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "getStarted">>()

  const navigateToPhoneLogin = () => {
    navigation.navigate("phoneFlow", {
      screen: "phoneLoginInitiate",
      params: {
        type: PhoneLoginInitiateType.CreateAccount,
      },
    })
    closeModal()
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={closeModal}
      image={<GaloyIcon name="payment-success" size={100} />}
      title={LL.UpgradeAccountModal.title()}
      body={
        <View>
          <AccountBenefit text={LL.UpgradeAccountModal.backUpFunds()} />
          <AccountBenefit text={LL.UpgradeAccountModal.higherLimits()} />
          <AccountBenefit text={LL.UpgradeAccountModal.receiveOnchain()} />
        </View>
      }
      primaryButtonTextAbove={LL.UpgradeAccountModal.onlyAPhoneNumber()}
      primaryButtonTitle={LL.UpgradeAccountModal.letsGo()}
      primaryButtonOnPress={navigateToPhoneLogin}
      secondaryButtonTitle={LL.UpgradeAccountModal.stayInTrialMode()}
      secondaryButtonOnPress={closeModal}
    />
  )
}

const AccountBenefit = ({ text }: { text: LocalizedString }) => {
  const styles = useStyles()

  const {
    theme: { colors },
  } = useTheme()
  return (
    <View style={styles.accountBenefitRow}>
      <GaloyIcon color={colors.success} name="check" size={14} />
      <Text type="h2" style={styles.accountBenefitText}>
        {text}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  accountBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  accountBenefitText: {
    marginLeft: 12,
  },
}))
