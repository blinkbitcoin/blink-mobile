import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import {
  BlinkServicesStatus,
  useBlinkServicesStatus,
} from "@app/graphql/blink-services-status"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useHasCustodialAccount } from "@app/hooks/use-has-custodial-account"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { Screen } from "../screen"

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
  const { isSelfCustodial } = useActiveWallet()
  const hasCustodialAccount = useHasCustodialAccount()
  const servicesStatus = useBlinkServicesStatus()

  /**
   * An authed custodial session whose backend is not answering. Explaining that is the
   * point of this screen: the feature genuinely cannot work, and without this the user
   * watches it try and fail with no account-shaped reason for it.
   *
   * Deliberately only when the session is otherwise entitled to the feature. A user who
   * has no custodial account is told that first — it is the durable reason, and it stays
   * true when the servers come back.
   */
  const isUnreachable = servicesStatus === BlinkServicesStatus.Unreachable

  if (isAuthed && !isSelfCustodial && !isUnreachable) {
    return <>{children}</>
  }

  const { title, description } = ((): { title: string; description: string } => {
    if (isAuthed && !isSelfCustodial) {
      return {
        title: LL.BackendFeatureGate.unreachableTitle(),
        description: LL.BackendFeatureGate.unreachableDescription({ featureName }),
      }
    }
    if (hasCustodialAccount) {
      return {
        title: LL.BackendFeatureGate.signInTitle(),
        description: LL.BackendFeatureGate.signInDescription({ featureName }),
      }
    }
    return {
      title: LL.BackendFeatureGate.noAccountTitle(),
      description: LL.BackendFeatureGate.noAccountDescription({ featureName }),
    }
  })()

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
