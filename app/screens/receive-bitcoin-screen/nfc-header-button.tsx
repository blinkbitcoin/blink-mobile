import React, { useEffect } from "react"
import { TouchableOpacity } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { CustomIcon } from "@app/components/custom-icon"
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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const styles = useStyles()

  useEffect(() => {
    if (!visible) {
      navigation.setOptions({ headerRight: () => <></> })
      return
    }

    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          {...testProps("nfc-icon")}
          style={styles.nfcIcon}
          accessibilityLabel="NFC"
          accessibilityRole="button"
          onPress={onPress}
        >
          <CustomIcon name="nfc" color={colors.black} size={24} />
        </TouchableOpacity>
      ),
    })
  }, [visible, onPress, navigation, colors.black, styles.nfcIcon])

  return null
}

const useStyles = makeStyles(() => ({
  nfcIcon: {
    marginRight: 10,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: 1,
  },
}))
