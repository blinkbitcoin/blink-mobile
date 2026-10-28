import React from "react"
import {
  AccessibilityInfo,
  Text as NativeText,
  Pressable,
  TextInput,
  TextProps,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  LatLng,
  PLACE_NAME_MAX_LENGTH,
  PlaceCategory,
  PlaceSubmission,
  SUBMITTABLE_PLACE_CATEGORIES,
  buildPlaceSubmission,
  formatCoordinates,
} from "@app/btcmap"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BottomSheet } from "@app/components/bottom-sheet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

type Props = {
  /**
   * Where the pin is pointing right now — the centre of the map above, which
   * moves as the map does. The row showing it and the request carry the same
   * place: this is what is submitted, taken as it stood when Continue was
   * pressed rather than as it stands when Submit is.
   */
  location: LatLng
  /**
   * Sends the place. Resolves to why it did not go — a message ready to be
   * read — or to null when it did, on which the panel closes itself the way
   * the X closes it.
   */
  onSubmit: (submission: PlaceSubmission) => Promise<string | null>
  onClose: () => void
  /**
   * Told when Continue fixes the place's location, and told `null` when Back
   * releases it. From then on the map is no longer the control for where the
   * place is, so it has to stop presenting itself as one.
   */
  onPin?: (location: LatLng | null) => void
}

/**
 * What is being added, in two steps: where the place is and what it is
 * called, then what kind of place it is.
 *
 * The first step is filled in while the pin is still being aimed, so the map
 * keeps the top of the screen and this takes the bottom. That is why it is the
 * shared sheet drawn inline rather than in its own window: it has the sheet's
 * entry and drag-to-dismiss, but no scrim and no window, which would take every
 * touch on the screen while the map above has to stay pannable.
 *
 * A panel, and named for one: it shortens the map rather than covering it, so
 * the coordinate read from the map's centre is still the pin's.
 *
 * The name and the category are both required — see `buildPlaceSubmission` for
 * why the category is. Submit stays disabled rather than explaining itself
 * afterwards, since which of the two is missing is visible on the form.
 *
 * Nothing is focused on open. The keyboard would cover the map this is meant to
 * be filled in alongside, and the pin usually wants placing before there is
 * anything to type.
 */
