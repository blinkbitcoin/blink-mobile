import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { useAppSelector } from "@app/store/redux"

import { SettingsRow } from "../row"

export const ImportWallet: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { isAdvanceMode } = useAppSelector((state) => state.settings)

  if (isAdvanceMode) {
    return (
      <SettingsRow
        title={LL.SettingsScreen.importWallet()}
        leftIcon="grid-outline"
        action={() => navigate("ImportWalletOptions", { insideApp: true })}
      />
    )
  } else {
    return null
  }
}
