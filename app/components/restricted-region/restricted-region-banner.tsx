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
      <Text bold style={styles.title}>
        {LL.RestrictedRegion.title()}
      </Text>
      <RestrictedRegionBody type="p3" style={styles.body} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    padding: 14,
  },
  title: {
    color: colors.warning,
    marginBottom: 6,
  },
  body: {
    color: colors.black,
  },
}))
