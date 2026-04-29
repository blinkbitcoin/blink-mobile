import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { SelfCustodialAccountFields } from "./account-fields"

export const SelfCustodialAccountInformationScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <Screen preset="scroll" keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>
          {LL.SettingsScreen.AccountInformation.accountTypeLabel()}
        </Text>
        <Text style={styles.sectionValue} {...testProps("self-custodial-account-type")}>
          {LL.AccountTypeSelectionScreen.selfCustodialLabel()}
        </Text>

        <View style={styles.divider} />

        <SelfCustodialAccountFields />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionLabel: {
    color: colors.grey2,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  sectionValue: {
    color: colors.black,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: colors.grey5,
    marginVertical: 16,
  },
}))
