import React, { useCallback, useState } from "react"
import { TouchableOpacity, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { StatementItem, SwitchRow } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { YearSelector } from "@app/components/year-selector"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"

import {
  DEFAULT_YEAR,
  MOCK_STATEMENTS,
  MOCK_YEAR_OPTIONS,
} from "./card-statements-mock-data"

export const CardStatementsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { feedbackEmailAddress } = useRemoteConfig()

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const currentStatement = MOCK_STATEMENTS.find((s) => s.isCurrent)
  const monthlyStatements = MOCK_STATEMENTS.filter((s) => s.year === selectedYear)

  const getStatementsLabel = useCallback(
    (count: number): string => {
      if (count === 0) return LL.CardFlow.CardStatements.noStatements()
      return LL.CardFlow.CardStatements.statementsCount({ count: count.toString() })
    },
    [LL],
  )

  const handleDownload = (statementId: string) => {
    console.log("Download statement:", statementId)
  }

  const handleDownloadAll = () => {
    console.log("Download all statements")
  }

  const handleContactSupport = () => {
    console.log("Contact support")
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {LL.CardFlow.CardStatements.selectYear()}
          </Text>
          <YearSelector
            years={MOCK_YEAR_OPTIONS}
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            itemLabel={getStatementsLabel}
          />
        </View>

        {currentStatement && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {LL.CardFlow.CardStatements.currentStatement()}
            </Text>
            <View style={styles.currentStatementCard}>
              <View style={styles.currentStatementColumn}>
                <Text style={styles.currentStatementLabel}>
                  {LL.CardFlow.CardStatements.statementPeriod()}
                </Text>
                <Text style={styles.currentStatementValue}>
                  {currentStatement.period}
                </Text>
              </View>
              <View style={styles.currentStatementColumn}>
                <Text style={styles.currentStatementLabel}>
                  {LL.CardFlow.CardStatements.totalSpent()}
                </Text>
                <Text style={styles.currentStatementValue}>
                  {currentStatement.totalSpent}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {LL.CardFlow.CardStatements.monthlyStatements()}
          </Text>
          <View style={styles.statementsContainer}>
            <TouchableOpacity
              style={styles.downloadAllButton}
              onPress={handleDownloadAll}
              accessibilityRole="button"
              accessibilityLabel={LL.CardFlow.CardStatements.downloadAll()}
            >
              <GaloyIcon name="download" size={16} color={colors.primary} />
              <Text style={styles.downloadAllText}>
                {LL.CardFlow.CardStatements.downloadAll()}
              </Text>
            </TouchableOpacity>

            {monthlyStatements.map((statement) => (
              <StatementItem
                key={statement.id}
                title={`${statement.month} ${statement.year}`}
                subtitle1={
                  statement.isCurrent
                    ? LL.CardFlow.CardStatements.spent({ amount: statement.totalSpent })
                    : statement.period
                }
                subtitle2={
                  statement.isCurrent
                    ? undefined
                    : LL.CardFlow.CardStatements.transactions({
                        count: statement.transactionCount.toString(),
                        amount: statement.totalSpent,
                      })
                }
                onDownload={() => handleDownload(statement.id)}
                isDownloaded={statement.isDownloaded}
              />
            ))}
          </View>
        </View>

        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>
            {LL.CardFlow.CardStatements.aboutStatements()}
          </Text>
          <View style={styles.bulletList}>
            {[
              LL.CardFlow.CardStatements.aboutBullet1(),
              LL.CardFlow.CardStatements.aboutBullet2(),
              LL.CardFlow.CardStatements.aboutBullet3(),
            ].map((text, index) => (
              <View key={index} style={styles.bulletItem}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{LL.common.notifications()}</Text>
          <SettingsGroup
            containerStyle={styles.settingsGroupContainer}
            items={[
              () => (
                <SwitchRow
                  title={LL.CardFlow.CardStatements.notifyNewStatements()}
                  value={notificationsEnabled}
                  onValueChange={() => setNotificationsEnabled(!notificationsEnabled)}
                />
              ),
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{LL.common.support()}</Text>
          <TouchableOpacity
            style={styles.supportCard}
            onPress={handleContactSupport}
            accessibilityRole="button"
            accessibilityLabel={LL.AppUpdate.contactSupport()}
          >
            <GaloyIcon name="contact-support" size={16} color={colors.black} />
            <View style={styles.supportInfo}>
              <Text style={styles.supportTitle}>{LL.AppUpdate.contactSupport()}</Text>
              <Text style={styles.supportEmail}>{feedbackEmailAddress}</Text>
            </View>
            <GaloyIcon name="caret-right" size={16} color={colors.black} />
          </TouchableOpacity>
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
  section: {
    gap: 3,
  },
  sectionLabel: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  currentStatementCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 18,
    gap: 14,
    minHeight: 89,
  },
  currentStatementColumn: {
    flex: 1,
  },
  currentStatementLabel: {
    color: colors.grey2,
    fontSize: 12,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 18,
  },
  currentStatementValue: {
    color: colors.black,
    fontSize: 18,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: 24,
  },
  statementsContainer: {
    gap: 14,
  },
  downloadAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 8,
  },
  downloadAllText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "600",
    lineHeight: 20,
  },
  aboutCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  aboutTitle: {
    color: colors.black,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 22,
  },
  bulletList: {
    gap: 4,
  },
  bulletItem: {
    flexDirection: "row",
    gap: 8,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey2,
    marginTop: 9,
  },
  bulletText: {
    flex: 1,
    color: colors.grey2,
    fontSize: 16,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 22,
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: 8,
  },
  supportCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    color: colors.black,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  supportEmail: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
}))
