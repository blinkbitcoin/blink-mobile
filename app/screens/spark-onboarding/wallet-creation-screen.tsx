import React, { useEffect } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { CreationStatus, useCreateWallet } from "./hooks/use-create-wallet"

export const SparkWalletCreationScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { status, create } = useCreateWallet()

  useEffect(() => {
    create()
  }, [create])

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
              onPress={create}
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
