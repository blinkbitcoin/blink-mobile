import * as React from "react"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { ScrollView, View } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { DropdownComponent, DropdownOption } from "@app/components/dropdown"
import { useState } from "react"

export const CardPersonalInformationScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [selectedOccupation, setSelectedOccupation] = useState<string>()
  const [annualSalaryRange, setAnnualSalaryRange] = useState<string>()
  const [accountPurpose, setAccountPurpose] = useState<string>()
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState<string>()

  const occupationOptions: DropdownOption[] = [
    { value: "Test 0", label: "Test 0" },
    { value: "Test 1", label: "Test 1" },
    {
      value: "Test 2",
      label: "Test 2",
    },
    { value: "Test 3", label: "Test 3" },
  ]

  const handleNext = () => {
    navigation.navigate("cardPreapprovedScreen")
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
              options={occupationOptions}
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
              options={occupationOptions}
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
              options={occupationOptions}
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
          title={LL.PersonalInformationScreen.buttonText()}
          onPress={handleNext}
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
