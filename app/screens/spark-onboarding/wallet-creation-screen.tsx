import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { CommonActions, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { DefaultAccountId } from "@app/types/wallet.types"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { selfCustodialCreateWallet } from "@app/self-custodial/bridge"
import { usePersistentStateContext } from "@app/store/persistent-state"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { testProps } from "@app/utils/testProps"

const CreationStatus = {
  Creating: "creating",
  Error: "error",
} as const

type CreationStatus = (typeof CreationStatus)[keyof typeof CreationStatus]

export const SparkWalletCreationScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { updateState } = usePersistentStateContext()
  const [status, setStatus] = useState<CreationStatus>(CreationStatus.Creating)

  const createWallet = useCallback(async () => {
    setStatus(CreationStatus.Creating)
    try {
      await selfCustodialCreateWallet()
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: DefaultAccountId.SelfCustodial }
      })
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
    } catch {
      await KeyStoreWrapper.deleteMnemonic()
      setStatus(CreationStatus.Error)
    }
  }, [navigation, updateState])

  useEffect(() => {
    createWallet()
  }, [createWallet])

  if (status === CreationStatus.Error) {
    return (
      <Screen>
        <View style={styles.wrapper}>
          <View style={styles.body}>
            <Text type="h1" style={styles.title} {...testProps("error-title")}>
              {LL.SparkWalletCreationScreen.errorTitle()}
            </Text>
            <Text style={styles.description}>
              {LL.SparkWalletCreationScreen.errorDescription()}
            </Text>
          </View>
          <View style={styles.ctaContainer}>
            <GaloyPrimaryButton
              title={LL.SparkWalletCreationScreen.retry()}
              onPress={createWallet}
              {...testProps("retry-button")}
            />
          </View>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText} {...testProps("creating-text")}>
          {LL.SparkWalletCreationScreen.creating()}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  wrapper: {
    flex: 1,
    justifyContent: "space-between",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 24,
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
}))
