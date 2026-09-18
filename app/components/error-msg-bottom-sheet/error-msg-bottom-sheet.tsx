import React from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { BottomSheet } from "@app/components/bottom-sheet"
import { IconHero } from "@app/components/icon-hero"
import { useErrorHaptic } from "@app/hooks/use-error-haptic"
import { makeStyles, useTheme } from "@rn-vui/themed"

type ErrorMsgBottomSheetProps = {
  isVisible: boolean
  onClose: () => void
  title: string
  body: string
  primaryLabel: string
  onPrimaryPress: () => void
  /** A second way on, under the action, for a warning the user may accept. */
  secondaryLabel?: string
  onSecondaryPress?: () => void
  testID?: string
}

/**
 * Figma's `error-msg-bottom-sheet` (Send 3.0, blink-wip#1275): something the
 * user can't fix on the screen they are on, told as a title, a body and the one
 * action that resolves it. A warning the user may accept adds that as a secondary action. It sits on top of the screen's inline error rather
 * than replacing it, so the error is still there once the sheet is dismissed.
 *
 * It rests on its content and doesn't expand: messages are short. Swiping it
 * down, pressing the scrim or Android back closes it without taking the action.
 *
 * Opening buzzes the error haptic, which makes the sheet the one buzz even when an inline
 * error appears with it.
 */
export const ErrorMsgBottomSheet: React.FC<ErrorMsgBottomSheetProps> = ({
  isVisible,
  onClose,
  title,
  body,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  testID,
}) => {
  const { bottom } = useSafeAreaInsets()
  const styles = useStyles({ bottom })
  const {
    theme: { colors },
  } = useTheme()
  useErrorHaptic(isVisible || undefined)

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      restsOnHeader
      expandable={false}
      testID={testID}
      header={
        <View style={styles.content}>
          <IconHero
            icon="warning"
            iconColor={colors.warning}
            title={title}
            subtitle={body}
          />
          <View style={styles.actions}>
            <GaloyPrimaryButton title={primaryLabel} onPress={onPrimaryPress} />
            {secondaryLabel && onSecondaryPress ? (
              <GaloySecondaryButton title={secondaryLabel} onPress={onSecondaryPress} />
            ) : null}
          </View>
        </View>
      }
    >
      {null}
    </BottomSheet>
  )
}

const useStyles = makeStyles((_, { bottom }: { bottom: number }) => ({
  // Figma: 20 at the sides and 20 under the CTA, above the home indicator.
  content: {
    paddingHorizontal: 20,
    paddingBottom: bottom + 20,
    gap: 24,
  },
  actions: {
    gap: 10,
  },
}))
