import { OnboardingStatus } from "@app/graphql/generated"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { IconNamesType } from "@app/components/atomic/galoy-icon"

type PersonalDetailsTranslations = TranslationFunctions["CardFlow"]["PersonalDetails"]

type KycBannerConfig = {
  icon: IconNamesType
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
        icon: "shield",
        title: translations.kycVerifiedInformation(),
        description: translations.kycVerifiedDescription(),
        color: colors.success,
      }
    case OnboardingStatus.Processing:
      return {
        icon: "loading",
        title: translations.kycPendingTitle(),
        description: translations.kycPendingDescription(),
        color: colors.warning,
      }
    case OnboardingStatus.Review:
      return {
        icon: "loading",
        title: translations.kycUnderReviewTitle(),
        description: translations.kycUnderReviewDescription(),
        color: colors.warning,
      }
    case OnboardingStatus.Declined:
      return {
        icon: "error",
        title: translations.kycDeclinedTitle(),
        description: translations.kycDeclinedDescription(),
        color: colors.error,
      }
    case null:
    case OnboardingStatus.NotStarted:
      return {
        icon: "info",
        title: translations.kycNotStartedTitle(),
        description: translations.kycNotStartedDescription(),
        color: colors.info,
      }
    case OnboardingStatus.AwaitingInput:
      return {
        icon: "warning-circle",
        title: translations.kycAwaitingInputTitle(),
        description: translations.kycAwaitingInputDescription(),
        color: colors.warning,
      }
    case OnboardingStatus.Error:
    case OnboardingStatus.Abandoned:
    default:
      return {
        icon: "warning-circle",
        title: translations.kycErrorTitle(),
        description: translations.kycErrorDescription(),
        color: colors.error,
      }
  }
}
