import React from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { GaloyIconButton } from "../atomic/galoy-icon-button"
import { headerRightNoGlass } from "../header-no-glass/header-no-glass"

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

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

// Spread into a screen's `options` to render the close button without the iOS 26
// Liquid Glass shared background. See header-no-glass.tsx.
export const headerCloseControlOptions = ({
  navigateTo = "Primary",
}: HeaderCloseControlParams = {}) =>
  headerRightNoGlass(() => <HeaderCloseButton navigateTo={navigateTo} />)

const useStyles = makeStyles(() => ({
  headerCloseButton: {
    marginRight: 20,
  },
}))
