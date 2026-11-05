import React from "react"
import { ActivityIndicator, TextInput, View } from "react-native"
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

const PANEL_IN_MS = 200
const PANEL_OUT_MS = 150

export type DirectionFilter = {
  sent: boolean
  received: boolean
}

export const ALL_DIRECTIONS: DirectionFilter = { sent: true, received: true }

/**
 * Turns one direction on or off. Both can't be off: switching off the last one that is on
 * brings both back, which is the same as showing everything.
 */
export const toggleDirection = (
  current: DirectionFilter,
  direction: keyof DirectionFilter,
): DirectionFilter => {
  const next = { ...current, [direction]: !current[direction] }
  return next.sent || next.received ? next : ALL_DIRECTIONS
}

type Props = {
  directions: DirectionFilter
  onToggleDirection: (direction: keyof DirectionFilter) => void
  searchText: string
  onSearchTextChange: (text: string) => void
}

/** Figma `filter-wrap`: the Sent / Received tabs over the search field. */
export const TransactionHistoryFilters: React.FC<Props> = ({
  directions,
  onToggleDirection,
  searchText,
  onSearchTextChange,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <Animated.View
      entering={FadeInUp.duration(PANEL_IN_MS)}
      exiting={FadeOutUp.duration(PANEL_OUT_MS)}
      style={styles.panel}
      testID="transaction-history-filters"
    >
      <View style={styles.tabs}>
        <GaloyTertiaryButton
          {...testProps("filter-sent")}
          accessibilityLabel={LL.TransactionScreen.sent()}
          title={LL.TransactionScreen.sent()}
          unfilled={!directions.sent}
          onPress={() => onToggleDirection("sent")}
          accessibilityState={{ selected: directions.sent }}
        />
        <GaloyTertiaryButton
          {...testProps("filter-received")}
          accessibilityLabel={LL.TransactionScreen.received()}
          title={LL.TransactionScreen.received()}
          unfilled={!directions.received}
          onPress={() => onToggleDirection("received")}
          accessibilityState={{ selected: directions.received }}
        />
      </View>
      <View style={styles.search}>
        <GaloyIcon name="magnifying-glass" size={16} color={colors.grey2} />
        <TextInput
          {...testProps("transaction-history-search")}
          accessibilityLabel={LL.common.search()}
          style={styles.searchInput}
          value={searchText}
          onChangeText={onSearchTextChange}
          placeholder={LL.TransactionScreen.searchPlaceholder()}
          placeholderTextColor={colors.grey2}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </Animated.View>
  )
}

/**
 * Figma `transaction-2026` empty state: one card under the wallet card. While older
 * payments are still being loaded to search through, it says so with a spinner.
 */
export const NoResultsCard: React.FC<{ expanding: boolean }> = ({ expanding }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <View style={styles.noResults} testID="transaction-history-no-results">
      {expanding ? <ActivityIndicator size="small" /> : null}
      <Text style={styles.noResultsText}>
        {expanding
          ? LL.TransactionScreen.expandingSearch()
          : LL.TransactionScreen.nothingCameBack()}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  panel: {
    rowGap: 10,
  },
  tabs: {
    flexDirection: "row",
    columnGap: 5,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.grey5,
  },
  searchInput: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 0,
    fontSize: 14,
    lineHeight: 18,
    color: colors.black,
  },
  noResults: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.grey7,
  },
  noResultsText: {
    fontSize: 18,
    lineHeight: 24,
    color: colors.black,
    textAlign: "center",
  },
}))
