import { StackNavigationProp } from "@react-navigation/stack"
import * as React from "react"
// eslint-disable-next-line react-native/split-platform-components
import { StyleSheet} from "react-native"
import { Screen } from "../../components/screen"
import { PrimaryStackParamList } from "../../navigation/stack-param-lists"
import { ScreenType } from "../../types/jsx"
import { palette } from "../../theme/palette"

import useMainQuery from "@app/hooks/use-main-query"
import { WebView } from 'react-native-webview'


const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.lighterGrey,
    flex: 1,
  }

})

type Props = {
  navigation: StackNavigationProp<PrimaryStackParamList, "Map">
}

export const MapScreen: ScreenType = ({ navigation }: Props) => {
  const { userPreferredLanguage } = useMainQuery()

  return (
    <Screen style={styles.screen}>
      <WebView
        style={styles.screen}
        source={{
          uri: `https://maps.bitcoinjungle.app?fromBJ=true&lang=${userPreferredLanguage}`,
          headers: {
            'x-bj-wallet': "true",
          },
        }} />
    </Screen>
  )
}
