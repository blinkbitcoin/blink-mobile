import * as React from "react"

/**
 * Factory for a `@rn-vui/themed` mock whose CheckBox renders a TouchableOpacity
 * tagged `checkbox-checked` / `checkbox-unchecked`, so card-onboarding specs can
 * toggle and assert checkbox state. Returned from a function to stay jest.mock
 * hoist-safe: `jest.mock("@rn-vui/themed", () => mockThemedWithCheckbox())`.
 */
export const mockThemedWithCheckbox = () => {
  const actual = jest.requireActual("@rn-vui/themed")
  const { TouchableOpacity } = jest.requireActual("react-native")
  return {
    ...actual,
    CheckBox: ({
      checked,
      onPress,
      containerStyle,
    }: {
      checked: boolean
      onPress: () => void
      containerStyle?: object
    }) => (
      <TouchableOpacity
        testID={`checkbox-${checked ? "checked" : "unchecked"}`}
        onPress={onPress}
        style={containerStyle}
      />
    ),
  }
}
