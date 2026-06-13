import React, { useEffect } from "react"
import { TouchableOpacity } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { CustomIcon } from "@app/components/custom-icon"
import { headerRightNoGlass } from "@app/components/header-no-glass/header-no-glass"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

type NfcHeaderButtonProps = {
  visible: boolean
  onPress: () => void
}

export const NfcHeaderButton: React.FC<NfcHeaderButtonProps> = ({ visible, onPress }) => {
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const styles = useStyles()

  useEffect(() => {
    if (!visible) {
      navigation.setOptions(headerRightNoGlass(() => <></>))
      return
    }

    navigation.setOptions(
      headerRightNoGlass(() => (
        <TouchableOpacity
          {...testProps("nfc-icon")}
          style={styles.nfcIcon}
          accessibilityLabel="NFC"
          accessibilityRole="button"
          onPress={onPress}
        >
          <CustomIcon name="nfc" color={colors.black} size={24} />
        </TouchableOpacity>
      )),
    )
  }, [visible, onPress, navigation, colors.black, styles.nfcIcon])

  return null
}

const useStyles = makeStyles(() => ({
  nfcIcon: {
    // No margin — keeps the iOS 26 glass capsule concentric with the glyph.
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
  },
}))
