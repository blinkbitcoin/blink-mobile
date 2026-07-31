import * as React from "react"
import { Linking } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type RestrictedRegionModalProps = {
  isVisible: boolean
  onDismiss: () => void
}

/** The non-custodial variant: dismissible, because the local wallet stays usable behind
 *  it; closing never restores Blink-served features. */
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
      image={<GaloyIcon name="warning" size={80} color={colors.warning} />}
      title={LL.RestrictedRegion.title()}
      body={
        <Text style={styles.body}>
          {LL.RestrictedRegion.body()}
          {"\n\n"}
          {LL.RestrictedRegion.bodyReturn()}
        </Text>
      }
      primaryButtonTitle={LL.common.close()}
      primaryButtonOnPress={onDismiss}
      secondaryButtonTitle={LL.RestrictedRegion.learnMore()}
      secondaryButtonOnPress={() => Linking.openURL(BLOCKED_COUNTRIES_FAQ_LINK)}
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
