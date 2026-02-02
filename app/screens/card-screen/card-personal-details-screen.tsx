import React from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  AvatarInitial,
  ContactSupportRow,
  IconTextButton,
  InfoCard,
  MultiLineField,
  ReadOnlyField,
  SettingItemRow,
} from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"

import { MOCK_USER } from "./card-mock-data"

export const CardPersonalDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const handleChangeKycInformation = () => {
    console.log("Change KYC information pressed")
  }

  const handleEditShippingAddress = () => {
    console.log("Edit shipping address pressed")
  }

  const handleContactSupport = () => {
    console.log("Contact support pressed")
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <AvatarInitial name={MOCK_USER.fullName} />
          <View style={styles.nameContainer}>
            <Text style={styles.fullName}>{MOCK_USER.fullName}</Text>
            <Text style={styles.cardholderLabel}>
              {LL.CardFlow.PersonalDetails.blinkVisaCardholder()}
            </Text>
          </View>
        </View>

        <InfoCard
          ionicon="shield-checkmark-outline"
          title={LL.CardFlow.PersonalDetails.kycVerifiedInformation()}
          description={LL.CardFlow.PersonalDetails.kycVerifiedDescription()}
          titleColor={colors._green}
          iconColor={colors._green}
        />

        <IconTextButton
          icon="refresh"
          label={LL.CardFlow.PersonalDetails.changeKycInformation()}
          onPress={handleChangeKycInformation}
        />

        <ReadOnlyField
          label={LL.CardFlow.PersonalDetails.firstName()}
          value={MOCK_USER.firstName}
        />

        <ReadOnlyField
          label={LL.CardFlow.PersonalDetails.lastName()}
          value={MOCK_USER.lastName}
        />

        <ReadOnlyField
          label={LL.CardFlow.PersonalDetails.dateOfBirth()}
          value={MOCK_USER.dateOfBirth}
        />

        <SettingsGroup
          name={LL.CardFlow.PersonalDetails.contactInformation()}
          titleStyle={styles.sectionTitle}
          dividerStyle={styles.dividerStyle}
          items={[
            () => <SettingItemRow title={MOCK_USER.email} rightIcon={null} />,
            () => <SettingItemRow title={MOCK_USER.phone} rightIcon={null} />,
          ]}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {LL.CardFlow.PersonalDetails.registeredAddress()}
          </Text>
          <MultiLineField lines={MOCK_USER.registeredAddress} leftIcon="map-pin" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {LL.CardFlow.PersonalDetails.shippingAddress()}
          </Text>
          <MultiLineField
            lines={MOCK_USER.shippingAddress}
            leftIcon="map-pin"
            rightIcon="pencil"
            onPress={handleEditShippingAddress}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.common.support()}</Text>
          <ContactSupportRow
            onPress={handleContactSupport}
            rightIconColor={colors.primary}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  headerSection: {
    alignItems: "center",
    gap: 8,
  },
  nameContainer: {
    alignItems: "center",
  },
  fullName: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 20,
  },
  cardholderLabel: {
    color: colors.grey2,
    fontSize: 12,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 18,
  },
  section: {
    gap: 3,
  },
  sectionTitle: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  dividerStyle: {
    marginHorizontal: 18,
  },
}))
