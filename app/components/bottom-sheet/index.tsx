import React from "react"
import {
  BackHandler,
  Modal,
  Pressable,
  StyleProp,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native"
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler"
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles } from "@rn-vui/themed"

// A scrim has to darken in both themes; the theme's backdrop tokens invert and
// would brighten whatever is behind the sheet in dark mode. This is the one
// definition of it — see `category-filter-sheet` and `place-sheet`, which each
// used to declare their own copy.
const SCRIM_COLOR = "rgba(0, 0, 0, 0.4)"

// Dragged this much further down than the snap point it started from, the sheet
// is being dismissed rather than resized.
const DISMISS_DISTANCE = 80

// Where a flick would end up, so a fast short drag still snaps the way it was
// thrown rather than the way it happens to have stopped.
const VELOCITY_PROJECTION = 0.15

const SPRING = { damping: 20, stiffness: 220, mass: 0.6 }
const CLOSE_DURATION_MS = 200

// The sheet's outer shape is a rounded path, so Android antialiases every edge
// of it — including the straight bottom one. The top and sides hide that under
// their 1px border; the bottom has no border to hide it under, and the half-lit
// pixel that is left reads as a hairline of scrim between the sheet and the
// screen. The sheet has no bottom edge worth showing anyway — it rests on the
// screen's — so it is drawn this much taller and pulled down by the same
// amount, which puts the seam off-screen without moving anything that is on it.
export const BOTTOM_OVERHANG = 1

/** @see `bottom-sheet.spec` — the drag is only reachable from a test by name. */
export const PAN_TEST_ID = "bottom-sheet-pan"

type Props = {
  isVisible: boolean
  onClose: () => void
  /**
   * How much of the screen the sheet covers once fully open, as a fraction of
   * the window. Short of the whole thing on every current caller: what the
   * sheet is about stays partly visible behind it.
   */
  heightRatio?: number
  /**
   * How the sheet is put on the screen.
   *
   * `"modal"` is a sheet in the usual sense: its own window, a scrim, and every
   * touch on the screen belonging to it until it is dismissed.
   *
   * `"inline"` draws the same sheet in the layout it is placed in, with no
   * window and no scrim, so what it sits beside keeps its own touches. It fills
   * the slot its parent gives it — a `flex` share rather than `heightRatio` —
   * which is what lets the surface above it shrink by exactly the sheet's
   * height instead of being covered by it. Everything else is unchanged, the
   * spring and the dismiss distance included, so the two read as one component.
   */
  presentation?: "modal" | "inline"
  /**
   * Held above the scroll and below the handle, so it stays put while the
   * content moves under it.
   */
  header?: React.ReactNode
  /**
   * Rest at the header's measured bottom edge rather than fully open, so
   * whatever the header turns out to be is exactly what shows when the sheet
   * arrives. Dragging up rests it at full height.
   *
   * Without it the sheet has one resting position, fully open, and the header
   * is simply a region that does not scroll.
   */
  restsOnHeader?: boolean
  headerStyle?: StyleProp<ViewStyle>
  headerTestID?: string
  /**
   * Held below the scroll, so a call to action stays on the sheet rather than
   * under whatever the content has pushed off it.
   */
  footer?: React.ReactNode
  footerStyle?: StyleProp<ViewStyle>
  children: React.ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  scrollTestID?: string
  testID?: string
}

/**
 * A sheet that rises from the bottom of the screen over what it is about.
 *
 * It owns the parts every bottom sheet in the app needs and none of them should
 * be spelling out for itself: the modal window and the gesture root Android
 * needs inside one, the scrim and its press-to-close, the pull handle, the
 * drag-to-dismiss, and the surface tokens.
 *
 * Built here rather than taken from `@gorhom/bottom-sheet`, which is broken on
 * this stack — see the note in `amount-input-modal.tsx` for the issue links.
 * That component reaches for React Native's `Modal` for the same reason and
 * gives up drag-to-dismiss to do it; this is what it would use instead.
 *
 * A form that has to be filled in while what is behind it is still being
 * worked — the map's add-place form, whose pin is aimed by panning the map
 * above it as the fields are typed — wants `presentation="inline"`. It gets
 * the same entry, the same drag-to-dismiss and the same spring, and gives up
 * only the window and the scrim, which are the two things that would take the
 * panning away.
 */
