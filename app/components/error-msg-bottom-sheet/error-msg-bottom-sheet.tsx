import React from "react"
import { View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BottomSheet } from "@app/components/bottom-sheet"
import { IconHero } from "@app/components/icon-hero"
import { makeStyles, useTheme } from "@rn-vui/themed"

type ErrorMsgBottomSheetProps = {
  isVisible: boolean
  onClose: () => void
  title: string
  body: string
  primaryLabel: string
  onPrimaryPress: () => void
  testID?: string
}

/**
 * Figma's `error-msg-bottom-sheet` (Send 3.0, blink-wip#1275): something the
 * user can't fix on the screen they are on, told as a title, a body and the one
 * action that resolves it. It sits on top of the screen's inline error rather
 * than replacing it, so the error is still there once the sheet is dismissed.
 *
 * It rests on its content and doesn't expand: messages are short. Swiping it
 * down, pressing the scrim or Android back closes it without taking the action.
 */
export const ErrorMsgBottomSheet: React.FC<ErrorMsgBottomSheetProps> = ({
  isVisible,
  onClose,
  title,
  body,
  primaryLabel,
  onPrimaryPress,
  testID,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      restsOnHeader
      expandable={false}
      testID={testID}
      header={
        // Measured in the sheet's own window rather than read from the app root: on
        // Android the modal window already stops above the navigation bar, and the
        // root inset would count it twice.
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.content}>
            <IconHero
              icon="warning"
              iconColor={colors.warning}
              title={title}
              subtitle={body}
            />
            <GaloyPrimaryButton title={primaryLabel} onPress={onPrimaryPress} />
          </View>
        </SafeAreaView>
      }
    >
      {null}
    </BottomSheet>
  )
}

const useStyles = makeStyles(() => ({
  // Figma: button group 10 above the CTA, 20 below it, 20 at the sides.
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 24,
  },
}))
