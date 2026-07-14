import React, { useEffect, useRef, useState } from "react"
import { Animated, View, type ViewStyle } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { CheckboxRow } from "@app/components/checkbox-row"

const REVEAL_DURATION_MS = 300

type Props = {
  labels: readonly string[]
  testIdPrefix: string
  onAllCheckedChange: (areAllChecked: boolean) => void
}

/**
 * Acknowledgement checkboxes revealed one at a time: a box fades in once every
 * preceding box has been checked, and stays revealed thereafter. Owns the
 * checked state and reports when all boxes are checked so the caller can gate
 * its action.
 */
export const RevealedCheckboxList: React.FC<Props> = ({
  labels,
  testIdPrefix,
  onAllCheckedChange,
}) => {
  const styles = useStyles()
  const [checks, setChecks] = useState<readonly boolean[]>(() => labels.map(() => false))
  const [revealedCount, setRevealedCount] = useState(1)

  const areAllChecked = checks.every(Boolean)

  const reportRef = useRef(onAllCheckedChange)
  reportRef.current = onAllCheckedChange
  useEffect(() => {
    reportRef.current(areAllChecked)
  }, [areAllChecked])

  /** Reveal up to the first unchecked box; monotonic, so unchecking never re-hides. */
  useEffect(() => {
    const firstUnchecked = checks.findIndex((checked) => !checked)
    const target = firstUnchecked === -1 ? labels.length : firstUnchecked + 1
    setRevealedCount((current) => Math.max(current, target))
  }, [checks, labels.length])

  const toggle = (index: number) =>
    setChecks((prev) => prev.map((checked, i) => (i === index ? !checked : checked)))

  return (
    <View style={styles.list}>
      {labels.map((label, index) =>
        index < revealedCount ? (
          <RevealingCard key={label} style={styles.card}>
            <CheckboxRow
              label={label}
              isChecked={checks[index]}
              onPress={() => toggle(index)}
              testID={`${testIdPrefix}-${index}`}
            />
          </RevealingCard>
        ) : null,
      )}
    </View>
  )
}

const RevealingCard: React.FC<{ style: ViewStyle; children: React.ReactNode }> = ({
  style,
  children,
}) => {
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: REVEAL_DURATION_MS,
      useNativeDriver: true,
    }).start()
  }, [opacity])

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>
}

const useStyles = makeStyles(({ colors }) => ({
  list: {
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
}))
