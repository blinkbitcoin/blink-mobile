import * as React from "react"

import { Meta } from "@storybook/react"

import { StoryScreen, Story, UseCase } from "../../../.storybook/views"
import { SettingsGroup } from "./group"
import { SettingsRow } from "./row"

export default {
  title: "Settings",
  component: SettingsGroup,
  decorators: [(Story) => <StoryScreen>{Story()}</StoryScreen>],
} as Meta<typeof SettingsGroup>

const S1: React.FC = () => (
  <SettingsRow
    title="Non Tappable"
    action={null}
    leftGaloyIcon={"calculator"}
    rightIcon={null}
  />
)

const S2: React.FC = () => (
  <SettingsRow title="Right Arrowed" action={() => {}} leftGaloyIcon={"info"} />
)

export const Default = () => {
  return (
    <Story>
      <UseCase text="Group of Settings">
        <SettingsGroup name="Group" items={[S1, S2]} />
      </UseCase>
    </Story>
  )
}
