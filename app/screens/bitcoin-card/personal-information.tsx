import * as React from "react"
import { makeStyles, Text } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { ScrollView, View } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { DropdownComponent, DropdownOption } from "@app/components/dropdown"
import { useState } from "react"

export const CardPersonalInformationScreen: React.FC = () => {
  const styles = useStyles()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [selectedOccupation, setSelectedOccupation] = useState<string>()
  const [annualSalaryRange, setAnnualSalaryRange] = useState<string>()
  const [accountPurpose, setAccountPurpose] = useState<string>()
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState<string>()

  const occupationOptions: DropdownOption[] = [
    { value: "15-1132", label: "Software Developers, Applications" },
    { value: "11-1021", label: "General and Operations Managers" },
    { value: "29-1141", label: "Registered Nurses" },
    { value: "25-2021", label: "Elementary School Teachers" },
    { value: "41-3099", label: "Sales Representatives, Services" },
    { value: "13-2011", label: "Accountants and Auditors" },
    { value: "43-6014", label: "Secretaries and Administrative Assistants" },
    { value: "47-2031", label: "Carpenters" },
    { value: "53-3032", label: "Heavy and Tractor-Trailer Truck Drivers" },
    { value: "35-3031", label: "Waiters and Waitresses" },
  ]

  const annualSalaryOptions: DropdownOption[] = [
    { value: "Less than 25,000", label: "Less than $25,000" },
    { value: "25,000 - 49,999", label: "$25,000 - $49,999" },
    { value: "50,000 - 74,999", label: "$50,000 - $74,999" },
    { value: "75,000 - 99,999", label: "$75,000 - $99,999" },
    { value: "100,000 - 149,999", label: "$100,000 - $149,999" },
    { value: "150,000 - 249,999", label: "$150,000 - $249,999" },
    { value: "250,000 or more", label: "$250,000 or more" },
  ]

  const accountPurposeOptions: DropdownOption[] = [
    { value: "Personal spending", label: "Personal spending" },
    { value: "Business card", label: "Business card" },
    { value: "Other", label: "Other" },
  ]

  const expectedMonthlyVolumeOptions: DropdownOption[] = [
    { value: "Less than 1,000", label: "Less than $1,000" },
    { value: "1,000 - 1,999", label: "$1,000 - $1,999" },
    { value: "2,000 - 2,999", label: "$2,000 - $2,999" },
    { value: "3,000 or more", label: "$3,000 or more" },
  ]

  const allFieldsSelected =
    selectedOccupation && annualSalaryRange && accountPurpose && expectedMonthlyVolume

  const handleNext = () => {
    if (!allFieldsSelected) return
    navigation.navigate("cardProcessingScreen")
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.PersonalInformationScreen.fields.occupation.label()}
            </Text>
            <DropdownComponent
              options={occupationOptions}
              selectedValue={selectedOccupation}
              onValueChange={setSelectedOccupation}
              placeholder={LL.PersonalInformationScreen.fields.occupation.placeholder()}
              testID={LL.PersonalInformationScreen.fields.occupation.placeholder()}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.PersonalInformationScreen.fields.annualSalaryRange.label()}
            </Text>
            <DropdownComponent
              options={annualSalaryOptions}
              selectedValue={annualSalaryRange}
              onValueChange={setAnnualSalaryRange}
              placeholder={LL.PersonalInformationScreen.fields.annualSalaryRange.placeholder()}
              testID={LL.PersonalInformationScreen.fields.annualSalaryRange.placeholder()}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.PersonalInformationScreen.fields.accountPurpose.label()}
            </Text>
            <DropdownComponent
              options={accountPurposeOptions}
              selectedValue={accountPurpose}
              onValueChange={setAccountPurpose}
              placeholder={LL.PersonalInformationScreen.fields.accountPurpose.placeholder()}
              testID={LL.PersonalInformationScreen.fields.accountPurpose.placeholder()}
            />
          </View>
          <View style={styles.inputContainer}>
            <Text type="p2">
              {LL.PersonalInformationScreen.fields.expectedMonthlyVolume.label()}
            </Text>
            <DropdownComponent
              options={expectedMonthlyVolumeOptions}
              selectedValue={expectedMonthlyVolume}
              onValueChange={setExpectedMonthlyVolume}
              placeholder={LL.PersonalInformationScreen.fields.expectedMonthlyVolume.placeholder()}
              testID={LL.PersonalInformationScreen.fields.expectedMonthlyVolume.placeholder()}
            />
          </View>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={
            !allFieldsSelected
              ? LL.PersonalInformationScreen.select()
              : LL.PersonalInformationScreen.buttonText()
          }
          onPress={handleNext}
          disabled={!allFieldsSelected}
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
