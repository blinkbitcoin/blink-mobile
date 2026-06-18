import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"

import { ButtonGroup } from "."
import { Story, UseCase } from "../../../.storybook/views"

export default {
  title: "ButtonGroup",
  component: ButtonGroup,
}

export const Default = () => {
  return (
    <Story>
      <UseCase text="Default">
        <ButtonGroup
          selectedId="paycode"
          onPress={() => {}}
          buttons={[
            {
              id: "invoice",
              text: "Invoice",
              icon: {
                selected: <GaloyIcon name="lightning" size={20} />,
                normal: <GaloyIcon name="lightning" size={20} />,
              },
            },
            {
              id: "paycode",
              text: "Paycode",
              icon: {
                selected: <GaloyIcon name="qr-code" size={20} />,
                normal: <GaloyIcon name="qr-code" size={20} />,
              },
            },
            {
              id: "onchain",
              text: "Onchain",
              icon: {
                selected: <GaloyIcon name="bitcoin" size={20} />,
                normal: <GaloyIcon name="bitcoin" size={20} />,
              },
            },
          ]}
        />
      </UseCase>
    </Story>
  )
}
