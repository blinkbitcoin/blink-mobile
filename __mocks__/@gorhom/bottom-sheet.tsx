import React from "react"
import { View } from "react-native"

type Props = { children?: React.ReactNode; onDismiss?: () => void }

const BottomSheetModal = React.forwardRef(
  ({ children, onDismiss }: Props, ref: React.Ref<{ present: () => void; dismiss: () => void }>) => {
    React.useImperativeHandle(ref, () => ({
      present: jest.fn(),
      dismiss: () => {
        onDismiss?.()
      },
    }))
    return <View>{children}</View>
  },
)

const BottomSheetView = ({ children }: { children?: React.ReactNode }) => (
  <View>{children}</View>
)

const BottomSheetBackdrop = () => <View />

export { BottomSheetModal, BottomSheetView, BottomSheetBackdrop }
