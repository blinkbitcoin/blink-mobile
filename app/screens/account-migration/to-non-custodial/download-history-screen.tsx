import React, { useCallback, useState } from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useWalletOverviewScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getWalletIds } from "@app/graphql/wallets-utils"
import { useExportTransactionsCsv } from "@app/hooks/use-export-transactions-csv"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useMigrationCheckpoint } from "@app/screens/account-migration/hooks"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"

export const MigrationDownloadHistoryScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { getRouteForCheckpoint, loading: checkpointLoading } = useMigrationCheckpoint()

  const isAuthed = useIsAuthed()
  const { data } = useWalletOverviewScreenQuery({ skip: !isAuthed })
  const walletIds = getWalletIds(data?.me?.defaultAccount?.wallets)

  const { exportCsv } = useExportTransactionsCsv()
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const isBusy = checkpointLoading || isDownloading
  const secondaryButtonTitle = hasDownloaded ? LL.common.continue() : LL.common.skip()

  const goToNextStep = useCallback(() => {
    navigation.navigate(getRouteForCheckpoint())
  }, [navigation, getRouteForCheckpoint])

  const handleDownload = useCallback(async () => {
    setIsDownloading(true)
    try {
      await exportCsv(walletIds)
      setHasDownloaded(true)
    } catch (err) {
      reportError("Migration transaction history export", err)
    } finally {
      setIsDownloading(false)
    }
  }, [exportCsv, walletIds])

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View style={styles.content}>
          <IconHero
            icon="clock"
            iconColor={colors.primary}
            title={LL.AccountMigration.downloadHistoryTitle()}
            subtitle={LL.AccountMigration.downloadHistoryBody()}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.AccountMigration.downloadHistoryDownloadCta()}
            loading={isDownloading}
            disabled={isBusy}
            onPress={handleDownload}
            {...testProps("migration-download-history-cta")}
          />
          <GaloySecondaryButton
            title={secondaryButtonTitle}
            disabled={isBusy}
            onPress={goToNextStep}
            {...testProps("migration-download-history-continue")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