export const BottomSheet: React.FC<Props> = ({
  isVisible,
  onClose,
  heightRatio,
  presentation = "modal",
  header,
  restsOnHeader = false,
  headerStyle,
  headerTestID,
  footer,
  footerStyle,
  children,
  contentContainerStyle,
  scrollTestID,
  testID,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { height: windowHeight } = useWindowDimensions()

  const isInline = presentation === "inline"

  // Inline the sheet is given its height by the layout rather than taking a
  // share of the window, so it has to be measured. Until that lands the window
  // stands in for it, which only ever makes the entry start further below the
  // screen than it needs to — never on screen, which is what would be visible.
  const [measuredHeight, setMeasuredHeight] = React.useState(0)
  const sheetHeight = isInline
    ? measuredHeight || windowHeight
    : Math.round(windowHeight * (heightRatio ?? 1))

  // Offset from the sheet's own top: 0 is fully open, `sheetHeight` is off the
  // bottom of the screen.
  const offset = useSharedValue(sheetHeight)
  const dragStart = useSharedValue(0)
  // How much of the drag in progress the scroll view took before the sheet
  // started moving, and whether the scroll view still holds it. See the pan.
  const scrolledTravel = useSharedValue(0)
  const scrollTookDrag = useSharedValue(false)
  // The resting offset, once it has been measured. Until then the sheet stays
  // off-screen rather than guessing.
  const restOffset = useSharedValue(restsOnHeader ? sheetHeight : 0)
  // The header's bottom edge within the sheet (y + height), not its bare
  // height: the border, padding, and handle above it sit inside the visible
  // window too, and counting only the height clips their worth off the last row
  // the header shows.
  const [headerBottom, setHeaderBottom] = React.useState(0)
  const [isExpanded, setExpanded] = React.useState(false)
  // Inline there is no window to play the slide-out behind, so the sheet holds
  // itself in the layout until its own exit has finished. Without it a caller
  // that takes `isVisible` away gets two different exits from one surface:
  // dragged, it slides out; closed from a button, it vanishes in the same
  // frame and whatever it sat above snaps back to full height under it.
  const [isLeaving, setLeaving] = React.useState(false)
  // Only leaving from being open is an exit. Mounting hidden — which every
  // modal caller does — is not something to animate out of, or to report.
  const wasVisible = React.useRef(isVisible)

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  // Read straight off the scroll view, so the pan can tell a drag on a list
  // that is already at its top from one that is scrolling it back up.
  const scrollOffset = useScrollViewOffset(scrollRef)

  // Exactly the measured bottom edge. A caller clears the home indicator with
  // padding inside its header instead, so the strip above it belongs to the
  // header: resting any higher than this uncovers the top of the row behind it,
  // and a row sliced through its glyphs reads as a rendering fault.
  const restingOffset = restsOnHeader
    ? headerBottom
      ? Math.max(0, sheetHeight - headerBottom)
      : sheetHeight
    : 0

  React.useEffect(() => {
    restOffset.value = restingOffset
  }, [restingOffset, restOffset])

  // Reopening always starts low again, however it was left last time.
  React.useEffect(() => {
    if (isVisible) setExpanded(false)
  }, [isVisible])

  // The one exit, however it was asked for — a caller taking `isVisible` away,
  // the back button, a drag past the dismiss distance. It slides out first and
  // reports afterwards, so nothing disappears from the layout mid-animation.
  const leave = React.useCallback(() => {
    setLeaving(true)
    offset.value = withTiming(
      sheetHeight,
      { duration: CLOSE_DURATION_MS },
      (finished) => {
        if (!finished) return
        runOnJS(setLeaving)(false)
        // Inline the caller has to take the sheet out of its own layout, so it
        // is told when there is nothing left on screen to take out. A modal
        // caller is the one that set `isVisible` false and its window hides
        // itself, so it is not told a second time.
        if (isInline) runOnJS(onClose)()
      },
    )
  }, [isInline, offset, onClose, sheetHeight])

  React.useEffect(() => {
    const hadBeenVisible = wasVisible.current
    wasVisible.current = isVisible

    if (!isVisible) {
      if (hadBeenVisible) leave()
      return
    }
    // Follow the measurement only while resting low. A header can grow after
    // the sheet has arrived — details landing on it — and a sheet the user has
    // already pulled up must not drop back down under them when that happens.
    if (!restsOnHeader || (headerBottom && !isExpanded)) {
      offset.value = withSpring(restingOffset, SPRING)
    }
  }, [
    isVisible,
    headerBottom,
    restingOffset,
    sheetHeight,
    isExpanded,
    offset,
    restsOnHeader,
    leave,
  ])

  // Android's hardware back is the reflex for getting out of a form, and it is
  // the only exit besides the X once the tab bar is gone. The modal
  // presentation hands it to `Modal`'s `onRequestClose`; inline there is no
  // window to hand it to, and without this the navigator takes it instead —
  // leaving the tab, unmounting the sheet, and throwing away whatever was
  // being filled in with no prompt. Registered here rather than by the caller
  // so the next inline sheet inherits it, and closing the same way the X does.
  React.useEffect(() => {
    if (!isInline || !isVisible) return undefined
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      leave()
      return true
    })
    return () => subscription.remove()
  }, [isInline, isVisible, leave])

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // Named so the drag can be driven from a test — there is no other way
        // to reach a gesture handler from one.
        .withTestId(PAN_TEST_ID)
        // Small movements belong to whatever is underneath — a tap on a link
        // should not have to be perfectly still.
        .activeOffsetY([-12, 12])
        // So a downward drag at the top of the list can collapse the sheet
        // instead of the scroll view swallowing it. The cast is a types-only
        // gap: gesture-handler declares a ref to a component *type* here, and
        // reads the instance the animated ref actually holds.
        .simultaneousWithExternalGesture(
          scrollRef as unknown as React.RefObject<React.ComponentType>,
        )
        .onBegin(() => {
          dragStart.value = offset.value
          scrolledTravel.value = 0
          scrollTookDrag.value = false
        })
        .onUpdate((event) => {
          // Fully open with the list scrolled down, a downward drag is the list
          // being scrolled back up, not the sheet being pulled shut.
          if (dragStart.value === 0 && scrollOffset.value > 0 && event.translationY > 0) {
            // `translationY` keeps counting from where the finger went down,
            // list or no list. Remembering how much of it the list took is what
            // lets the sheet pick the drag up from where the finger was when
            // the list ran out, rather than jumping the whole accumulated
            // travel in the one frame the guard stops firing.
            scrolledTravel.value = event.translationY
            scrollTookDrag.value = true
            return
          }
          const next = Math.max(
            0,
            dragStart.value + event.translationY - scrolledTravel.value,
          )
          // The sheet has taken the drag over from the list only once it moves.
          if (next !== offset.value) scrollTookDrag.value = false
          offset.value = next
        })
        .onEnd((event) => {
          // A gesture the scroll view ate does not get to decide the sheet's
          // fate: a flick back to the top of a long list releases at an
          // ordinary 1,500-4,000 px/s, which projects far past the dismiss
          // distance while the sheet itself has not moved at all.
          const projected = scrollTookDrag.value
            ? offset.value
            : offset.value + event.velocityY * VELOCITY_PROJECTION

          if (projected > restOffset.value + DISMISS_DISTANCE) {
            offset.value = withTiming(
              sheetHeight,
              { duration: CLOSE_DURATION_MS },
              (finished) => {
                if (finished) runOnJS(onClose)()
              },
            )
            return
          }

          const toFull = projected < restOffset.value / 2
          offset.value = withSpring(toFull ? 0 : restOffset.value, SPRING)
          runOnJS(setExpanded)(toFull)
        }),
    [
      dragStart,
      offset,
      restOffset,
      scrollOffset,
      scrollRef,
      scrolledTravel,
      scrollTookDrag,
      sheetHeight,
      onClose,
    ],
  )

  // Dependency arrays are passed explicitly rather than left to the Babel
  // plugin to infer, so these still work where it is not applied — the test
  // environment among them.
  const sheetStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: offset.value }] }),
    [offset],
  )

  const backdropStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(
        offset.value,
        [sheetHeight, restOffset.value],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    }),
    [offset, restOffset, sheetHeight],
  )

  const sheet = (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.sheet,
          isInline
            ? styles.sheetInline
            : { height: sheetHeight + BOTTOM_OVERHANG, marginBottom: -BOTTOM_OVERHANG },
          sheetStyle,
        ]}
        onLayout={
          isInline
            ? (event) => setMeasuredHeight(event.nativeEvent.layout.height)
            : undefined
        }
        testID={testID}
      >
        <View style={styles.handle} />

        {header !== undefined && (
          <View
            testID={headerTestID}
            style={headerStyle}
            onLayout={(event) => {
              if (!restsOnHeader) return
              const { y, height } = event.nativeEvent.layout
              setHeaderBottom(y + height)
            }}
          >
            {header}
          </View>
        )}

        <Animated.ScrollView
          testID={scrollTestID}
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          // Below full height the sheet itself takes the drag; a list that
          // cannot be seen has nothing to scroll.
          scrollEnabled={restsOnHeader ? isExpanded : true}
        >
          {children}
        </Animated.ScrollView>

        {footer !== undefined && <View style={footerStyle}>{footer}</View>}
      </Animated.View>
    </GestureDetector>
  )

  // Inline there is no window to open and no scrim to press: the sheet is drawn
  // where it was placed, and everything around it keeps its own touches.
  if (isInline) return isVisible || isLeaving ? sheet : null

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={onClose}>
      {/* Gestures inside a Modal need their own root on Android — the one in
          app.tsx does not reach into a separate window. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={styles.backdropPress}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={LL.common.close()}
          />
        </Animated.View>

        {sheet}
      </GestureHandlerRootView>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SCRIM_COLOR,
  },
  backdropPress: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.grey4,
    paddingTop: 8,
  },
  // Fills the slot the layout gives it, so the surface above shrinks by exactly
  // this sheet's height rather than being covered by it.
  sheetInline: {
    flex: 1,
  },
  handle: {
    alignSelf: "center",
    width: 26,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.grey3,
    marginBottom: 8,
  },
  scroll: {
    flex: 1,
  },
}))
