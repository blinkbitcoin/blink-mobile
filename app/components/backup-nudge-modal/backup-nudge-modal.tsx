import React from "react"

import { makeStyles, Text } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import CustomModal from "../custom-modal/custom-modal"

type BackupNudgeModalProps = {
  isVisible: boolean
}

export const BackupNudgeModal: React.FC<BackupNudgeModalProps> = ({ isVisible }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleSecure = () => {
    navigation.navigate("sparkBackupMethodScreen")
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={() => {}}
      showCloseIconButton={false}
      image={<GaloyIcon name="warning" size={40} {...testProps("nudge-warning-icon")} />}
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
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey2,
  },
}))
