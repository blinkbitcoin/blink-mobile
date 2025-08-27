import React from "react"
import { View } from "react-native"
import { makeStyles, BottomSheet } from "@rneui/themed"
import { SearchContent, FiltersContent, EventContent } from "."
import { IMarker } from "@app/screens/map-screen/btc-map-interface"

/*
  the forwardRef and useImperativeHandle (in the parent) are used here to toggle the modal
  without causing a re-render of the parent, which would cause the mega-heavy MapView to rerender,
  and would result in wrecking the modal enter animation
*/

export type TModal = "search" | "filter" | "locationEvent"
type Props = {
  focusedMarker?: IMarker | null
}

export type OpenBottomModalElement = {
  toggleVisibility: (type: TModal) => void
}
export const OpenBottomModal = React.forwardRef<OpenBottomModalElement, Props>(
  function ConfirmDialog({ focusedMarker }, ref): JSX.Element {
    const styles = useStyles()
    const [isVisible, toggleVisible] = React.useState<boolean>(false)
    const [modalType, setModalType] = React.useState<TModal>("locationEvent")

    React.useImperativeHandle(ref, () => ({
      toggleVisibility(type) {
        setModalType(type)
        toggleVisible(!isVisible)
      },
    }))

    return (
      <BottomSheet isVisible={isVisible} onBackdropPress={() => toggleVisible(false)}>
        <View style={styles.bottomSheet}>
          {modalType == "search" ? (
            <SearchContent closeModal={() => toggleVisible(!isVisible)} />
          ) : modalType == "filter" ? (
            <FiltersContent closeModal={() => toggleVisible(!isVisible)} />
          ) : modalType == "locationEvent" ? (
            <EventContent
              closeModal={() => toggleVisible(!isVisible)}
              focusedMarker={focusedMarker}
            />
          ) : (
            <></>
          )}
        </View>
      </BottomSheet>
    )
  },
)

const useStyles = makeStyles(({ colors }) => ({
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopRightRadius: 25,
    borderTopLeftRadius: 25,
    padding: 20,
    minHeight: 100,
  },
}))
