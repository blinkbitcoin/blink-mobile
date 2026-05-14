import React from "react"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { BackupPhraseSecurityChecks } from "./backup-phrase-security-checks"

export const SparkViewBackupAlertsScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  return (
    <BackupPhraseSecurityChecks
      onContinue={() => navigation.navigate("sparkViewBackupPhraseScreen")}
    />
  )
}
