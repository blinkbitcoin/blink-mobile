import * as React from "react"
import { Text } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type Props = {
  isVisible: boolean
  toggleModal: () => void
}

export const StablesatsRestrictionModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleCreateNew = () => {
    toggleModal()
    navigation.navigate("getStarted")
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="info" size={80} color={colors.primary3} />}
      title={LL.StablesatsRestriction.modalTitle()}
      titleMaxWidth="100%"
      body={<Text style={styles.body}>{LL.StablesatsRestriction.modalBody()}</Text>}
      primaryButtonTitle={LL.StablesatsRestriction.createNew()}
      primaryButtonOnPress={handleCreateNew}
      secondaryButtonTitle={LL.common.close()}
      secondaryButtonOnPress={toggleModal}
      showCloseIconButton={true}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    color: colors.black,
    textAlign: "center",
  },
}))
