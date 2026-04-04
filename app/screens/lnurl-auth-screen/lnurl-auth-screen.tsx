import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { testProps } from "../../utils/testProps"

type Prop = {
  route: RouteProp<RootStackParamList, "lnurlAuth">
}

const LnurlAuthScreen: React.FC<Prop> = ({ route }) => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "lnurlAuth">>()

  const { callback, domain, k1, action, lnurl } = route.params

  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  const [err, setErr] = useState("")
  const [success, setSuccess] = useState(false)

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

  useEffect(() => {
    navigation.setOptions({ title: LL.LnurlAuthScreen?.title?.() ?? "Login Request" })
  }, [navigation, LL])

  const handleAuth = useCallback(async () => {
    // TODO: Implement linkingKey derivation and signing in Task 7-8
    // For now, just show a placeholder that auth is in progress
    try {
      // Placeholder - will be implemented in Task 8
      setErr("LNURL Auth not yet implemented - coming soon")
    } catch (error) {
      setErr(`${error}`)
    }
  }, [callback, k1, domain])

  useEffect(() => {
    handleAuth()
  }, [handleAuth])

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
        </View>
      )
    }
    return null
  }, [err, styles])

  const renderActivityStatusView = useMemo(() => {
    if (err === "" && !success) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }
    return null
  }, [err, success, colors.primary, styles])

  return (
    <Screen preset="scroll" style={styles.contentContainer}>
      <View style={[styles.inputForm, styles.container]}>
        <Text style={styles.domainText}>{domain}</Text>
        <Text style={styles.actionText}>
          {LL.LnurlAuthScreen?.actionDescription?.({ action: actionText, domain }) ?? `${actionText} to ${domain}`}
        </Text>

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
    marginBottom: 20,
    color: colors.grey1,
  },
  qr: {
    alignItems: "center",
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
  contentContainer: {
    padding: 20,
    flexGrow: 1,
  },
}))