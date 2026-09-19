import React from "react"
import { ActivityIndicator, View } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { Screen } from "@app/components/screen"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

type Props = {
  children: React.ReactNode
  /** Back action for the failure view. Screens whose gated content cannot be
   *  recovered once popped (a server-once API secret) pass a confirming handler
   *  here so Back can never silently discard it. Defaults to goBack. */
  onBack?: () => void
  /** Input-only screens (the user types a phrase they already hold) must not be
   *  locked out when registration keeps failing — Try Again re-runs the same
   *  failing cycle and would leave no path back to the funds. Fail open: mount
   *  the content unprotected instead. Display-only screens must never use this. */
  failOpen?: boolean
}

/** Fail-closed wrapper for screens showing seed words or other one-time secrets.
 *  The sensitive subtree — including the effects that install header actions like
 *  Copy/Share — is mounted only once the screen guard is actually on: while
 *  registration is pending a spinner shows instead (it carries nothing
 *  sensitive), and after the bounded retries are exhausted a non-sensitive error
 *  state offers Retry/Back. Retrying remounts the hook subtree, which releases
 *  the old lease and acquires a fresh one. */
export const ScreenSecurityGate: React.FC<Props> = ({ children, onBack, failOpen }) => {
  const [attempt, setAttempt] = React.useState(0)

  return (
    <GatedContent
      key={attempt}
      onRetry={() => setAttempt((current) => current + 1)}
      onBack={onBack}
      failOpen={failOpen}
    >
      {children}
    </GatedContent>
  )
}

const GatedContent: React.FC<Props & { onRetry: () => void }> = ({
  children,
  onRetry,
  onBack,
  failOpen,
}) => {
  const state = useScreenSecurity()
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation()

  if (state === "active") return <>{children}</>

  if (state === "activating") {
    // A spinner carries nothing sensitive, so it is safe to paint before the
    // guard is on — a blank screen read as a freeze for the whole retry window.
    return (
      <Screen preset="fixed">
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color={colors.primary}
            {...testProps("screen-security-activating")}
          />
        </View>
      </Screen>
    )
  }

  if (failOpen) return <>{children}</>

  return (
    <Screen preset="fixed">
      <View style={styles.errorContainer}>
        <Text style={styles.errorText} {...testProps("screen-security-error")}>
          {LL.errors.generic()}
        </Text>
        <GaloyPrimaryButton
          title={LL.common.tryAgain()}
          onPress={onRetry}
          {...testProps("screen-security-retry")}
        />
        <GaloySecondaryButton
          title={LL.common.back()}
          onPress={onBack ?? (() => navigation.goBack())}
          {...testProps("screen-security-back")}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
    marginBottom: 12,
  },
}))
