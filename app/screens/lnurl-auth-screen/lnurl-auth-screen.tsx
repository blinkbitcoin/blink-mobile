import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  buildLnurlAuthSignedCallbackUrl,
  deriveLinkingKey,
  signLnurlChallenge,
} from "../../utils/lnurl-auth"
import { testProps } from "../../utils/testProps"

type Prop = {
  route: RouteProp<RootStackParamList, "lnurlAuth">
}

const LnurlAuthScreen: React.FC<Prop> = ({ route }) => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "lnurlAuth">>()

  const { callback, domain, k1, action } = route.params

  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  const [err, setErr] = useState("")
  const [success, setSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isMountedRef = useRef(true)

  const actionText = useMemo(() => {
    switch (action) {
      case "register":
        return LL.LnurlAuthScreen?.actionRegister?.() ?? "register"
      case "login":
        return LL.LnurlAuthScreen?.actionLogin?.() ?? "login"
      case "link":
        return LL.LnurlAuthScreen?.actionLink?.() ?? "link account"
      case "auth":
        return LL.LnurlAuthScreen?.actionAuth?.() ?? "authorize"
      default:
        return LL.LnurlAuthScreen?.actionLogin?.() ?? "login"
    }
  }, [action, LL])

  const consentText = useMemo(() => {
    const actionDescription =
      LL.LnurlAuthScreen?.actionDescription?.({ action: actionText, domain }) ??
      `${actionText} to ${domain}`

    return `${LL.common.confirm()}: ${actionDescription}`
  }, [LL, actionText, domain])

  useEffect(() => {
    navigation.setOptions({ title: LL.LnurlAuthScreen?.title?.() ?? "Login Request" })
  }, [navigation, LL])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const genericErrorMessage =
    LL.GaloyAddressScreen?.somethingWentWrong?.() ?? "Something went wrong. Please try again later."
  const authFailedMessage =
    LL.PhoneLoginValidationScreen?.errorLoggingIn?.() ?? genericErrorMessage

  const mapLnurlAuthErrorToMessage = useCallback(
    (error: unknown): string => {
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (
        errorMessage.includes("LNURL-auth callback domain mismatch") ||
        errorMessage.includes("Invalid LNURL-auth")
      ) {
        return authFailedMessage
      }

      return genericErrorMessage
    },
    [authFailedMessage, genericErrorMessage],
  )

  const handleAuth = useCallback(async () => {
    setErr("")
    setSuccess(false)
    setIsSubmitting(true)

    try {
      const { privateKey, publicKey } = await deriveLinkingKey(domain)
      const sig = signLnurlChallenge(privateKey, k1)

      const callbackUrl = buildLnurlAuthSignedCallbackUrl({
        callback,
        domain,
        k1,
        sig,
        key: publicKey,
      })

      const result = await fetch(callbackUrl)

      if (result.ok) {
        const response = await result.json()
        if (response?.status?.toLowerCase() === "ok") {
          if (!isMountedRef.current) return
          setSuccess(true)
        } else {
          if (!isMountedRef.current) return
          setErr(authFailedMessage)
        }
      } else {
        if (!isMountedRef.current) return
        setErr(genericErrorMessage)
      }
    } catch (error) {
      if (!isMountedRef.current) return
      setErr(mapLnurlAuthErrorToMessage(error))
    } finally {
      if (!isMountedRef.current) return
      setIsSubmitting(false)
    }
  }, [callback, k1, domain, authFailedMessage, genericErrorMessage, mapLnurlAuthErrorToMessage])

  const renderSuccessView = useMemo(() => {
    if (success) {
      return (
        <View style={styles.container}>
          <View {...testProps("Success Icon")} style={styles.container}>
            <GaloyIcon name={"payment-success"} size={128} />
          </View>
          <Text style={styles.successText}>
            {LL.LnurlAuthScreen?.success?.() ?? "Successfully authenticated!"}
          </Text>
        </View>
      )
    }
    return null
  }, [success, styles, LL])

  const renderErrorView = useMemo(() => {
    if (err !== "") {
      return (
        <View style={styles.container}>
          <Text style={styles.errorText} selectable>
            {err}
          </Text>
          <GaloySecondaryButton
            title={LL.common.tryAgain()}
            onPress={handleAuth}
            disabled={isSubmitting}
            containerStyle={styles.tryAgainButton}
          />
        </View>
      )
    }
    return null
  }, [err, styles, LL, handleAuth, isSubmitting])

  const renderActivityStatusView = useMemo(() => {
    if (isSubmitting) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }
    return null
  }, [isSubmitting, colors.primary, styles])

  return (
    <Screen preset="scroll" style={styles.contentContainer}>
      <View style={[styles.inputForm, styles.container]}>
        <Text style={styles.domainText}>{domain}</Text>
        <Text style={styles.actionText}>{consentText}</Text>

        {!success && (
          <View style={styles.actionsContainer}>
            <GaloyPrimaryButton
              title={LL.common.confirm()}
              onPress={handleAuth}
              loading={isSubmitting}
              disabled={isSubmitting}
              containerStyle={styles.primaryActionButton}
            />
            <GaloySecondaryButton
              title={LL.common.cancel()}
              onPress={navigation.goBack}
              disabled={isSubmitting}
            />
          </View>
        )}

        <View style={styles.qr}>
          {renderSuccessView}
          {renderErrorView}
          {renderActivityStatusView}
        </View>
      </View>
    </Screen>
  )
}

export default LnurlAuthScreen

const useStyles = makeStyles(({ colors }) => ({
  container: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    marginLeft: 20,
    marginRight: 20,
  },
  inputForm: {
    marginVertical: 20,
  },
  domainText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  actionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    color: colors.grey1,
  },
  actionsContainer: {
    width: "100%",
    marginBottom: 16,
  },
  primaryActionButton: {
    marginBottom: 8,
  },
  qr: {
    alignItems: "center",
    width: "100%",
  },
  successText: {
    color: colors.success,
    textAlign: "center",
    marginTop: 10,
  },
  errorText: {
    color: colors.error,
    textAlign: "center",
  },
  tryAgainButton: {
    marginTop: 8,
  },
  contentContainer: {
    padding: 20,
    flexGrow: 1,
  },
}))
