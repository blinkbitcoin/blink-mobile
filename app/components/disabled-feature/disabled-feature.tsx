import React, { PropsWithChildren } from "react"
import { Pressable, StyleSheet, View } from "react-native"

type DisabledFeatureProps = PropsWithChildren<{
  disabled: boolean
  onDisabledPress?: () => void
  /** Names the gate for screen readers: hiding the children takes their labels too. */
  accessibilityLabel?: string
}>

/**
 * Same tree shape in both states so a runtime toggle never unmounts the children.
 *
 * While disabled the children leave the accessibility tree and the wrapper stands in for
 * them: blocking touches alone is not enough, since a screen reader activates a child's
 * `onPress` without the gesture passing through `pointerEvents`. The wrapper is not
 * announced as disabled because activating it is what explains the gate.
 */
export const DisabledFeature: React.FC<DisabledFeatureProps> = ({
  disabled,
  onDisabledPress,
  accessibilityLabel,
  children,
}) => {
  const handleDisabledPress = disabled ? onDisabledPress : undefined
  const isWrapperInert = !disabled
  const wrapperStyle = disabled ? styles.disabled : undefined
  const wrapperRole = disabled ? "button" : undefined
  const wrapperLabel = disabled ? accessibilityLabel : undefined
  const contentPointerEvents = disabled ? "none" : "box-none"
  /** Android's counterpart to `accessibilityElementsHidden`; both are needed. */
  const contentAccessibilityImportance = disabled ? "no-hide-descendants" : "auto"

  return (
    <Pressable
      onPress={handleDisabledPress}
      disabled={isWrapperInert}
      accessible={disabled}
      accessibilityRole={wrapperRole}
      accessibilityLabel={wrapperLabel}
      style={wrapperStyle}
    >
      <View
        pointerEvents={contentPointerEvents}
        accessibilityElementsHidden={disabled}
        importantForAccessibility={contentAccessibilityImportance}
      >
        {children}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
})
