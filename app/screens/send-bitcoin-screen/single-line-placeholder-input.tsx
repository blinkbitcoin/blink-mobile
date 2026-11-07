import React, { forwardRef } from "react"
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native"

/**
 * A TextInput whose placeholder stays on one line and ends in "…" when it doesn't fit.
 * A native placeholder can't be truncated, and on Android it wraps, so the placeholder
 * is drawn as a Text over the empty input instead. Typed text and the placeholder share
 * the input's font and left margin, with no horizontal padding, so they start at the same x.
 */
export const SingleLinePlaceholderInput = forwardRef<TextInput, TextInputProps>(
  ({ placeholder, placeholderTextColor, style, value, ...props }, ref) => {
    const { fontFamily, fontSize, fontWeight, letterSpacing, marginLeft } =
      StyleSheet.flatten(style) ?? {}

    return (
      <View style={styles.container}>
        <TextInput ref={ref} value={value} style={[style, styles.input]} {...props} />
        {!value && placeholder ? (
          <View
            pointerEvents="none"
            style={[styles.placeholderContainer, { left: marginLeft ?? 0 }]}
          >
            <Text
              accessible={false}
              importantForAccessibility="no"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontFamily,
                fontSize,
                fontWeight,
                letterSpacing,
                color: placeholderTextColor,
              }}
            >
              {placeholder}
            </Text>
          </View>
        ) : null}
      </View>
    )
  },
)

SingleLinePlaceholderInput.displayName = "SingleLinePlaceholderInput"

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  input: {
    paddingHorizontal: 0,
  },
  placeholderContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
  },
})
