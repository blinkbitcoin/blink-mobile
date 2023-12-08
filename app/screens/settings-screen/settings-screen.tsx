import { View } from "react-native"
import { Divider, makeStyles, Text, useTheme } from "@rneui/themed"
import { ScrollView } from "react-native-gesture-handler"

import { useI18nContext } from "@app/i18n/i18n-react"
import { useLevel } from "@app/graphql/level-context"

import { Screen } from "@app/components/screen"

import { AccountBanner } from "./settings/account-banner"
import { AccountLevelSetting } from "./settings/account-level"
import { AccountLNAddress } from "./settings/account-ln-address"

export const SettingsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { isAtLeastLevelZero } = useLevel()

  const items = {
    account: [
      <AccountLevelSetting key="acc-level" />,
      <AccountLNAddress key="ln-addr" />,
    ],
    general: [],
    securityAndPrivacy: [],
    advanced: [],
    community: [],
  }

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        <AccountBanner />
        {isAtLeastLevelZero && (
          <SettingsGroup name={LL.common.account()} items={items.account} />
        )}
        <SettingsGroup name={LL.common.general()} items={items.general} />
        <SettingsGroup
          name={LL.common.securityAndPrivacy()}
          items={items.securityAndPrivacy}
        />
        <SettingsGroup name={LL.common.advanced()} items={items.advanced} />
        <SettingsGroup name={LL.common.community()} items={items.community} />
      </ScrollView>
    </Screen>
  )
}

const SettingsGroup: React.FC<{
  name: string
  items: React.ReactElement[]
}> = ({ name, items }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View>
      <Text type="p2" bold>
        {name}
      </Text>
      <View style={styles.groupCard}>
        {items.map((element, index) => (
          <>
            {element}
            {index < items.length - 1 && (
              <Divider color={colors.grey4} style={styles.divider} />
            )}
          </>
        ))}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  outer: {
    marginTop: 4,
    paddingHorizontal: 10,
    display: "flex",
    flexDirection: "column",
    rowGap: 12,
  },
  groupCard: {
    marginTop: 4,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    overflow: "hidden",
  },
  divider: {
    marginHorizontal: 10,
  },
}))
