import type * as React from "react"

/**
 * Visibility-only stand-in for react-native-modal, consumed from a spec with:
 *   jest.mock("react-native-modal", () =>
 *     jest.requireActual("../../helpers/react-native-modal-mock"),
 *   )
 * react-native is resolved through requireActual so the rendered body is unaffected
 * by any react-native mock the consuming spec installs. Modals that need dismissal
 * handlers or that capture the props they receive keep their own inline mock.
 */
const ReactNs = jest.requireActual<typeof import("react")>("react")
const RN = jest.requireActual<typeof import("react-native")>("react-native")

const MockModal = ({
  children,
  isVisible,
}: {
  children: React.ReactNode
  isVisible: boolean
}) => (isVisible ? ReactNs.createElement(RN.View, null, children) : null)

export default MockModal
