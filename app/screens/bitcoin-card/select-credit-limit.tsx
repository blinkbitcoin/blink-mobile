import * as React from "react"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { ScrollView, View, TouchableOpacity } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

const CREDIT_LIMITS = [1000, 2500, 5000, 10000, 50000]

export const SelectCreditLimit: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [selectedLimit, setSelectedLimit] = React.useState<number | null>(null)

  const handleNext = () => {
    if (selectedLimit) {
      navigation.navigate("termSheetScreem")
    }
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon
                name={"cash-outline"}
                type="ionicon"
                color={colors._green}
                size={35}
              />
            </View>
          </View>

          <Text type="h2" style={styles.title}>
            {LL.CardCreditLimit.desiredCreditLimit()}
          </Text>

          <View style={styles.limitsContainer}>
            {CREDIT_LIMITS.map((limit, index) => (
              <TouchableOpacity
                key={limit}
                style={[
                  styles.limitOption,
                  selectedLimit === limit && styles.limitOptionSelected,
                ]}
                onPress={() => setSelectedLimit(limit)}
              >
                <Text type="p2" style={[styles.limitText]}>
                  ${limit.toLocaleString()}
                </Text>
                {index < CREDIT_LIMITS.length - 1 && (
                  <View style={styles.limitBgOptionSelected}></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.common.next()}
          onPress={handleNext}
          disabled={!selectedLimit}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 60,
  },
  contentContainer: {
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    marginBottom: 15,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 50,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 40,
    textAlign: "center",
  },
  limitsContainer: {
    width: "100%",
  },
  limitOption: {
    position: "relative",
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: colors.transparent,
    overflow: "hidden",
    justifyContent: "center",
  },
  limitOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.grey6,
    borderRadius: 8,
  },
  limitBgOptionSelected: {
    width: "97%",
    height: 1,
    backgroundColor: colors.grey4,
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  limitText: {
    color: colors.grey0,
    paddingLeft: 10,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
