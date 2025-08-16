import React from "react"

import { MockedProvider } from "@apollo/client/testing"
import { Meta } from "@storybook/react"

import { StoryScreen } from "../../../.storybook/views"
import { SectionCompleted } from "./section-completed"

const route = {
  key: "SectionCompleted",
  name: "sectionCompleted",
  params: {
    amount: 12,
    sectionTitle: "Bitcoin: What is it?",
    isAvailable: true,
  },
} as const

export default {
  title: "SectionCompleted",
  component: SectionCompleted,
  decorators: [
    (Story) => (
      <MockedProvider>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
} as Meta<typeof SectionCompleted>

export const Default = () => <SectionCompleted route={route} />
