import { Platform } from "react-native"

import { TranslationFunctions } from "@app/i18n/i18n-types"

export const getCloudProviderName = (LL: TranslationFunctions): string =>
  Platform.OS === "ios"
    ? LL.SparkOnboarding.BackupMethod.appleICloud()
    : LL.SparkOnboarding.BackupMethod.googleDrive()
