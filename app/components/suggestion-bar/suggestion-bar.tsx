import React from "react"
import { Pressable, View } from "react-native"

import { Text, makeStyles } from "@rn-vui/themed"

type SuggestionBarProps = {
  suggestions: readonly string[]
  onSelect: (value: string) => void
}

/** Renders in flow, directly above its bottom-anchored sibling (the screen's CTA).
 *  Every screen that mounts this sits inside the Screen component's
 *  KeyboardAvoidingView, so the parent is already lifted above the keyboard — the bar
 *  must not add its own keyboard offset on top, or the chips land a keyboard-height
 *  above the footer, on top of the input rows (#4088 review follow-up). */
export const SuggestionBar: React.FC<SuggestionBarProps> = ({
  suggestions,
  onSelect,
}) => {
  const styles = useStyles()

  if (suggestions.length === 0) return null

  return (
    <View style={styles.container}>
      {suggestions.map((item) => (
        <Pressable
          key={item}
          style={styles.chip}
          accessibilityRole="button"
          accessibilityLabel={item}
          onPress={() => onSelect(item)}
        >
          <Text style={styles.text}>{item}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 12,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
}))
