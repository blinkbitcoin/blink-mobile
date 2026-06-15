import React, { PropsWithChildren } from "react"
import { Pressable, StyleSheet, View } from "react-native"

type DisabledFeatureProps = PropsWithChildren<{
  disabled: boolean
  onDisabledPress?: () => void
}>

export const DisabledFeature: React.FC<DisabledFeatureProps> = ({
  disabled,
  onDisabledPress,
  children,
}) => {
  if (!disabled) return <>{children}</>

  return (
    <Pressable onPress={onDisabledPress} style={styles.disabled}>
      <View pointerEvents="none">{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
})
