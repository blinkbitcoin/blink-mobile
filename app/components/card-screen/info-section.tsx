import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { InfoRow } from "./info-row"
import { radius } from "@app/rne-theme/radius"
import { staticSurface } from "@app/rne-theme/surfaces"
import { groupTitleGap } from "@app/rne-theme/tokens"
import { fonts } from "@app/rne-theme/fonts"

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
    gap: groupTitleGap,
  },
  title: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
  },
  card: {
    ...staticSurface(colors),
    borderRadius: radius.default,
    paddingHorizontal: 10,
    paddingVertical: 14,
    gap: 14,
  },
}))
