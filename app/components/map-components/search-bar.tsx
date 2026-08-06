import React from "react"
import { Pressable } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"

type Props = {
  onPress: () => void
}

export default function SearchBar({ onPress }: Props) {
  const styles = useStyles()

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <Text style={styles.placeholder}>Search</Text>
      <GaloyIcon
        name="magnifying-glass"
        size={styles.icon.size}
        color={styles.icon.color}
      />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: 8,
    minHeight: 40,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 10,
  },
  placeholder: {
    color: colors.grey2,
    fontSize: 14,
    fontWeight: "bold",
  },
  icon: {
    color: colors.primary,
    size: 16,
  },
}))
