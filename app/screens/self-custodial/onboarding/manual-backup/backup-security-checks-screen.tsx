import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  MigrationCheckpoint,
  useMigrationBackupCheckpoint,
} from "@app/screens/account-migration/hooks"

import { BackupPhraseSecurityChecks } from "./backup-phrase-security-checks"

export const BackupSecurityChecksScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useMigrationBackupCheckpoint(MigrationCheckpoint.BackupAlerts)

  return (
    <BackupPhraseSecurityChecks
      onContinue={() =>
        navigation.navigate("selfCustodialBackupPhrase", { step: PhraseStep.First })
      }
    />
  )
}
