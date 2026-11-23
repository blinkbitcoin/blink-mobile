import React from "react"
import { AccessibilityProps, ScrollView, View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import {
  HEADING_TO_STATUS_GAP,
  ROW_TO_TEXT_GAP,
  ROW_TOP_PADDING,
  SCREEN_PADDING,
  TEXT_BLOCK_WIDTH,
} from "./config"

type BusyStateBodyProps = {
  /** The chip row. Hidden from screen readers: it is decorative. */
  pictogram: React.ReactNode
  title: string
  body?: string
  /** Prefixes the title and body test IDs, e.g. `busy-state` → `busy-state-title`. */
  testIdPrefix: string
  /** What the text block announces as: a progress bar while busy, an alert on error. */
  textAccessibility: AccessibilityProps
  /**
   * Height of whatever is pinned over the bottom of the screen, e.g. the error
   * buttons. Reserved at both ends, so the column stays centred on the screen
   * while it fits and scrolls clear of the overlay when it does not.
   */
  overlayInset?: number
}

/**
 * The centred column both busy and error states share: pictogram, then an always
 * bold `h2` title and an optional `p3` `grey1` body. Sharing it keeps the title
 * in the same place when a busy state turns into its error.
 *
 * The copy is the caller's and the font scale is the user's, so the column
 * scrolls once it outgrows the screen instead of running off it.
 */
export const BusyStateBody: React.FC<BusyStateBodyProps> = ({
  pictogram,
  title,
  body,
  testIdPrefix,
  textAccessibility,
  overlayInset = 0,
}) => {
  const styles = useStyles()

  return (
    <ScrollView
      contentContainerStyle={[
        styles.column,
        { paddingTop: overlayInset, paddingBottom: SCREEN_PADDING + overlayInset },
      ]}
      alwaysBounceVertical={false}
      testID={`${testIdPrefix}-scroll`}
    >
      <View
        style={styles.pictogram}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {pictogram}
      </View>

      <View style={styles.text} {...textAccessibility}>
        <Text type="h2" bold style={styles.title} testID={`${testIdPrefix}-title`}>
          {title}
        </Text>
        {body ? (
          <Text type="p3" style={styles.body} testID={`${testIdPrefix}-body`}>
            {body}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  column: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SCREEN_PADDING,
    gap: ROW_TO_TEXT_GAP,
  },
  pictogram: {
    paddingTop: ROW_TOP_PADDING,
  },
  text: {
    width: TEXT_BLOCK_WIDTH,
    maxWidth: "100%",
    gap: HEADING_TO_STATUS_GAP,
  },
  title: {
    color: colors.black,
    textAlign: "center",
  },
  body: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
