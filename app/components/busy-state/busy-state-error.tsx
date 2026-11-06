import React, { useEffect } from "react"
import { AccessibilityInfo, View } from "react-native"

import { makeStyles, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { BusyStateBody } from "./busy-state-body"
import { BusyStateChip } from "./busy-state-chip"
import {
  BUTTONS_GAP,
  BUTTONS_TOP_PADDING,
  CHIP_GLYPH_SIZE,
  SCREEN_PADDING,
} from "./config"

/**
 * At least one way out is required. Hardware back is swallowed on this screen
 * unless it has `onBack` or `onClose` to call, so an error offering only
 * "Try Again" would trap a user whose retry keeps failing.
 */
type BusyStateErrorExit =
  | {
      /** Shows "Back". Also what Android's hardware back calls. */
      onBack: () => void
      /** Shows "Close". */
      onClose?: () => void
    }
  | {
      onBack?: () => void
      /** Shows "Close". Hardware back calls it when there is no `onBack`. */
      onClose: () => void
    }

export type BusyStateError = {
  title: string
  body?: string
  /** Shows "Try Again". */
  onRetry?: () => void
} & BusyStateErrorExit

type ErrorAction = {
  key: "retry" | "back" | "close"
  title: string
  onPress: () => void
}

/**
 * The failed state of `BusyStateScreen`: one `alert` chip in `colors.error`, the
 * caller's title and body, and a button for each handler passed.
 *
 * Buttons stack in a fixed order — Try Again, Back, Close — and the first one
 * present is the primary button; the rest are secondary. The button group is
 * pinned to the bottom over the body, as in Figma, so the title does not move
 * when a busy state turns into this one.
 */
export const BusyStateErrorView: React.FC<{ error: BusyStateError }> = ({ error }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  const { title, body, onRetry, onBack, onClose } = error

  const actions: ErrorAction[] = []
  if (onRetry)
    actions.push({ key: "retry", title: LL.common.tryAgain(), onPress: onRetry })
  if (onBack) actions.push({ key: "back", title: LL.common.back(), onPress: onBack })
  if (onClose) actions.push({ key: "close", title: LL.common.close(), onPress: onClose })

  // The same call on both platforms; `accessibilityRole="alert"` alone is not
  // announced by VoiceOver.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(body ? `${title}. ${body}` : title)
  }, [title, body])

  return (
    <View style={styles.container}>
      <BusyStateBody
        pictogram={
          <BusyStateChip
            icon={<GaloyIcon name="alert" size={CHIP_GLYPH_SIZE} color={colors.error} />}
          />
        }
        title={title}
        body={body}
        testIdPrefix="busy-state-error"
        textAccessibility={{ accessible: true, accessibilityRole: "alert" }}
      />

      {actions.length > 0 && (
        <View style={styles.buttons}>
          {actions.map(({ key, title: label, onPress }, index) =>
            index === 0 ? (
              <GaloyPrimaryButton
                key={key}
                title={label}
                onPress={onPress}
                containerStyle={styles.button}
                {...testProps(`busy-state-${key}`)}
              />
            ) : (
              <GaloySecondaryButton
                key={key}
                title={label}
                onPress={onPress}
                containerStyle={styles.button}
                {...testProps(`busy-state-${key}`)}
              />
            ),
          )}
        </View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  buttons: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: BUTTONS_GAP,
    paddingTop: BUTTONS_TOP_PADDING,
    paddingBottom: SCREEN_PADDING,
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.white,
  },
  button: {
    width: "100%",
  },
}))
