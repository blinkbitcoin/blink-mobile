import * as React from "react"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { usePriceHistoryScreenQuery } from "@app/graphql/generated"
import { useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks/use-app-config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { isIos } from "@app/utils/helper"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles } from "@rn-vui/themed"

import { PriceHistory } from "../../components/price-history"
import { Screen } from "../../components/screen"

const useStyles = makeStyles((_theme) => ({
  screen: { flex: 1 },
  button: { margin: 20 },
}))

gql`
  query priceHistoryScreen {
    me {
      id
      defaultAccount {
        id
      }
    }
  }
`

export const PriceHistoryScreen: React.FC = () => {
  const { navigate } = useNavigation<StackNavigationProp<RootStackParamList, "Primary">>()
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { fiatUrl },
    },
  } = useAppConfig()

  const { data } = usePriceHistoryScreenQuery()
  const accountId = data?.me?.defaultAccount?.id

  const { isAtLeastLevelTwo } = useLevel()

  const [urlWebView, setUrlWebView] = React.useState(fiatUrl)
  React.useEffect(() => {
    setUrlWebView(`${fiatUrl}?accountId=${accountId}`)
  }, [accountId, fiatUrl])

  const styles = useStyles()

  return (
    <Screen preset="scroll" style={styles.screen}>
      <PriceHistory />
      {(isAtLeastLevelTwo || !isIos) && (
        <GaloyPrimaryButton
          title={LL.PriceHistoryScreen.buyAndSell()}
          onPress={() =>
            navigate("webView", {
              url: urlWebView,
              initialTitle: LL.PriceHistoryScreen.buyAndSell(),
            })
          }
          containerStyle={styles.button}
        />
      )}
    </Screen>
  )
}
