import React from "react"
import { View } from "react-native"
import { Text, useTheme } from "@rn-vui/themed"

import { SelectableOptionRow, InfoCard } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"

import { Issue, IssueType } from "./types"
import { useSharedStepStyles } from "./shared-styles"

type ReportIssueStepProps = {
  selectedIssue: IssueType | null
  onSelectIssue: (issue: IssueType) => void
}

export const ReportIssueStep: React.FC<ReportIssueStepProps> = ({
  selectedIssue,
  onSelectIssue,
}) => {
  const styles = useSharedStepStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {LL.CardFlow.ReplaceCard.ReportIssue.cardManagement()}
        </Text>
        <SettingsGroup
          containerStyle={styles.settingsGroupContainer}
          dividerStyle={styles.dividerStyle}
          items={[
            () => (
              <SelectableOptionRow
                icon="question"
                iconColor={colors.primary}
                title={LL.CardFlow.ReplaceCard.ReportIssue.lostCard()}
                subtitle={LL.CardFlow.ReplaceCard.ReportIssue.lostCardDescription()}
                isSelected={selectedIssue === Issue.Lost}
                onPress={() => onSelectIssue(Issue.Lost)}
              />
            ),
            () => (
              <SelectableOptionRow
                icon="shield"
                iconColor={colors.error}
                title={LL.CardFlow.ReplaceCard.ReportIssue.stolenCard()}
                subtitle={LL.CardFlow.ReplaceCard.ReportIssue.stolenCardDescription()}
                isSelected={selectedIssue === Issue.Stolen}
                onPress={() => onSelectIssue(Issue.Stolen)}
              />
            ),
            () => (
              <SelectableOptionRow
                icon="error"
                iconColor={colors.warning}
                title={LL.CardFlow.ReplaceCard.ReportIssue.damagedCard()}
                subtitle={LL.CardFlow.ReplaceCard.ReportIssue.damagedCardDescription()}
                isSelected={selectedIssue === Issue.Damaged}
                onPress={() => onSelectIssue(Issue.Damaged)}
              />
            ),
          ]}
        />
      </View>

      <InfoCard
        title={LL.CardFlow.ReplaceCard.ReportIssue.whatHappensNext()}
        bulletItems={[
          LL.CardFlow.ReplaceCard.ReportIssue.bullet1(),
          LL.CardFlow.ReplaceCard.ReportIssue.bullet2(),
          LL.CardFlow.ReplaceCard.ReportIssue.bullet3(),
        ]}
        showIcon={false}
        size="lg"
        bulletSpacing={1}
      />
    </>
  )
}
