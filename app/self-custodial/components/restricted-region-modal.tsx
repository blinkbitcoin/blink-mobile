import * as React from "react"
import { InAppBrowser } from "react-native-inappbrowser-reborn"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { RestrictedRegionBody } from "@app/components/restricted-region/restricted-region-body"

type RestrictedRegionModalProps = {
  isVisible: boolean
  onDismiss: () => void
}

/** Dismissible, because the local wallet stays usable behind it; closing never
 *  restores Blink-served features. */
export const RestrictedRegionModal: React.FC<RestrictedRegionModalProps> = ({
  isVisible,
  onDismiss,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onDismiss}
      showCloseIconButton={true}
      image={<GaloyIcon name="warning" size={80} color={colors.primary} />}
      title={LL.RestrictedRegion.title()}
      body={<RestrictedRegionBody style={styles.body} />}
      primaryButtonTitle={LL.common.close()}
      primaryButtonOnPress={onDismiss}
      secondaryButtonTitle={LL.RestrictedRegion.learnMore()}
      secondaryButtonOnPress={() => InAppBrowser.open(BLOCKED_COUNTRIES_FAQ_LINK)}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
}))
