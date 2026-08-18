import React from "react"

/**
 * react-native-modal renders through a native Modal host that react-test-renderer
 * never mounts, so its children are invisible to queries. This stand-in keeps the
 * contract the app depends on — children when open, nothing when closed, and both
 * dismissal handlers reachable — and renders them inline where the testing library
 * can find them.
 *
 * `custom-modal.tsx` wires onBackdropPress and onBackButtonPress to toggleModal, so
 * they are exposed as pressables with the testIDs the modal specs already query:
 * `backdrop` and `back-button`. A stand-in that dropped them would silently delete
 * that coverage from any spec adopting it.
 *
 * react-native is resolved through jest.requireActual rather than a top-level
 * import: a consuming spec that mocks react-native to stub Platform or Dimensions
 * would otherwise get its mocked View inside the modal body, changing the rendered
 * tree in ways unrelated to the component under test.
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
const RN = jest.requireActual<typeof import("react-native")>("react-native")

export type ModalMockProps = {
  children?: React.ReactNode
  isVisible?: boolean
  onBackdropPress?: () => void
  onBackButtonPress?: () => void
}

export const ModalMock = ({
  children,
  isVisible,
  onBackdropPress,
  onBackButtonPress,
}: ModalMockProps) =>
  isVisible
    ? React.createElement(
        RN.View,
        { testID: "modal" },
        React.createElement(RN.Pressable, {
          testID: "backdrop",
          onPress: onBackdropPress,
        }),
        React.createElement(RN.Pressable, {
          testID: "back-button",
          onPress: onBackButtonPress,
        }),
        children,
      )
    : null

ModalMock.displayName = "ModalMock"

export default ModalMock
