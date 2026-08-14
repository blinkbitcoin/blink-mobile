import * as React from "react"
import { View } from "react-native"

// Consume from a spec with:
//   jest.mock("react-native-modal", () => require("<relative>/helpers/react-native-modal-mock"))
const MockModal = ({
  children,
  isVisible,
}: {
  children: React.ReactNode
  isVisible: boolean
}) => (isVisible ? <View>{children}</View> : null)

export default MockModal
