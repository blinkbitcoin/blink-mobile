import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

type BulletListCardProps = {
  title: string
  items: string[]
}

export const BulletListCard: React.FC<BulletListCardProps> = ({ title, items }) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.bulletList}>
        {items.map((text, index) => (
          <View key={index} style={styles.bulletItem}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>{text}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  title: {
    color: colors.black,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 22,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 11,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey2,
    marginTop: 9,
  },
  bulletText: {
    flex: 1,
    color: colors.grey2,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 22,
  },
}))
