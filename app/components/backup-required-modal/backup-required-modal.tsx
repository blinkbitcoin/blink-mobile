import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { GaloyIcon } from "../atomic/galoy-icon"
import CustomModal from "../custom-modal/custom-modal"

type BackupRequiredModalProps = {
  isVisible: boolean
  onClose: () => void
}

export const BackupRequiredModal: React.FC<BackupRequiredModalProps> = ({
  isVisible,
  onClose,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleBackup = () => {
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
          {...testProps("backup-required-warning-icon")}
        />
      }
      title={LL.BackupRequired.modalTitle()}
      body={
        <Text style={styles.description}>{LL.BackupRequired.modalDescription()}</Text>
      }
      primaryButtonTitle={LL.BackupRequired.backupNow()}
      primaryButtonOnPress={handleBackup}
      {...testProps("backup-required-modal")}
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
