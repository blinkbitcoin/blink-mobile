import React from "react"
import { Linking, Text } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { MigrationExplainerLayout } from "../migration-explainer-layout"

const SPARK_LEARN_MORE_URL = "https://spark.info"

export const SparkMigrationExplainerScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const handleLearnMore = () => {
    Linking.openURL(SPARK_LEARN_MORE_URL)
  }

  const steps: ReadonlyArray<React.ReactNode> = [
    <>
      {LL.AccountMigration.explainerStep1()}
      <Text style={styles.link} onPress={handleLearnMore}>
        {LL.AccountMigration.explainerStep1Link()}
      </Text>
    </>,
    LL.AccountMigration.explainerStep2(),
    LL.AccountMigration.explainerStep3(),
  ]

  return (
    <MigrationExplainerLayout
      icon="key-outline"
      iconColor={colors.grey3}
      title={LL.AccountMigration.explainerTitle()}
      steps={steps}
      ctaTitle={LL.AccountMigration.letsMove()}
      onCtaPress={() => navigation.navigate("sparkBackupMethodScreen")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  link: {
    textDecorationLine: "underline",
    color: colors.black,
  },
}))
