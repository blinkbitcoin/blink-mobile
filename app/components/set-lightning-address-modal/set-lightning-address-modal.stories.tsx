import React, { useState } from "react"
import { View } from "react-native"

import { Meta } from "@storybook/react"

import { StoryScreen } from "../../../.storybook/views"
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button"
import {
  SetLightningAddressModalUI,
  SetLightningAddressModalUIProps,
} from "./set-lightning-address-modal"

const SetLNAddressWithToggle: React.FC<SetLightningAddressModalUIProps> = (props) => {
  const [isVisible, setIsVisible] = useState(true)
  const toggleModal = () => setIsVisible(!isVisible)

  return (
    <View>
      <SetLightningAddressModalUI
        {...props}
        isVisible={isVisible}
        toggleModal={toggleModal}
      />
      <GaloyPrimaryButton title={"Open modal"} onPress={toggleModal} />
    </View>
  )
}

export default {
  title: "Set lightning address modal",
  component: SetLightningAddressModalUI,
  decorators: [(Story) => <StoryScreen>{Story()}</StoryScreen>],
} as Meta<typeof SetLightningAddressModalUI>

export const Default = () => {
  return (
    <SetLNAddressWithToggle
      isVisible={true}
      toggleModal={() => {}}
      onSetLightningAddress={console.log}
      loading={false}
      lnAddress="Testing"
      setLnAddress={console.log}
      error=""
      hostname="blink.sv"
      bankName="Blink"
    />
  )
}

export const Error = () => {
  return (
    <SetLNAddressWithToggle
      isVisible={true}
      toggleModal={() => {}}
      onSetLightningAddress={console.log}
      lnAddress=""
      setLnAddress={console.log}
      loading={false}
      error="This is an error message"
      hostname="blink.sv"
      bankName="Blink"
    />
  )
}
