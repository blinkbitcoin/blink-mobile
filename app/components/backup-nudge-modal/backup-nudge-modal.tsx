import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { GaloyIcon } from "../atomic/galoy-icon"
import CustomModal from "../custom-modal/custom-modal"

type BackupNudgeModalProps = {
  isVisible: boolean
  // Dismissal: X, backdrop tap and Android back. Starts the modal cooldown.
  onClose: () => void
}

export const BackupNudgeModal: React.FC<BackupNudgeModalProps> = ({
  isVisible,
  onClose,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  // Deliberately no `onClose()` here: reaching the backup screen is not a
  // backup. The caller hides the modal while this screen is unfocused, so a
  // user who abandons the flow is nudged again instead of buying a quiet day.
  const handleSecure = () => {
    navigation.navigate("selfCustodialBackupMethod")
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onClose}
      showCloseIconButton={true}
      image={
        <GaloyIcon
          name="warning"
          size={52}
          color={colors.primary}
          {...testProps("nudge-warning-icon")}
        />
      }
      title={LL.BackupNudge.modalTitle()}
      body={<Text style={styles.description}>{LL.BackupNudge.modalDescription()}</Text>}
      primaryButtonTitle={LL.BackupNudge.secureMe()}
      primaryButtonOnPress={handleSecure}
      {...testProps("backup-nudge-modal")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
  },
}))
