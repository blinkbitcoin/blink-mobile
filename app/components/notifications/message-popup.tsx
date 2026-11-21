import React from "react"

import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"

import { GaloyIcon, IconNamesType } from "../atomic/galoy-icon"
import CustomModal from "../custom-modal/custom-modal"

type Props = {
  isVisible: boolean
  icon?: IconNamesType
  title: string
  text: string
  buttonTitle: string
  onButtonPress: () => void
  /** The close icon, the backdrop and the back button. */
  onClose: () => void
  onModalHide?: () => void
}

/**
 * The app's pop-up for a message (Figma `popup-modal`): an icon, a title that says what
 * happened, a line that says what to do next and one button. The global queue shows it
 * through `notifyModal`; a screen already inside a modal renders it itself, as iOS
 * presents a modal only from the one on top.
 */
export const MessagePopup: React.FC<Props> = ({
  isVisible,
  icon,
  title,
  text,
  buttonTitle,
  onButtonPress,
  onClose,
  onModalHide,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { LL } = useI18nContext()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onClose}
      onModalHide={onModalHide}
      closeIconButtonAccessibilityLabel={LL.common.close()}
      title={title}
      primaryButtonTitle={buttonTitle}
      primaryButtonOnPress={onButtonPress}
      image={icon && <GaloyIcon name={icon} size={52} color={colors.accent} />}
      body={
        <Text type="p2" style={styles.bodyText}>
          {text}
        </Text>
      }
    />
  )
}

const useStyles = makeStyles(() => ({
  bodyText: {
    textAlign: "center",
  },
}))
