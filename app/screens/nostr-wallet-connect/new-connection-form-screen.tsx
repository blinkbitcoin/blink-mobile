import React, { useMemo } from "react"
import { ScrollView, View } from "react-native"

import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import Animated from "react-native-reanimated"
import Svg, { Line } from "react-native-svg"

import { useDashedLineFlow } from "@app/components/animations"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { DropdownComponent } from "@app/components/card-screen/dropdown"
import { InputField } from "@app/components/card-screen/input-field"
import { Screen } from "@app/components/screen"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"

import { useNewConnection, useNwcConnections } from "./hooks"

const AnimatedLine = Animated.createAnimatedComponent(Line)

const BUDGET_VALUES = [100, 1_000, 10_000, 100_000]

export const NwcNewConnectionFormScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { addConnection } = useNwcConnections()
  const { appName, setAppName, dailyBudgetSats, selectBudget, isValid } =
    useNewConnection()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { animatedProps: animatedLineProps, dashArray } = useDashedLineFlow()

  const budgetDropdownOptions = useMemo(
    () =>
      BUDGET_VALUES.map((value) => ({
        value: String(value),
        label: formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(value) }),
      })),
    [formatMoneyAmount],
  )

  const handleConnect = () => {
    const connection = addConnection(appName, dailyBudgetSats)
    navigation.navigate("nwcConnectionCreated", {
      connectionString: connection.connectionString,
      appName: connection.appName,
    })
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.indicatorRow}>
          <GaloyIcon name="blink-bitcoin-circle" size={52} color={colors.black} />
          <View style={styles.lineContainer}>
            <Svg height={1} width="100%">
              <AnimatedLine
                x1="0"
                y1="0.5"
                x2="100%"
                y2="0.5"
                stroke={colors.grey2}
                strokeWidth={1}
                strokeDasharray={dashArray}
                animatedProps={animatedLineProps}
              />
            </Svg>
            <View style={styles.chainCircle}>
              <GaloyIcon name="chain" size={11} color={colors.grey2} />
            </View>
          </View>
          <GaloyIcon name="app-grid-circle" size={52} color={colors.grey5} />
        </View>

        <InputField
          label={LL.NostrWalletConnect.appNameLabel()}
          value={appName}
          onChangeText={setAppName}
          placeholder={LL.NostrWalletConnect.appNamePlaceholder()}
          rightIcon="pencil"
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{LL.NostrWalletConnect.dailyBudget()}</Text>
          <DropdownComponent
            options={budgetDropdownOptions}
            selectedValue={String(dailyBudgetSats)}
            onValueChange={(value) => selectBudget(Number(value))}
          />
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.NostrWalletConnect.connectWallet()}
          disabled={!isValid}
          onPress={handleConnect}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    width: 213,
    alignSelf: "center",
  },
  lineContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chainCircle: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldGroup: {
    gap: 3,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
