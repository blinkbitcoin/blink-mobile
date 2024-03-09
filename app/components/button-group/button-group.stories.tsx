import * as React from "react"

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
            { id: "invoice", text: "Invoice", icon: "md-flash" },
            { id: "paycode", text: "Paycode", icon: "md-at" },
            { id: "onchain", text: "Onchain", icon: "logo-bitcoin" },
          ]}
        />
      </UseCase>
    </Story>
  )
}
