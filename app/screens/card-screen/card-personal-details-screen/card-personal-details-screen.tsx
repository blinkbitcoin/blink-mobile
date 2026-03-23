import React from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import {
  AvatarInitial,
  ContactSupportRow,
  InfoCard,
  InputField,
  SettingItemRow,
} from "@app/components/card-screen"
import { IconTextButton } from "@app/components/icon-text-button"
import { Screen } from "@app/components/screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { OnboardingStatus } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { getKycBannerConfig } from "./get-kyc-banner-config"
import { usePersonalDetailsData } from "./hooks"

export const CardPersonalDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const LLPersonalDetails = LL.CardFlow.PersonalDetails

  const {
    firstName,
    lastName,
    fullName,
    onboardingStatus,
    email,
    phone,
    // TODO: uncomment when shipping address section is enabled
    // shippingAddress,
    loading,
  } = usePersonalDetailsData()

  const kycBanner = getKycBannerConfig({
    status: onboardingStatus,
    translations: LLPersonalDetails,
    colors: {
      success: colors._green,
      warning: colors.warning,
      error: colors.error,
      info: colors.primary,
    },
  })

  const handleChangeKycInformation = () => {
    // TODO: replace with real KYC action when is available
    console.log("Change KYC information pressed")
  }

  /*
   * TODO: uncomment when shipping address section is enabled
   * const handleEditShippingAddress = () => {
   *   navigation.navigate("cardShippingAddressScreen")
   * }
   */

  if (loading) {
    return (
      <Screen preset="scroll">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <AvatarInitial name={fullName} />
          <View style={styles.nameContainer}>
            <Text style={styles.fullName}>{fullName}</Text>
            <Text style={styles.cardholderLabel}>
              {LLPersonalDetails.blinkVisaCardholder()}
            </Text>
          </View>
        </View>

        <InfoCard
          icon={kycBanner.icon}
          title={kycBanner.title}
          description={kycBanner.description}
          titleColor={kycBanner.color}
          iconColor={kycBanner.color}
        />

        {onboardingStatus === OnboardingStatus.Approved && (
          <IconTextButton
            icon="refresh"
            label={LLPersonalDetails.changeKycInformation()}
            onPress={handleChangeKycInformation}
          />
        )}

        <InputField label={LLPersonalDetails.firstName()} value={firstName} />

        <InputField label={LLPersonalDetails.lastName()} value={lastName} />

        {/*
         * TODO: uncomment when dateOfBirth is available via the API
         * <InputField
         *   label={LLPersonalDetails.dateOfBirth()}
         *   value={...}
         * />
         */}

        <SettingsGroup
          name={LLPersonalDetails.contactInformation()}
          titleStyle={styles.sectionTitle}
          dividerStyle={styles.dividerStyle}
          items={[
            () => <SettingItemRow title={email} rightIcon={null} />,
            () => <SettingItemRow title={phone} rightIcon={null} />,
          ]}
        />

        {/*
         * TODO: uncomment when registeredAddress is available via the API
         * <View style={styles.section}>
         *   <Text style={styles.sectionTitle}>{LLPersonalDetails.registeredAddress()}</Text>
         *   <MultiLineField
         *     lines={addressToLines(...)}
         *     leftIcon="map-pin"
         *   />
         * </View>
         */}

        {/*
         * TODO: uncomment when shipping address section is enabled
         * {shippingAddress && (
         *   <View style={styles.section}>
         *     <Text style={styles.sectionTitle}>{LLPersonalDetails.shippingAddress()}</Text>
         *     <MultiLineField
         *       lines={addressToLines(shippingAddress)}
         *       leftIcon="map-pin"
         *       rightIcon="pencil"
         *       onPress={handleEditShippingAddress}
         *     />
         *   </View>
         * )}
         */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{LL.common.support()}</Text>
          <ContactSupportRow rightIconColor={colors.primary} />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
