import React, { useCallback, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { YearSelector } from "@app/components/year-selector"
import { ContactSupportRow, InfoCard, StatementItem } from "@app/components/card-screen"
import { useI18nContext } from "@app/i18n/i18n-react"

import { useStatementsData } from "./hooks"

export const CardStatementsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  const { statements, yearOptions, currentYear, loading } = useStatementsData()

  const [selectedYear, setSelectedYear] = useState(currentYear)
  // TODO: uncomment when CardStatements notification category is available in blink core
  // const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const currentStatement = statements.find((s) => s.isCurrent)
  const monthlyStatements = statements.filter((s) => s.year === selectedYear)

  const getStatementsLabel = useCallback(
    (count: number): string => {
      if (count === 0) return LL.CardFlow.CardStatements.noStatements()
      return LL.CardFlow.CardStatements.statementsCount({ count: count.toString() })
    },
    [LL],
  )

  /*
   * TODO: uncomment when PDF download is available
   * const handleDownload = (statementId: string) => {
   *   console.log("Download statement:", statementId)
   * }
   *
   * const handleDownloadAll = () => {
   *   console.log("Download all statements")
   * }
   */

  if (loading) {
    return (
      <Screen preset="scroll">
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            testID="activity-indicator"
            size="large"
            color={colors.primary}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {LL.CardFlow.CardStatements.selectYear()}
          </Text>
          <YearSelector
            years={yearOptions}
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
            {/*
             * TODO: uncomment when PDF download is available
             * <IconTextButton
             *   icon="download"
             *   label={LL.CardFlow.CardStatements.downloadAll()}
             *   onPress={handleDownloadAll}
             * />
             */}

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
                /*
                 * TODO: uncomment when PDF download is available
                 * onDownload={() => handleDownload(statement.id)}
                 * isDownloaded={statement.isDownloaded}
                 */
              />
            ))}
          </View>
        </View>

        <InfoCard
          title={LL.CardFlow.CardStatements.aboutStatements()}
          bulletItems={[
            LL.CardFlow.CardStatements.aboutBullet1(),
            LL.CardFlow.CardStatements.aboutBullet2(),
            // TODO: uncomment when PDF download is available
            // LL.CardFlow.CardStatements.aboutBullet3(),
          ]}
          showIcon={false}
          size="lg"
          bulletSpacing={1}
        />

        {/*
         * TODO: uncomment when CardStatements notification category is available in blink core
         * <View style={styles.section}>
         *   <Text style={styles.sectionLabel}>{LL.common.notifications()}</Text>
         *   <SettingsGroup
         *     containerStyle={styles.settingsGroupContainer}
         *     items={[
         *       () => (
         *         <SwitchRow
         *           title={LL.CardFlow.CardStatements.notifyNewStatements()}
         *           value={notificationsEnabled}
         *           onValueChange={(value) => setNotificationsEnabled(value)}
         *         />
         *       ),
         *     ]}
         *   />
         * </View>
         */}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{LL.common.support()}</Text>
          <ContactSupportRow />
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
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: 8,
  },
}))
