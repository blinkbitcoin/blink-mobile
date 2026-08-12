import React from "react"
import { Pressable, View } from "react-native"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { SegmentedProgressBar } from "@app/components/segmented-progress-bar"
import type {
  SecurityScore,
  SecurityScoreLevel,
  SecuritySignalKey,
} from "@app/types/security-score"
import { useI18nContext } from "@app/i18n/i18n-react"

type SecurityScoreCardProps = {
  score: SecurityScore
  onSignalPress: (key: SecuritySignalKey) => void
}

type LevelPresentation = {
  label: () => string
  color: string
  icon: IconNamesType
}

export const SecurityScoreCard: React.FC<SecurityScoreCardProps> = ({
  score,
  onSignalPress,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const copy = LL.SecurityScreen.securityScore
  /** A Record keyed by the level, so a new level cannot ship without its icon. */
  const levels: Record<SecurityScoreLevel, LevelPresentation> = {
    low: { label: copy.levelLow, color: colors.error, icon: "warning" },
    medium: { label: copy.levelMedium, color: colors.warning, icon: "warning" },
    high: { label: copy.levelHigh, color: colors._green, icon: "check-circle" },
  }
  const level = levels[score.level]
  const headline = copy.title({ done: score.done, total: score.total })
  /** Sighted users read the level off the icon and the colour. Naming it in the
   *  label keeps that same reading available to a screen reader. */
  const headlineAccessibilityLabel = `${headline} - ${level.label()}`

  /**
   * Plain `testID`s rather than `testProps`: that helper also marks the node
   * `accessible`, and an accessible card would collapse into a single element,
   * hiding the rows' own buttons from a screen reader. Each row states its own
   * name and status through the text it already renders.
   */
  return (
    <View style={styles.container} testID="security-score-card">
      <View style={styles.surface}>
        <View
          style={styles.header}
          accessible
          accessibilityLabel={headlineAccessibilityLabel}
        >
          <GaloyIcon name={level.icon} size={20} color={level.color} />
          <Text type="p2" bold color={level.color} style={styles.headline}>
            {headline}
          </Text>
        </View>
        {score.signals.map((signal) => {
          const isPressable = !signal.done || signal.retriggerable
          const handlePress = isPressable ? () => onSignalPress(signal.key) : undefined
          const rowAccessibilityRole = isPressable ? "button" : "text"
          const statusLabel = signal.done ? copy.enabled() : copy.set()
          const statusColor = signal.done ? colors._green : colors.primary

          return (
            <Pressable
              key={signal.key}
              style={styles.row}
              onPress={handlePress}
              disabled={!isPressable}
              accessibilityRole={rowAccessibilityRole}
              testID={`security-score-${signal.key}`}
            >
              <Text type="p2" style={styles.signalLabel}>
                {copy.signals[signal.key]()}
              </Text>
              <Text type="p2" bold color={statusColor}>
                {statusLabel}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <SegmentedProgressBar
        total={score.total}
        filled={score.done}
        fillColor={level.color}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    rowGap: 20,
  },
  /** The mock paints this `grey7`, which on the black settings background is a
   *  6% step no eye resolves. `grey5` is the surface the rows above already sit
   *  on, so the card reads as one of them. */
  surface: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    rowGap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    marginBottom: 8,
  },
  /** Enlarged system text has to wrap rather than run into what shares its row,
   *  so every label yields while the gap keeps it clear of its neighbour. */
  headline: {
    flexShrink: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 12,
    paddingVertical: 6,
  },
  signalLabel: {
    flexShrink: 1,
  },
}))
