import React from "react"
import { View } from "react-native"

const DISMISS_ANIMATION_MS = 40

const BottomSheetModal = React.forwardRef(
  (
    { children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void },
    ref: React.Ref<{ present: () => void; dismiss: () => void }>,
  ) => {
    const [visible, setVisible] = React.useState(false)
    const dismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const visibleRef = React.useRef(false)

    React.useEffect(() => {
      visibleRef.current = visible
    }, [visible])

    React.useEffect(() => {
      return () => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
      }
    }, [])

    React.useImperativeHandle(ref, () => ({
      present: () => setVisible(true),
      dismiss: () => {
        const wasVisible = visibleRef.current
        setVisible(false)
        if (!wasVisible) return
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
        dismissTimerRef.current = setTimeout(() => {
          onDismiss?.()
          dismissTimerRef.current = null
        }, DISMISS_ANIMATION_MS)
      },
    }))

    if (!visible) return null
    return <View testID="bottom-sheet-modal">{children}</View>
  },
)
BottomSheetModal.displayName = "MockBottomSheetModal"

export { BottomSheetModal }
export const BottomSheetView = ({ children }: { children: React.ReactNode }) => (
  <View>{children}</View>
)
export const BottomSheetBackdrop = () => null
