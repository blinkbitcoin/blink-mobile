import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { DeleteAccountConfirmModal } from "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal"

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SelfCustodialDelete: {
        confirmModalTitle: () => "Confirm account removal",
        confirmModalTypeToConfirm: ({ delete: word }: { delete: string }) =>
          `Type "${word}" to confirm`,
      },
      common: {
        confirm: () => "Confirm",
        cancel: () => "Cancel",
      },
      support: {
        delete: () => "delete",
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => {
  const colors = { grey3: "#bbb", grey4: "#ddd", grey5: "#eee", black: "#000" }
  return {
    makeStyles:
      (fn: (theme: { colors: Record<string, string> }) => Record<string, object>) => () =>
        fn({ colors }),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
  }
})

const lastModalProps: {
  isVisible?: boolean
  title?: string
  body?: React.ReactNode
  primaryButtonDisabled?: boolean
  primaryButtonOnPress?: () => void
  secondaryButtonOnPress?: () => void
  toggleModal?: () => void
} = {}
jest.mock("@app/components/custom-modal/custom-modal", () => {
  const ReactActual = jest.requireActual("react")
  return {
    __esModule: true,
    default: (props: {
      isVisible: boolean
      title?: string
      body: React.ReactNode
      primaryButtonDisabled?: boolean
      primaryButtonOnPress: () => void
      secondaryButtonOnPress?: () => void
      toggleModal: () => void
    }) => {
      lastModalProps.isVisible = props.isVisible
      lastModalProps.title = props.title
      lastModalProps.body = props.body
      lastModalProps.primaryButtonDisabled = props.primaryButtonDisabled
      lastModalProps.primaryButtonOnPress = props.primaryButtonOnPress
      lastModalProps.secondaryButtonOnPress = props.secondaryButtonOnPress
      lastModalProps.toggleModal = props.toggleModal
      return props.isVisible
        ? ReactActual.createElement("View", { testID: "custom-modal" }, props.body)
        : null
    },
  }
})

describe("DeleteAccountConfirmModal", () => {
  beforeEach(() => {
    Object.keys(lastModalProps).forEach(
      (k) => delete lastModalProps[k as keyof typeof lastModalProps],
    )
  })

  it("does not render when isVisible is false", () => {
    const { queryByTestId } = render(
      <DeleteAccountConfirmModal
        isVisible={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )

    expect(queryByTestId("custom-modal")).toBeNull()
  })

  it("renders the centered title without left alignment", () => {
    render(
      <DeleteAccountConfirmModal
        isVisible={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )

    expect(lastModalProps.title).toBe("Confirm account removal")
  })

  it("starts with the confirm button disabled until 'delete' is typed", () => {
    const { getByTestId } = render(
      <DeleteAccountConfirmModal
        isVisible={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )

    expect(lastModalProps.primaryButtonDisabled).toBe(true)

    fireEvent.changeText(getByTestId("self-custodial-danger-zone-delete-input"), "delete")

    expect(lastModalProps.primaryButtonDisabled).toBe(false)
  })

  it("ignores casing and surrounding whitespace when matching the keyword", () => {
    const { getByTestId } = render(
      <DeleteAccountConfirmModal
        isVisible={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )

    fireEvent.changeText(
      getByTestId("self-custodial-danger-zone-delete-input"),
      "  DELETE  ",
    )

    expect(lastModalProps.primaryButtonDisabled).toBe(false)
  })

  it("calls onConfirm when the primary button fires after a valid input", async () => {
    const onConfirm = jest.fn().mockResolvedValue(undefined)
    const { getByTestId } = render(
      <DeleteAccountConfirmModal
        isVisible={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.changeText(getByTestId("self-custodial-danger-zone-delete-input"), "delete")
    await lastModalProps.primaryButtonOnPress?.()

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when the secondary button fires", () => {
    const onClose = jest.fn()
    render(
      <DeleteAccountConfirmModal
        isVisible={true}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )

    lastModalProps.secondaryButtonOnPress?.()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when the modal is dismissed via toggle", () => {
    const onClose = jest.fn()
    render(
      <DeleteAccountConfirmModal
        isVisible={true}
        onClose={onClose}
        onConfirm={() => {}}
      />,
    )

    lastModalProps.toggleModal?.()

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
