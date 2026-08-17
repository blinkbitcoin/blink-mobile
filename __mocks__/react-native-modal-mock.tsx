import React from "react"
import { View } from "react-native"

/**
 * react-native-modal renders through a native Modal host that react-test-renderer
 * never mounts, so its children are invisible to queries. This stand-in keeps the
 * visibility contract — children when open, nothing when closed — and renders them
 * inline where the testing library can find them.
 *
 * Deliberately NOT named `react-native-modal.tsx`: a root __mocks__ file named
 * after the package is applied automatically to every suite, which would silently
 * change specs that render a real modal today. Opt in per spec instead:
 *
 *   jest.mock("react-native-modal", () => jest.requireActual("@mocks/react-native-modal-mock"))
 *
 * The `@mocks/` alias (jest.config.js moduleNameMapper, tsconfig paths) keeps the
 * wiring identical no matter how deep the spec file sits.
 */
export const ModalMock = ({
  children,
  isVisible,
}: {
  children?: React.ReactNode
  isVisible?: boolean
}) => (isVisible ? <View>{children}</View> : null)

export default ModalMock
