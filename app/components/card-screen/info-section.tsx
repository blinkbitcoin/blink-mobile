import React from "react"
import { View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { InfoRow } from "./info-row"
import { radius } from "@app/rne-theme/radius"
import { staticSurface } from "@app/rne-theme/surfaces"
import { groupTitleGap } from "@app/rne-theme/tokens"
import { fonts } from "@app/rne-theme/fonts"

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
  /** Outlines the card. The outline is drawn over the card rather than as its border, so
   *  it appearing or changing colour never moves the rows. */
  outlineColor?: string
}

export const InfoSection: React.FC<InfoSectionProps> = ({
  title,
  items,
  outlineColor,
}) => {
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
  outline: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.default,
    borderWidth: 1,
  },
}))
