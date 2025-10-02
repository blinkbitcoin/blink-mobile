import * as React from "react"
import { Text, View } from "react-native"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Button } from "@rn-vui/base"
import { makeStyles, useTheme } from "@rn-vui/themed"

import { CloseCross } from "../../components/close-cross"
import { MountainHeader } from "../../components/mountain-header"
import { Screen } from "../../components/screen"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import BadgerShovelBitcoin from "./badger-shovel-01.svg"

const useStyles = makeStyles(({ colors }) => ({
  bottomView: {
    backgroundColor: colors._lightBlue,
    flex: 1,
  },

  buttonStyle: {
    backgroundColor: colors._white,
    borderRadius: 32,
    marginTop: 24,
    width: "100%",
  },

  container: {
    alignItems: "center",
    backgroundColor: colors._lightBlue,
    flexGrow: 1,
  },

  divider: { flex: 0.5, minHeight: 30 },

  headerSection: {
    color: colors._white,
    fontSize: 16,
    paddingTop: 18,
  },

  titleSection: {
    color: colors._white,
    fontSize: 24,
    fontWeight: "bold",
    paddingTop: 6,
  },

  titleStyle: {
    color: colors._lightBlue,
    fontSize: 18,
    fontWeight: "bold",
    flex: 1,
    justifyContent: "center",
  },
}))

type Props = {
  route: RouteProp<RootStackParamList, "sectionCompleted">
}

export const SectionCompleted: React.FC<Props> = ({ route }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "sectionCompleted">>()

  const { amount, sectionTitle, isAvailable } = route.params
  const { LL } = useI18nContext()
  return (
    <Screen backgroundColor={colors._orange} unsafe>
      <MountainHeader
        amount={amount.toString()}
        color={colors._orange}
        isAvailable={isAvailable}
      />
      <View style={styles.container}>
        <View style={styles.divider} />
        <BadgerShovelBitcoin />
        <Text style={styles.headerSection}>{LL.EarnScreen.sectionsCompleted()}</Text>
        <Text style={styles.titleSection}>{sectionTitle}</Text>
        <Button
          title={LL.EarnScreen.keepDigging()}
          type="solid"
          buttonStyle={styles.buttonStyle}
          titleStyle={styles.titleStyle}
          onPress={() => navigation.navigate("Earn")}
        />
      </View>
      <View style={styles.bottomView} />
      <CloseCross color={colors._white} onPress={() => navigation.navigate("Earn")} />
    </Screen>
  )
}
