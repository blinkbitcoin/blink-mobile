import { useReactiveVar } from "@apollo/client"
import * as React from "react"
import { StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native"
import { Button, Icon } from "react-native-elements"
import Modal from "react-native-modal"
import { SafeAreaView } from "react-native-safe-area-context"
// import Icon from "react-native-vector-icons/Ionicons"
import { modalNfcVisibleVar } from "../../graphql/client-only-query"
import NfcManager from "react-native-nfc-manager"
import { translate } from "../../i18n"
import { color } from "../../theme"
import { palette } from "../../theme/palette"
import type { ComponentType } from "../../types/jsx"

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignContent: "stretch",
  },

  buttonStyle: {
    backgroundColor: color.primary,
    marginHorizontal: 20,
    marginVertical: 10,
    width: 145,
  },

  icon: {
    height: 40,
    top: -40,
  },

  iconContainer: {
    height: 14,
  },

  scanIcon: {
    height: 40,
  },

  scanIconContainer: {
    height: 40,
  },

  message: {
    fontSize: 18,
    marginVertical: 8,
    color: palette.darkGrey,
  },

  modal: {
    flexGrow: 1,
    marginBottom: 0,
    marginHorizontal: 0,
  },

  modalBackground: {
    alignItems: "center",
    flex: 1,
    justifyContent: "space-around",
  },

  modalForeground: {
    alignItems: "center",
    backgroundColor: palette.white,
    paddingHorizontal: 20,
    paddingTop: 10,
  },

  touchable: {
    height: "100%",
    width: "100%",
  },
})

export const ModalNfc: ComponentType = () => {
  const isVisible = useReactiveVar(modalNfcVisibleVar)

  const dismiss = async () => {
    modalNfcVisibleVar(false)
    NfcManager.cancelTechnologyRequest()
  }

  React.useEffect(() => {
    if (!isVisible) {
      return
    }
  }, [isVisible])

  return (
    <Modal
      swipeDirection={["down"]}
      isVisible={isVisible}
      onSwipeComplete={dismiss}
      swipeThreshold={50}
      propagateSwipe
      style={styles.modal}
    >
      <View style={styles.modalBackground}>
        <TouchableWithoutFeedback onPress={dismiss}>
          <View style={styles.touchable} />
        </TouchableWithoutFeedback>
      </View>
      <SafeAreaView style={styles.modalForeground}>
        <View style={styles.iconContainer}>
          <Icon
            name="remove"
            size={72}
            color={palette.lightGrey}
            style={styles.icon}
          />
        </View>
        <Text style={styles.message}>Scan NFC Now</Text>
        <View style={styles.scanIconContainer}>
          <Icon
            name="scan-outline"
            size={40}
            color={palette.lightGrey}
            style={styles.scanIcon}
            type="ionicon"
          />
        </View>
        <View style={styles.buttonContainer}>
          <Button
            title={translate("common.cancel")}
            onPress={dismiss}
            buttonStyle={styles.buttonStyle}
          />
        </View>
      </SafeAreaView>
    </Modal>
  )
}
