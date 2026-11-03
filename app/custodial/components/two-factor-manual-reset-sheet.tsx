import React from "react"
import { View } from "react-native"
import Modal from "react-native-modal"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { RichText } from "@app/components/rich-text"
import { useContactSupport } from "@app/hooks/use-contact-support"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type TwoFactorManualResetSheetProps = {
  isVisible: boolean
  /** Close, a swipe down, the backdrop and the Android back. */
  onClose: () => void
}

type StyleProps = {
  bottomInset: number
}

/** Where the authenticator is mandatory it is not turned off in the app: support resets
 *  it, and the sheet says how to reach them. */
export const TwoFactorManualResetSheet: React.FC<TwoFactorManualResetSheetProps> = ({
  isVisible,
  onClose,
}) => {
  const { bottom } = useSafeAreaInsets()
  const styles = useStyles({ bottomInset: bottom })
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { openSupport } = useContactSupport()

  return (
    <Modal
      isVisible={isVisible}
      style={styles.modal}
      backdropOpacity={0.8}
      backdropColor={colors.white}
      backdropTransitionOutTiming={0}
      swipeDirection={["down"]}
      onSwipeComplete={onClose}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      {...testProps("two-factor-manual-reset-sheet")}
    >
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <GaloyIcon name="info" size={32} color={colors.primary} />
        <Text type="h2" bold style={styles.title}>
          {LL.TwoFactorTurnOff.manualResetTitle()}
        </Text>
        <RichText
          text={LL.TwoFactorTurnOff.manualResetBody()}
          tags={{ support: { style: styles.supportLink, onPress: openSupport } }}
          style={styles.body}
        />
        <GaloyPrimaryButton
          title={LL.common.close()}
          onPress={onClose}
          containerStyle={styles.closeButton}
          {...testProps("two-factor-manual-reset-close")}
        />
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }, { bottomInset }: StyleProps) => ({
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  sheet: {
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: bottomInset + 20,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey3,
    marginBottom: 10,
  },
  title: {
    textAlign: "center",
    color: colors.black,
  },
  body: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
  },
  supportLink: {
    textDecorationLine: "underline",
    color: colors.black,
  },
  closeButton: {
    alignSelf: "stretch",
    marginTop: 10,
  },
}))
