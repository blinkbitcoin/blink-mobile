import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type BackendFeatureGateProps = {
  featureName: string
  icon: React.ReactNode
  children: React.ReactNode
}

export const BackendFeatureGate: React.FC<BackendFeatureGateProps> = ({
  featureName,
  icon,
  children,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const isAuthed = useIsAuthed()
  const hasCustodialAccount = useHasCustodialAccount()

  if (isAuthed) {
    return <>{children}</>
  }

  const title = hasCustodialAccount
    ? LL.BackendFeatureGate.signInTitle()
    : LL.BackendFeatureGate.noAccountTitle()

  const description = hasCustodialAccount
    ? LL.BackendFeatureGate.signInDescription({ featureName })
    : LL.BackendFeatureGate.noAccountDescription({ featureName })

  return (
    <Screen preset="fixed">
      <View style={styles.container} {...testProps("backend-feature-gate")}>
        {icon}
        <Text type="h1" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  title: {
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
}))
