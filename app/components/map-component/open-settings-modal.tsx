import React from "react"
import { View } from "react-native"
import { openSettings } from "react-native-permissions"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

/*
  the forwardRef and useImperativeHandle (in the parent) are used here to toggle the modal
  without causing a re-render of the parent, which would cause the mega-heavy MapView to rerender,
  and would result in wrecking the modal enter animation
*/

export type OpenSettingsElement = { toggleVisibility: () => void }

export const OpenSettingsModal = React.forwardRef<
  OpenSettingsElement,
  Record<never, never>
>(function ConfirmDialog(_, ref): JSX.Element {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const [isVisible, toggleVisible] = React.useState<boolean>(false)

  React.useImperativeHandle(ref, () => ({
    toggleVisibility() {
      toggleVisible(!isVisible)
    },
  }))

  async function navToSettings() {
    toggleVisible(false)
    await openSettings()
  }

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={() => toggleVisible(!isVisible)}
      title={LL.MapScreen.navToSettingsTitle()}
      image={<GaloyIcon name="info" size={100} color={colors.primary3} />}
      body={
        <View style={styles.body}>
          <Text type={"p2"} style={styles.warningText}>
            {LL.MapScreen.navToSettingsText()}
          </Text>
        </View>
      }
      primaryButtonOnPress={navToSettings}
      primaryButtonTitle={LL.MapScreen.openSettings()}
      secondaryButtonTitle={LL.common.back()}
      secondaryButtonOnPress={() => toggleVisible(!isVisible)}
    />
  )
})

const useStyles = makeStyles(() => ({
  warningText: {
    textAlign: "center",
  },
  body: {
    rowGap: 12,
  },
}))
