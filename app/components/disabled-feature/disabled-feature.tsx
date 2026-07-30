import React, { PropsWithChildren } from "react"
import { Pressable, StyleSheet, View } from "react-native"

type DisabledFeatureProps = PropsWithChildren<{
  disabled: boolean
  onDisabledPress?: () => void
}>

/** Same tree shape in both states so a runtime toggle never unmounts the children;
 *  accessible={false} keeps screen readers on the individual children. */
export const DisabledFeature: React.FC<DisabledFeatureProps> = ({
  disabled,
  onDisabledPress,
  children,
}) => {
  const handleDisabledPress = disabled ? onDisabledPress : undefined
  const isWrapperInert = !disabled
  const wrapperStyle = disabled ? styles.disabled : undefined
  const contentPointerEvents = disabled ? "none" : "box-none"

  return (
    <Pressable
      onPress={handleDisabledPress}
      disabled={isWrapperInert}
      accessible={false}
      style={wrapperStyle}
    >
      <View pointerEvents={contentPointerEvents}>{children}</View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
})
