import React from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { BackupPhraseSecurityChecks } from "./backup-phrase-security-checks"

export const ViewBackupSecurityChecksScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  return (
    <BackupPhraseSecurityChecks
      onContinue={() => navigation.navigate("selfCustodialViewBackupPhrase")}
    />
  )
}
