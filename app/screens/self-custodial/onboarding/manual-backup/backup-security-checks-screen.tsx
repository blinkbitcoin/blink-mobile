import React, { useEffect } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  MigrationCheckpoint,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"

import { BackupPhraseSecurityChecks } from "./backup-phrase-security-checks"

export const BackupSecurityChecksScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { saveCheckpoint } = useMigrationCheckpoint()

  useEffect(() => {
    saveCheckpoint(MigrationCheckpoint.BackupAlerts)
  }, [saveCheckpoint])

  return (
    <BackupPhraseSecurityChecks
      onContinue={() =>
        navigation.navigate("selfCustodialBackupPhrase", { step: PhraseStep.First })
      }
    />
  )
}
