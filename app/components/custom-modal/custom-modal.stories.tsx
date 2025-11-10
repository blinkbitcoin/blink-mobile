import React, { useState } from "react"
import { Text, View } from "react-native"

import { MockedProvider } from "@apollo/client/testing"
import { makeStyles } from "@rn-vui/themed"

import { StoryScreen } from "../../../.storybook/views"
import { createCache } from "../../graphql/cache"
import { IsAuthedContextProvider } from "../../graphql/is-authed-context"
import mocks from "../../graphql/mocks"
import { GaloyIcon } from "../atomic/galoy-icon"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import CustomModal, { CustomModalProps } from "./custom-modal"

const useStyles = makeStyles(({ colors }) => ({
  modalBodyText: {
    fontSize: 20,
    fontWeight: "400",
    lineHeight: 24,
    color: colors.grey5,
    textAlign: "center",
    maxWidth: "80%",
  },
}))

const CustomModalWithToggle: React.FC<CustomModalProps> = (props) => {
  const [isVisible, setIsVisible] = useState(true)
  const toggleModal = () => setIsVisible(!isVisible)

  return (
    <View>
      <CustomModal {...props} isVisible={isVisible} toggleModal={toggleModal} />
      <GaloyPrimaryButton title={"Open modal"} onPress={toggleModal} />
    </View>
  )
}

export default {
  title: "Custom Modal",
  component: CustomModal,
  decorators: [
    (Story) => (
      <MockedProvider mocks={mocks} cache={createCache()}>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
}

export const Default = () => {
  const styles = useStyles()
  return (
    <IsAuthedContextProvider value={true}>
      <CustomModalWithToggle
        isVisible={true}
        toggleModal={() => {}}
        image={<GaloyIcon name="close-cross-with-background" size={100} />}
        title="Trial account creation failed"
        body={
          <Text style={styles.modalBodyText}>
            Unfortunately, we could not create Trial account on your device.
          </Text>
        }
        primaryButtonTitle="Explore wallet"
        primaryButtonOnPress={() => {}}
        secondaryButtonTitle="Register Phone Account"
        secondaryButtonOnPress={() => {}}
      />
    </IsAuthedContextProvider>
  )
}

export const LongContent = () => {
  const styles = useStyles()
  return (
    <IsAuthedContextProvider value={true}>
      <CustomModalWithToggle
        isVisible={true}
        toggleModal={() => {}}
        image={<GaloyIcon name="close-cross-with-background" size={100} />}
        title="Trial account creation failed"
        body={
          <Text style={styles.modalBodyText}>
            Unfortunately, we could not create Trial account on your device.
            Unfortunately, we could not create Trial account on your device.
            Unfortunately, we could not create Trial account on your device.
            Unfortunately, we could not create Trial account on your device.
            Unfortunately, we could not create Trial account on your device.
            Unfortunately, we could not create Trial account on your device.
          </Text>
        }
        primaryButtonTitle="Explore wallet"
        primaryButtonOnPress={() => {}}
        secondaryButtonTitle="Register Phone Account"
        secondaryButtonOnPress={() => {}}
      />
    </IsAuthedContextProvider>
  )
}

export const ShortContent = () => {
  const styles = useStyles()
  return (
    <IsAuthedContextProvider value={true}>
      <CustomModalWithToggle
        isVisible={true}
        toggleModal={() => {}}
        image={<GaloyIcon name="close-cross-with-background" size={100} />}
        title="Trial account creation failed"
        body={<Text style={styles.modalBodyText}></Text>}
        primaryButtonTitle="Explore wallet"
        primaryButtonOnPress={() => {}}
        secondaryButtonTitle="Register Phone Account"
        secondaryButtonOnPress={() => {}}
      />
    </IsAuthedContextProvider>
  )
}

export const WithNoSecondaryButton = () => {
  const styles = useStyles()
  return (
    <IsAuthedContextProvider value={true}>
      <CustomModalWithToggle
        isVisible={true}
        toggleModal={() => {}}
        image={<GaloyIcon name="warning-with-background" size={100} />}
        title="Trial account creation failed"
        body={<Text style={styles.modalBodyText}></Text>}
        primaryButtonTitle="Explore wallet"
        primaryButtonOnPress={() => {}}
      />
    </IsAuthedContextProvider>
  )
}
