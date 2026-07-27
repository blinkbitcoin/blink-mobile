import * as React from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

/** Sized against the design mock rather than the CustomModal defaults, which run a smaller
 *  icon and larger type than this modal's artboard: normalised against card width, the mock
 *  puts the eye at ~14.5%, the title band at ~7.2% and the body line pitch at ~7.1%. */
const ICON_SIZE = 56
const TITLE_FONT_SIZE = 28
const BODY_FONT_SIZE = 18
const BODY_LINE_HEIGHT = 25
/** CustomModal leaves only 10pt under the title; the mock's gap is roughly three times that. */
const BODY_TOP_GAP = 12
/** Likewise, the mock breathes more under the eye than CustomModal's 20pt image padding. */
const ICON_BOTTOM_GAP = 8

type UsdbPrivacyWarningModalProps = {
  isVisible: boolean
  /** Dismissing counts as acknowledging: the warning is informational, and re-showing it on
   *  every render of the same screen would make Receive and Transfer unusable. */
  onAcknowledge: () => void
}

export const UsdbPrivacyWarningModal: React.FC<UsdbPrivacyWarningModalProps> = ({
  isVisible,
  onAcknowledge,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onAcknowledge}
      image={
        <View style={styles.icon}>
          <GaloyIcon name="eye" size={ICON_SIZE} color={colors.primary} />
        </View>
      }
      title={LL.UsdbPrivacyWarning.title()}
      titleFontSize={TITLE_FONT_SIZE}
      titleMaxWidth="100%"
      body={<Text style={styles.body}>{LL.UsdbPrivacyWarning.body()}</Text>}
      primaryButtonTitle={LL.UsdbPrivacyWarning.acknowledge()}
      primaryButtonOnPress={onAcknowledge}
      showCloseIconButton={true}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  icon: {
    marginBottom: ICON_BOTTOM_GAP,
  },
  body: {
    fontSize: BODY_FONT_SIZE,
    lineHeight: BODY_LINE_HEIGHT,
    marginTop: BODY_TOP_GAP,
    textAlign: "center",
    color: colors.black,
  },
}))
