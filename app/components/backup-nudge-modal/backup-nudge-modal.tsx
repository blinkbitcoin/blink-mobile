import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { GaloyIcon } from "../atomic/galoy-icon"
import CustomModal from "../custom-modal/custom-modal"

type BackupNudgeModalProps = {
  isVisible: boolean
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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleSecure = () => {
    onClose()
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
