import React from "react"
import { Pressable, View } from "react-native"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import type {
  SecurityScore,
  SecurityScoreLevel,
  SecuritySignalKey,
} from "@app/hooks/use-security-score"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type SecurityScoreCardProps = {
  score: SecurityScore
  onSignalPress: (key: SecuritySignalKey) => void
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
  const levelLabel: Record<SecurityScoreLevel, string> = {
    low: copy.levelLow(),
    medium: copy.levelMedium(),
    high: copy.levelHigh(),
  }
  const levelColor: Record<SecurityScoreLevel, string> = {
    low: colors.error,
    medium: colors.warning,
    high: colors._green,
  }
  const headerColor = levelColor[score.level]

  return (
    <View style={styles.container} {...testProps("security-score-card")}>
      <View style={styles.header}>
        <GaloyIcon
          name={score.level === "high" ? "check-circle" : "warning"}
          size={20}
          color={headerColor}
        />
        <Text type="p2" bold style={{ color: headerColor }}>
          {copy.title({ done: score.done, total: score.total })} -{" "}
          {levelLabel[score.level]}
        </Text>
      </View>
      {score.signals.map((signal) => {
        const pressable = !signal.done || signal.retriggerable
        return (
          <Pressable
            key={signal.key}
            style={styles.row}
            onPress={pressable ? () => onSignalPress(signal.key) : undefined}
            disabled={!pressable}
            {...testProps(`security-score-${signal.key}`)}
          >
            <Text type="p2">{copy.signals[signal.key]()}</Text>
            {signal.done ? (
              <View style={styles.status}>
                <Text type="p2" bold color={colors._green}>
                  {copy.enabled()}
                </Text>
                <GaloyIcon name="check-circle" size={16} color={colors._green} />
              </View>
            ) : (
              <Text type="p2" bold color={colors.warning}>
                {copy.set()}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
  },
}))
