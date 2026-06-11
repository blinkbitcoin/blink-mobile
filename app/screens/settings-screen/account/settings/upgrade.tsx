import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { SettingsRow } from "../../row"

export const UpgradeAccountLevelOne: React.FC = () => {
  const { currentLevel } = useLevel()
  const { LL } = useI18nContext()

  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  if (currentLevel !== AccountLevel.One) return null

  return (
    <SettingsRow
      title={LL.AccountScreen.identityVerification()}
      leftGaloyIcon="upgrade"
      action={() => navigate("fullOnboardingFlow")}
    />
  )
}
