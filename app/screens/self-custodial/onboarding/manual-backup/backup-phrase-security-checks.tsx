import React, { useState } from "react"
import { View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { RevealedCheckboxList } from "@app/components/revealed-checkbox-list"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type Props = {
  onContinue: () => void
}

export const BackupPhraseSecurityChecks: React.FC<Props> = ({ onContinue }) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [allChecked, setAllChecked] = useState(false)

  const checkLabels = [
    LL.BackupScreen.ManualBackup.Alerts.check1(),
    LL.BackupScreen.ManualBackup.Alerts.check2(),
    LL.BackupScreen.ManualBackup.Alerts.check3(),
  ]

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View style={styles.content}>
          <IconHero
            icon="eye-slash"
            iconColor={colors.primary}
            title={LL.BackupScreen.ManualBackup.Alerts.title()}
          />
          <RevealedCheckboxList
            labels={checkLabels}
            testIdPrefix="backup-alert-check"
            onAllCheckedChange={setAllChecked}
          />
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.common.continue()}
            disabled={!allChecked}
            onPress={onContinue}
            {...testProps("backup-alerts-continue")}
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
