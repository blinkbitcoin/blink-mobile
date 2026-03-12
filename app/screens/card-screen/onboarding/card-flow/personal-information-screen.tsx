import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { DropdownComponent } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  MOCK_ACCOUNT_PURPOSE_OPTIONS,
  MOCK_ANNUAL_SALARY_OPTIONS,
  MOCK_EXPECTED_MONTHLY_VOLUME_OPTIONS,
  MOCK_OCCUPATION_OPTIONS,
} from "../onboarding-mock-data"

export const CardPersonalInformationScreen: React.FC = () => {
  const styles = useStyles()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [selectedOccupation, setSelectedOccupation] = React.useState<string>()
  const [annualSalaryRange, setAnnualSalaryRange] = React.useState<string>()
  const [accountPurpose, setAccountPurpose] = React.useState<string>()
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)

  const allFieldsSelected =
    selectedOccupation && annualSalaryRange && accountPurpose && expectedMonthlyVolume

  const handleNext = () => {
    if (!allFieldsSelected) return
    setLoading(true)

    // Mock delay — replace with actual API call when backend is ready
    setTimeout(() => {
      setLoading(false)
      navigation.navigate("cardOnboardingProcessingScreen")
    }, 500)
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.CardFlow.Onboarding.PersonalInformation.fields.occupation.label()}
            </Text>
            <DropdownComponent
              options={MOCK_OCCUPATION_OPTIONS}
              selectedValue={selectedOccupation}
              onValueChange={setSelectedOccupation}
              placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.occupation.placeholder()}
              testID={LL.CardFlow.Onboarding.PersonalInformation.fields.occupation.placeholder()}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.CardFlow.Onboarding.PersonalInformation.fields.annualSalaryRange.label()}
            </Text>
            <DropdownComponent
              options={MOCK_ANNUAL_SALARY_OPTIONS}
              selectedValue={annualSalaryRange}
              onValueChange={setAnnualSalaryRange}
              placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.annualSalaryRange.placeholder()}
              testID={LL.CardFlow.Onboarding.PersonalInformation.fields.annualSalaryRange.placeholder()}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.CardFlow.Onboarding.PersonalInformation.fields.accountPurpose.label()}
            </Text>
            <DropdownComponent
              options={MOCK_ACCOUNT_PURPOSE_OPTIONS}
              selectedValue={accountPurpose}
              onValueChange={setAccountPurpose}
              placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.accountPurpose.placeholder()}
              testID={LL.CardFlow.Onboarding.PersonalInformation.fields.accountPurpose.placeholder()}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.CardFlow.Onboarding.PersonalInformation.fields.expectedMonthlyVolume.label()}
            </Text>
            <DropdownComponent
              options={MOCK_EXPECTED_MONTHLY_VOLUME_OPTIONS}
              selectedValue={expectedMonthlyVolume}
              onValueChange={setExpectedMonthlyVolume}
              placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.expectedMonthlyVolume.placeholder()}
              testID={LL.CardFlow.Onboarding.PersonalInformation.fields.expectedMonthlyVolume.placeholder()}
            />
          </View>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={
            allFieldsSelected
              ? LL.CardFlow.Onboarding.PersonalInformation.buttonText()
              : LL.CardFlow.Onboarding.PersonalInformation.select()
          }
          onPress={handleNext}
          disabled={!allFieldsSelected || loading}
          loading={loading}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 15,
  },
  contentContainer: {
    gap: 20,
  },
  inputContainer: {
    gap: 6,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
