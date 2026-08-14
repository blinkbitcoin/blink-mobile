import React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { Screen } from "@app/components/screen"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"
import { makeStyles, Text } from "@rn-vui/themed"

type Props = {
  children: React.ReactNode
}

/** Fail-closed wrapper for screens showing seed words or other one-time secrets.
 *  The sensitive subtree — including the effects that install header actions like
 *  Copy/Share — is mounted only once the screen guard is actually on: while
 *  registration is pending a neutral placeholder shows instead, and after the
 *  bounded retries are exhausted a non-sensitive error state offers Retry/Back.
 *  Retrying remounts the hook subtree, which releases the old lease and acquires
 *  a fresh one. */
export const ScreenSecurityGate: React.FC<Props> = ({ children }) => {
  const [attempt, setAttempt] = React.useState(0)

  return (
    <GatedContent key={attempt} onRetry={() => setAttempt((current) => current + 1)}>
      {children}
    </GatedContent>
  )
}

const GatedContent: React.FC<Props & { onRetry: () => void }> = ({
  children,
  onRetry,
}) => {
  const state = useScreenSecurity()
  const { LL } = useI18nContext()
  const styles = useStyles()
  const navigation = useNavigation()

  if (state === "active") return <>{children}</>

  if (state === "activating") {
    // Deliberately blank: nothing on a protected route is safe to show yet.
    return <Screen preset="fixed">{null}</Screen>
  }

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
          onPress={() => navigation.goBack()}
          {...testProps("screen-security-back")}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
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
