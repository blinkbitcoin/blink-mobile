import * as React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { DropdownComponent } from "@app/components/card-screen"
import { StepLayout } from "@app/components/step-layout"
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const [selectedOccupation, setSelectedOccupation] = React.useState<string>()
  const [annualSalaryRange, setAnnualSalaryRange] = React.useState<string>()
  const [accountPurpose, setAccountPurpose] = React.useState<string>()
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = React.useState<string>()

  const allFieldsSelected =
    selectedOccupation && annualSalaryRange && accountPurpose && expectedMonthlyVolume
  const isNextDisabled = !allFieldsSelected
  const nextButtonTitle = allFieldsSelected
    ? LL.common.continue()
    : LL.CardFlow.Onboarding.PersonalInformation.select()

  const handleNext = () => {
    if (!allFieldsSelected) return
    navigation.navigate("cardOnboardingAcknowledgementScreen")
  }

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={nextButtonTitle}
          onPress={handleNext}
          disabled={isNextDisabled}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.inputContainer}>
          <Text type="p3">
            {LL.CardFlow.Onboarding.PersonalInformation.fields.occupation.label()}
          </Text>
          <DropdownComponent
            options={MOCK_OCCUPATION_OPTIONS}
            selectedValue={selectedOccupation}
            onValueChange={setSelectedOccupation}
            placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.occupation.placeholder()}
            testID="occupation-dropdown"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text type="p3">
            {LL.CardFlow.Onboarding.PersonalInformation.fields.annualSalaryRange.label()}
          </Text>
          <DropdownComponent
            options={MOCK_ANNUAL_SALARY_OPTIONS}
            selectedValue={annualSalaryRange}
            onValueChange={setAnnualSalaryRange}
            placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.annualSalaryRange.placeholder()}
            testID="annual-salary-dropdown"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text type="p3">
            {LL.CardFlow.Onboarding.PersonalInformation.fields.accountPurpose.label()}
          </Text>
          <DropdownComponent
            options={MOCK_ACCOUNT_PURPOSE_OPTIONS}
            selectedValue={accountPurpose}
            onValueChange={setAccountPurpose}
            placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.accountPurpose.placeholder()}
            testID="account-purpose-dropdown"
          />
        </View>
        <View style={styles.inputContainer}>
          <Text type="p3">
            {LL.CardFlow.Onboarding.PersonalInformation.fields.expectedMonthlyVolume.label()}
          </Text>
          <DropdownComponent
            options={MOCK_EXPECTED_MONTHLY_VOLUME_OPTIONS}
            selectedValue={expectedMonthlyVolume}
            onValueChange={setExpectedMonthlyVolume}
            placeholder={LL.CardFlow.Onboarding.PersonalInformation.fields.expectedMonthlyVolume.placeholder()}
            testID="expected-monthly-spending-dropdown"
          />
        </View>
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(() => ({
  content: {
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 20,
  },
  inputContainer: {
    gap: 3,
  },
}))
