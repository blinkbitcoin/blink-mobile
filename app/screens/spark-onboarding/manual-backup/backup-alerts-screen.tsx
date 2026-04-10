import React, { useEffect, useRef, useState } from "react"
import { Animated, View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CheckboxRow } from "@app/components/checkbox-row"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { PhraseStep, RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"
import {
  MigrationCheckpoint,
  useMigrationCheckpoint,
} from "@app/screens/account-migration/hooks"

const ANIM_DURATION = 300

export const SparkBackupAlertsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const { saveCheckpoint } = useMigrationCheckpoint()

  useEffect(() => {
    saveCheckpoint(MigrationCheckpoint.BackupAlerts)
  }, [saveCheckpoint])

  const [checks, setChecks] = useState([false, false, false])
  const [visibleCount, setVisibleCount] = useState(1)
  const allChecked = checks.every(Boolean)

  const opacity2 = useRef(new Animated.Value(0)).current
  const opacity3 = useRef(new Animated.Value(0)).current

  const reveal = (opacityRef: Animated.Value) => {
    Animated.timing(opacityRef, {
      toValue: 1,
      duration: ANIM_DURATION,
      useNativeDriver: true,
    }).start()
  }

  const toggle = (index: number) => {
    setChecks((prev) => {
      const next = [...prev]
      next[index] = !next[index]
      return next
    })

    if (!checks[index]) {
      if (index === 0 && visibleCount < 2) {
        setVisibleCount(2)
        reveal(opacity2)
      }
      if (index === 1 && visibleCount < 3) {
        setVisibleCount(3)
        reveal(opacity3)
      }
    }
  }

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

          <View style={styles.checkboxList}>
            <View style={styles.checkboxCard}>
              <CheckboxRow
                label={checkLabels[0]}
                isChecked={checks[0]}
                onPress={() => toggle(0)}
                {...testProps("backup-alert-check-0")}
              />
            </View>

            {visibleCount >= 2 && (
              <Animated.View style={[styles.checkboxCard, { opacity: opacity2 }]}>
                <CheckboxRow
                  label={checkLabels[1]}
                  isChecked={checks[1]}
                  onPress={() => toggle(1)}
                  {...testProps("backup-alert-check-1")}
                />
              </Animated.View>
            )}

            {visibleCount >= 3 && (
              <Animated.View style={[styles.checkboxCard, { opacity: opacity3 }]}>
                <CheckboxRow
                  label={checkLabels[2]}
                  isChecked={checks[2]}
                  onPress={() => toggle(2)}
                  {...testProps("backup-alert-check-2")}
                />
              </Animated.View>
            )}
          </View>
        </View>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.common.continue()}
            disabled={!allChecked}
            onPress={() =>
              navigation.navigate("sparkBackupPhraseScreen", { step: PhraseStep.First })
            }
            {...testProps("backup-alerts-continue")}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  checkboxList: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  checkboxCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