export const AddPlacePanel: React.FC<Props> = ({
  location,
  onSubmit,
  onClose,
  onPin,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const styles = useStyles({ bottomInset: insets.bottom })

  // Which half of the question is being answered. Where the place is and what
  // it is called come first because they are what the map above is for — the
  // pin is aimed while these are typed — and the category is a fourteen-way
  // choice that wants the whole sheet to itself.
  // Closing is asked for here and carried out by the sheet, which slides out
  // and only then calls `onClose` to be taken off the map's layout. Calling it
  // from the X directly would take the panel away in the frame it was pressed,
  // while a drag slid it out — two exits from one surface.
  const [isOpen, setOpen] = React.useState(true)

  const [step, setStep] = React.useState<"details" | "category">("details")
  // The first thing on whichever step is showing. The button that changed the
  // step is gone from the step it leads to, so a screen reader's focus has
  // nowhere to stay: it is put here instead, and the step reads from its top.
  const stepStartRef = React.useRef<NativeText>(null)
  // A types-only gap: `@rn-vui/themed` declares Text's ref as a ref to its
  // props, and forwards the ref to the native Text, which is what the focus
  // call below takes.
  const stepStartLabelRef = stepStartRef as unknown as React.Ref<TextProps>
  const hasChangedStep = React.useRef(false)
  React.useEffect(() => {
    // Not on open: nothing is focused then, on purpose — see above.
    if (!hasChangedStep.current) {
      hasChangedStep.current = true
      return
    }
    if (stepStartRef.current) {
      AccessibilityInfo.sendAccessibilityEvent(stepStartRef.current, "focus")
    }
  }, [step])
  // The pin as it stood when Continue was pressed. The map above stays
  // pannable the whole time this is open — that is the reason it is a panel —
  // and the coordinate row is on the first step while the send is on the
  // second, so without this a brush of the map while reaching for a chip would
  // submit a place the user never saw, with nothing on the panel disagreeing.
  // Continue means "this is the place", which is what splitting the two steps
  // implies to whoever pressed it. Stepping back releases it, since the row
  // that shows the pin is back on screen and following the map again.
  const [pinnedLocation, setPinnedLocation] = React.useState<LatLng | null>(null)
  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState<PlaceCategory | null>(null)
  // Sending is a round trip. The guard keeps a second tap from firing a
  // concurrent mutation, and the spinner is what tells the first tap landed.
  const [isSubmitting, setSubmitting] = React.useState(false)
  // Why the last send did not go. It is shown here rather than raised as a
  // toast because it belongs beside the button that would retry it.
  const [error, setError] = React.useState<string | null>(null)
  // A failure on the form is about the place as it stood, so editing the place
  // takes it off: otherwise a refusal keeps accusing a place that no longer
  // exists. Only a typed edit, though — the pin is a pan away at all times
  // now, and a message that a nudge of the map wipes is one nobody finishes
  // reading. It goes on the next send instead.
  const editName = (text: string) => {
    setName(text)
    setError(null)
  }
  // Tapping the chip that is already on takes it back off, so a category
  // chosen by accident does not have to be replaced to be undone — there is no
  // empty row to pick in a set of chips the way there is in a list.
  const editCategory = (option: PlaceCategory) => {
    setCategory((current) => (current === option ? null : option))
    setError(null)
  }

  const submission = buildPlaceSubmission({
    name,
    category,
    location: pinnedLocation ?? location,
  })
  const isSubmitDisabled = !submission || isSubmitting
  // The name is the only thing the first step asks for that it can be missing:
  // the pin always points somewhere, so there is always a location.
  const canContinue = name.trim().length > 0

  // Back to the details rather than out of the form. Nothing is cleared on the
  // way — a name being corrected is the reason to come back here, and losing
  // the category to fix a typo would be its own annoyance.
  const goBack = () => {
    setStep("details")
    setPinnedLocation(null)
    onPin?.(null)
    setError(null)
  }

  const submit = async () => {
    if (!submission || isSubmitting) return
    setSubmitting(true)
    setError(null)
    let isSent = false
    try {
      const reason = await onSubmit(submission)
      setError(reason)
      isSent = !reason
      // `accessibilityLiveRegion` on the message is Android's alone, so without
      // this a refusal reaches VoiceOver as a button that simply stayed put.
      if (reason) AccessibilityInfo.announceForAccessibility(reason)
    } finally {
      // Sent, it goes the way every other exit goes — slid out, then reported
      // — rather than taken off the map in the frame the answer arrived. It
      // stays sending as far as the button is concerned while it goes: the
      // attempt is open until the slide-out reports, and a second tap in that
      // window would reach BTC Map as an edit of the place it has just taken.
      if (isSent) setOpen(false)
      else setSubmitting(false)
    }
  }

  return (
    <BottomSheet
      testID="add-place-panel"
      isVisible={isOpen}
      onClose={onClose}
      presentation="inline"
      headerStyle={styles.header}
      contentContainerStyle={styles.content}
      footerStyle={styles.footer}
      header={
        <>
          {step === "category" && (
            <Pressable
              testID="back-to-place-details"
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel={LL.common.back()}
              hitSlop={12}
            >
              {/* The foreground colour, not the accent: this reads as part of
                  the title row it sits in rather than as an action of its
                  own. White on the dark sheet, black on the light one. */}
              <GaloyIcon name="arrow-left" size={20} color={colors.black} />
            </Pressable>
          )}
          <Text style={styles.title} accessibilityRole="header">
            {LL.MapScreen.addPlaceTitle()}
          </Text>
          <Pressable
            testID="close-add-place"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel={LL.common.close()}
            hitSlop={12}
          >
            <GaloyIcon name="close" size={20} color={colors.primary} />
          </Pressable>
        </>
      }
      footer={
        <>
          {error && step === "category" ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <GaloyIcon name="warning-circle" size={14} color={colors.error} />
              <Text testID="place-submission-error" style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}
          {step === "details" ? (
            <GaloyPrimaryButton
              testID="continue-place"
              title={LL.common.continue()}
              onPress={() => {
                setPinnedLocation(location)
                onPin?.(location)
                setStep("category")
              }}
              disabled={!canContinue}
            />
          ) : (
            <GaloyPrimaryButton
              testID="submit-place"
              title={LL.MapScreen.submitPlaceRequest()}
              onPress={submit}
              disabled={isSubmitDisabled}
              loading={isSubmitting}
            />
          )}
        </>
      }
    >
      {step === "details" ? (
        <>
          <View style={styles.field}>
            <Text
              ref={stepStartLabelRef}
              testID="place-details-start"
              style={styles.label}
            >
              {LL.MapScreen.placeLocation()}
            </Text>
            {/* Read-only, and with nothing to tap: the map above is the control
              for this row, and it is on screen. */}
            <View style={styles.locationRow}>
              <GaloyIcon name="map-pin" size={16} color={colors.grey1} />
              <Text
                testID="place-coordinates"
                style={styles.coordinates}
                numberOfLines={1}
              >
                {formatCoordinates(location)}
              </Text>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{LL.MapScreen.placeName()}</Text>
            <TextInput
              testID="place-name-input"
              style={styles.input}
              value={name}
              onChangeText={editName}
              placeholder={LL.MapScreen.placeNameHint()}
              placeholderTextColor={colors.grey2}
              maxLength={PLACE_NAME_MAX_LENGTH}
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel={LL.MapScreen.placeName()}
            />
          </View>
        </>
      ) : (
        <>
          <View style={styles.field}>
            <Text
              ref={stepStartLabelRef}
              testID="place-category-start"
              style={styles.label}
            >
              {LL.MapScreen.placeCategory()}
            </Text>
            {/* All of them at once, rather than a row that opens a list. The
              fourteen are short, familiar words and reading them is the fastest
              way to find the one that fits — a list of the same fourteen hides
              thirteen behind a tap and tells the user nothing they could not
              already see. They have the step to themselves and the send button
              is held below the scroll, so they can be as tall as they need and
              take the scroll with them rather than the button.

              `other` is not among them: it is the bucket unrecognised pins fall
              into, not a description of a place, and a submission under it
              would tell BTC Map nothing. */}
            {/* One of fourteen, so a radio group: a screen reader says which is
              chosen and how many there are, where buttons say neither. */}
            <View
              testID="place-categories"
              style={styles.chips}
              accessibilityRole="radiogroup"
              accessibilityLabel={LL.MapScreen.placeCategory()}
            >
              {SUBMITTABLE_PLACE_CATEGORIES.map((option) => {
                const isSelected = option === category
                return (
                  <Pressable
                    key={option}
                    testID={`place-category-${option}`}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => editCategory(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text style={isSelected ? styles.chipTextSelected : styles.chipText}>
                      {LL.MapScreen.category[option]()}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* Nothing here appears on the map on its own — saying so up front is
            what keeps "I added my shop and it isn't there" from being a
            surprise. */}
          <View style={styles.note}>
            <GaloyIcon name="info" size={16} color={colors.grey1} />
            <Text style={styles.noteText}>{LL.MapScreen.placeReviewNote()}</Text>
          </View>
        </>
      )}
    </BottomSheet>
  )
}

const useStyles = makeStyles(({ colors }, { bottomInset }: { bottomInset: number }) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    // The bold face by name with no weight: Android swaps a weight on the
    // regular face for Roboto, and there is no 600 face to ask for.
    fontFamily: "SourceSansPro-Bold",
    color: colors.black,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    rowGap: 16,
  },
  field: {
    rowGap: 8,
  },
  label: {
    fontSize: 14,
    color: colors.grey1,
  },
  // The two rows of the first step, on one measurement so they read as a pair.
  input: {
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.grey5,
    borderRadius: 8,
    minHeight: 60,
    paddingHorizontal: 14,
    // Android gives inputs their own vertical padding on top of the row's.
    paddingVertical: 0,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    backgroundColor: colors.grey5,
    borderRadius: 8,
    minHeight: 60,
    paddingHorizontal: 14,
  },
  coordinates: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
  },
  // Taken from `percentage-selector`, which is where the app already draws a
  // one-of-many choice as chips: grey5 ground, the primary as the selected
  // fill, and the label switching to white on it. Its row does not come with
  // it — four chips share a row evenly, fourteen have to wrap — and neither
  // does its `minWidth`, which would pad the short labels into ragged columns.
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  chip: {
    backgroundColor: colors.grey5,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    // The smallest target a finger can be expected to hit. The padding alone
    // left a chip about 35 tall, and a hit slop that made up the rest would
    // overlap the row below at this row gap.
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    color: colors.primary,
    fontFamily: "SourceSansPro-Bold",
  },
  chipTextSelected: {
    color: colors.white,
    fontFamily: "SourceSansPro-Bold",
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.grey1,
  },
  // Below the scroll rather than at the end of it — see the sheet's `footer` —
  // so the fourteen chips can be as tall as they need without the button that
  // sends the place going off the bottom with them.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    // The app's standing gap between a call to action and the foot of what it
    // sits on, plus the home indicator. The panel covers the tab bar while it
    // is open, so there is nothing below it left to clear this.
    paddingBottom: 20 + bottomInset,
    rowGap: 10,
  },
  // Above the button rather than by the fields: what failed is the send, and
  // the button is where the eye already is when it does.
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    columnGap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.error,
  },
}))
