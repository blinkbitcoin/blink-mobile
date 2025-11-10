import React from "react"

import { MockedProvider } from "@apollo/client/testing"
import { Text, useTheme } from "@rn-vui/themed"
import { Meta } from "@storybook/react-native"

import { Story, StoryScreen, UseCase } from "../../.storybook/views"

const textVariations = ["h1", "h2", "p1", "p2", "p3", "p4"] as const

export default {
  title: "Theme text",
  component: Text,
  decorators: [
    (Story) => (
      <MockedProvider>
        <StoryScreen>{Story()}</StoryScreen>
      </MockedProvider>
    ),
  ],
} as Meta<typeof Text>

export const Default = () => {
  const {
    theme: { colors },
  } = useTheme()
  return (
    <Story>
      {textVariations.map((variation) => (
        <UseCase key={variation} text={variation}>
          <Text type={variation}>Some text</Text>
          <Text type={variation} bold>
            Some bold text
          </Text>
          <Text type={variation} color={colors.primary} bold>
            Some colorful text
          </Text>
        </UseCase>
      ))}
    </Story>
  )
}
