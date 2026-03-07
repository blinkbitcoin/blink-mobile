import { OnboardingStatus } from "@app/graphql/generated"
import { TranslationFunctions } from "@app/i18n/i18n-types"

type PersonalDetailsTranslations = TranslationFunctions["CardFlow"]["PersonalDetails"]

type KycBannerConfig = {
  ionicon: string
  title: string
  description: string
  color: string
}

type GetKycBannerConfigParams = {
  status: OnboardingStatus | null
  translations: PersonalDetailsTranslations
  colors: { success: string; warning: string; error: string; info: string }
}

export const getKycBannerConfig = ({
  status,
  translations,
  colors,
}: GetKycBannerConfigParams): KycBannerConfig => {
  switch (status) {
    case OnboardingStatus.Approved:
      return {
        ionicon: "shield-checkmark-outline",
        title: translations.kycVerifiedInformation(),
        description: translations.kycVerifiedDescription(),
        color: colors.success,
      }
    case OnboardingStatus.Processing:
      return {
        ionicon: "time-outline",
        title: translations.kycPendingTitle(),
        description: translations.kycPendingDescription(),
        color: colors.warning,
      }
    case OnboardingStatus.Review:
      return {
        ionicon: "time-outline",
        title: translations.kycUnderReviewTitle(),
        description: translations.kycUnderReviewDescription(),
        color: colors.warning,
      }
    case OnboardingStatus.Declined:
      return {
        ionicon: "close-circle-outline",
        title: translations.kycDeclinedTitle(),
        description: translations.kycDeclinedDescription(),
        color: colors.error,
      }
    case null:
    case OnboardingStatus.NotStarted:
      return {
        ionicon: "information-circle-outline",
        title: translations.kycNotStartedTitle(),
        description: translations.kycNotStartedDescription(),
        color: colors.info,
      }
    case OnboardingStatus.AwaitingInput:
      return {
        ionicon: "alert-circle-outline",
        title: translations.kycAwaitingInputTitle(),
        description: translations.kycAwaitingInputDescription(),
        color: colors.warning,
      }
    case OnboardingStatus.Error:
    case OnboardingStatus.Abandoned:
    default:
      return {
        ionicon: "alert-circle-outline",
        title: translations.kycErrorTitle(),
        description: translations.kycErrorDescription(),
        color: colors.error,
      }
  }
}
