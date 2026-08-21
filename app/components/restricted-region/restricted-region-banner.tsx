import * as React from "react"
import { View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text } from "@rn-vui/themed"

import { RestrictedRegionBody } from "./restricted-region-body"

export const RestrictedRegionBanner: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  return (
    <View style={styles.container} {...testProps("restricted-region-banner")}>
      <Text style={styles.title}>{LL.RestrictedRegion.title()}</Text>
      <RestrictedRegionBody style={styles.body} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    padding: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    color: colors.primary,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: colors.black,
  },
}))
