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
      navigation.navigate("Primary")
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
            {CREDIT_LIMITS.map((limit) => (
              <TouchableOpacity
                key={limit}
                style={[
                  styles.limitOption,
                  selectedLimit === limit && styles.limitOptionSelected,
                ]}
                onPress={() => setSelectedLimit(limit)}
              >
                <Text
                  type="p1"
                  style={[
                    styles.limitText,
                    selectedLimit === limit && styles.limitTextSelected,
                  ]}
                >
                  ${limit.toLocaleString()}
                </Text>
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
    width: "100%",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey4,
  },
  limitOptionSelected: {
    borderBottomColor: colors.primary,
  },
  limitText: {
    fontSize: 18,
    color: colors.grey0,
  },
  limitTextSelected: {
    color: colors._green,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
