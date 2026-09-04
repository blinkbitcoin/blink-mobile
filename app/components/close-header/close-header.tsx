import React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

type CloseHeaderProps = {
  /** Where the control leads. Defaults to leaving the flow for the home tabs. */
  onClose?: () => void
  testID: string
}

/**
 * A flow's top-right close control, drawn in the screen rather than the navigation
 * header.
 *
 * The header route positions its items by the native bar's own rules, which differ
 * per platform and cannot be matched to a screen's padding. Owning the row is what
 * lets a flow sit its close control on the same margin as everything else on the
 * screen, and it is why the account-migration flow already draws its own.
 *
 * The row keeps its height with no control in it, so a screen that hides the exit
 * holds the same layout as one that offers it.
 */
export const CloseHeader: React.FC<CloseHeaderProps> = ({ onClose, testID }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const leaveFlow = React.useCallback(() => navigation.navigate("Primary"), [navigation])

  return (
    <View style={styles.header}>
      <GaloyIconButton
        name="close"
        size="medium"
        backgroundColor={colors.grey5}
        onPress={onClose ?? leaveFlow}
        {...testProps(testID)}
      />
    </View>
  )
}

const useStyles = makeStyles(() => ({
  header: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
}))
