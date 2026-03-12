import React from "react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { GaloyIconButton } from "../atomic/galoy-icon-button"

type HeaderCloseControlParams = {
  navigateTo?: keyof RootStackParamList
}

const HeaderCloseButton: React.FC<HeaderCloseControlParams> = ({
  navigateTo = "Primary",
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <GaloyIconButton
      onPress={() => navigation.navigate(navigateTo as never)}
      size="medium"
      name="close"
      backgroundColor={colors.grey5}
      style={styles.headerCloseButton}
    />
  )
}

export const headerCloseControl = ({
  navigateTo = "Primary",
}: HeaderCloseControlParams = {}) => {
  const HeaderCloseControlComponent = () => <HeaderCloseButton navigateTo={navigateTo} />
  HeaderCloseControlComponent.displayName = "HeaderCloseControl"

  return HeaderCloseControlComponent
}

const useStyles = makeStyles(() => ({
  headerCloseButton: {
    marginRight: 20,
  },
}))
