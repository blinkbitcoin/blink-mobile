import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { InfoRow } from "./info-row"

export const INFO_SECTION_OUTLINE_TEST_ID = "info-section-outline"

type InfoItem = {
  label: string
  value: string
  valueColor?: string
  loading?: boolean
  valueTestId?: string
}

type InfoSectionProps = {
  title: string
  items: InfoItem[]
  /** Paints the card on grey7, the static surface, for a read-only summary. */
  inactive?: boolean
  /** Outlines the card. The outline is drawn over the card rather than as its border, so
   *  it appearing or changing colour never moves the rows. */
  outlineColor?: string
}

export const InfoSection: React.FC<InfoSectionProps> = ({
  title,
  items,
  inactive = false,
  outlineColor,
}) => {
  const styles = useStyles()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, inactive && styles.cardInactive]}>
        {items.map((item) => (
          <InfoRow
            key={item.label}
            label={item.label}
            value={item.value}
            valueColor={item.valueColor}
            loading={item.loading}
            valueTestId={item.valueTestId}
          />
        ))}
        {outlineColor ? (
          <View
            testID={INFO_SECTION_OUTLINE_TEST_ID}
            pointerEvents="none"
            style={[styles.outline, { borderColor: outlineColor }]}
          />
        ) : null}
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
  cardInactive: {
    backgroundColor: colors.grey7,
  },
  outline: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 8,
    borderWidth: 1,
  },
}))
