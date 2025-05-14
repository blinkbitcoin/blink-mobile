import * as React from "react"
import { Text, View } from "react-native"
import { Button } from "react-native-elements"
import EStyleSheet from "react-native-extended-stylesheet"
import { CloseCross } from "../../components/close-cross"
import { Screen } from "../../components/screen"
import { palette } from "../../theme/palette"
import BadgerShovelBitcoin from "./badger-shovel-01.svg"
import { MountainHeader } from "../../components/mountain-header"
import { translate } from "../../i18n"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import { RouteProp } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import type { ScreenType } from "../../types/jsx"
import { SafeAreaView } from "react-native-safe-area-context"

const styles = EStyleSheet.create({
  bottomView: {
    backgroundColor: palette.lightBlue,
    flex: 1,
  },

  buttonStyle: {
    backgroundColor: palette.white,
    borderRadius: 32,
    marginTop: "24rem",
    width: "75%",
  },

  container: {
    alignItems: "center",
    backgroundColor: palette.lightBlue,
    flexGrow: 1,
  },

  divider: { flex: 0.5, minHeight: 30 },

  headerSection: {
    color: palette.white,
    fontSize: "16rem",
    paddingTop: "18rem",
  },

  titleSection: {
    color: palette.white,
    fontSize: "24rem",
    fontWeight: "bold",
    paddingTop: "6rem",
  },

  titleStyle: {
    color: palette.lightBlue,
    fontSize: "18rem",
    fontWeight: "bold",
    flex: 1,
    justifyContent: "center",
  },
})

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "sectionCompleted">
  route: RouteProp<RootStackParamList, "sectionCompleted">
}

export const SectionCompleted: ScreenType = ({ navigation, route }: Props) => {
  const { amount, sectionTitle } = route.params

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.white }}>
      <Screen backgroundColor={palette.orange} unsafe>
        <MountainHeader amount={amount.toString()} color={palette.orange} />
        <View style={styles.container}>
          <View style={styles.divider} />
          <BadgerShovelBitcoin />
          <Text style={styles.headerSection}>
            {translate("EarnScreen.sectionsCompleted")}
          </Text>
          <Text style={styles.titleSection}>{sectionTitle}</Text>
          <Button
            title={translate("EarnScreen.keepDigging")}
            type="solid"
            buttonStyle={styles.buttonStyle}
            titleStyle={styles.titleStyle}
            onPress={() => navigation.navigate("Earn")}
          />
        </View>
        <View style={styles.bottomView} />
        <CloseCross color={palette.white} onPress={() => navigation.navigate("Earn")} />
      </Screen>
    </SafeAreaView>
  )
}
