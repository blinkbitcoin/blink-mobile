import React, { useEffect, useState } from "react"
import { Keyboard, Pressable, View } from "react-native"

import { Text, makeStyles } from "@rn-vui/themed"

type SuggestionBarProps = {
  suggestions: readonly string[]
  onSelect: (value: string) => void
}

export const SuggestionBar: React.FC<SuggestionBarProps> = ({
  suggestions,
  onSelect,
}) => {
  const styles = useStyles()
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    )
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  if (suggestions.length === 0) return null

  return (
    <View style={[styles.container, { bottom: keyboardHeight }]}>
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
    position: "absolute",
    left: 0,
    right: 0,
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
