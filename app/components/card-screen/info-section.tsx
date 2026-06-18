import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { InfoRow } from "./info-row"

type InfoItem = {
  label: string
  value: string
  valueColor?: string
}

type InfoSectionProps = {
  title: string
  items: InfoItem[]
}

export const InfoSection: React.FC<InfoSectionProps> = ({ title, items }) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        {items.map((item) => (
          <InfoRow
            key={item.label}
            label={item.label}
            value={item.value}
            valueColor={item.valueColor}
          />
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    gap: 3,
  },
  title: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 14,
  },
}))
