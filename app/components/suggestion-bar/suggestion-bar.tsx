import React from "react"
import { Pressable, View } from "react-native"

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
    paddingVertical: 10,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 10,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
}))
