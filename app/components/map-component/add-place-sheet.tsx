import React from "react"
import { Pressable, ScrollView, TextInput, View } from "react-native"

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
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

type Props = {
  /**
   * Where the pin is pointing right now — the centre of the map above, which
   * moves as the map does. This is what gets submitted, so the row showing it
   * and the request carry the same place.
   */
  location: LatLng
  /**
   * Sends the place. Resolves to why it did not go — a message ready to be
   * read — or to null when it did.
   */
  onSubmit: (submission: PlaceSubmission) => Promise<string | null>
  onClose: () => void
}

/**
 * What is being added, filled in while the pin is still being aimed.
 *
 * Half the screen, with the map keeping the other half: the two halves of
 * adding a place — where it is and what it is — are one question, so neither
 * waits on the other. That is also why this is a plain view rather than a
 * modal. A modal window would take every touch on the screen, and the map
 * above has to stay pannable for the whole time this is open.
 *
 * The name and the category are both required — see `buildPlaceSubmission` for
 * why the category is. Submit stays disabled rather than explaining itself
 * afterwards, since which of the two is missing is visible on the form.
 *
 * Nothing is focused on open. The keyboard would cover the map this is meant to
 * be filled in alongside, and the pin usually wants placing before there is
 * anything to type.
 */
export const AddPlaceSheet: React.FC<Props> = ({ location, onSubmit, onClose }) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const styles = useStyles()

  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState<PlaceCategory | null>(null)
  // Sending is a round trip. The guard keeps a second tap from firing a
  // concurrent mutation, and the spinner is what tells the first tap landed.
  const [isSubmitting, setSubmitting] = React.useState(false)
  // Why the last send did not go. It is shown here rather than raised as a
  // toast because it belongs beside the button that would retry it.
  const [error, setError] = React.useState<string | null>(null)
  // The place a send in flight is for. The request carries the pin as it stood
  // when submit was tapped, so while it is out the row has to keep showing
  // that rather than following the map somewhere the request is not going.
  const [sentLocation, setSentLocation] = React.useState<LatLng | null>(null)

  // A failure on the form is about the place as it stood, so editing the place
  // takes it off: otherwise a refusal keeps accusing a place that no longer
  // exists. Only a typed edit, though — the pin is a pan away at all times
  // now, and a message that a nudge of the map wipes is one nobody finishes
  // reading. It goes on the next send instead.
  const editName = (text: string) => {
    setName(text)
    setError(null)
  }
  const editCategory = (option: PlaceCategory) => {
    setCategory((current) => (current === option ? null : option))
    setError(null)
  }

  const shownLocation = sentLocation ?? location

  const submission = buildPlaceSubmission({ name, category, location })
  const isSubmitDisabled = !submission || isSubmitting

  const submit = async () => {
    if (!submission || isSubmitting) return
    setSubmitting(true)
    setError(null)
    setSentLocation(location)
    try {
      const reason = await onSubmit(submission)
      setError(reason)
      // A retry is free to be sent from wherever the pin is by then, so the row
      // goes back to following the map. On success there is nothing to go back
      // to: the map closes this.
      if (reason) setSentLocation(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <Text style={styles.title}>{LL.MapScreen.addPlaceTitle()}</Text>
        <Pressable
          testID="close-add-place"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={LL.common.close()}
          hitSlop={12}
        >
          <GaloyIcon name="close" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.field}>
          <Text style={styles.label}>{LL.MapScreen.placeLocation()}</Text>
          {/* Read-only, and with nothing to tap: the map above is the control
              for this row, and it is on screen. */}
          <View style={styles.locationRow}>
            <GaloyIcon name="map-pin" size={16} color={colors.grey1} />
            <Text testID="place-coordinates" style={styles.coordinates} numberOfLines={1}>
              {formatCoordinates(shownLocation)}
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

        <View style={styles.field}>
          <Text style={styles.label}>{LL.MapScreen.placeCategory()}</Text>
          {/* Short labels, so they are all on screen and one tap away. A
              picker behind a row would hide the choice being made and cost
              two taps to make it. `other` is not offered: it is a filter
              bucket, not a description of a place. */}
          <View style={styles.chips}>
            {SUBMITTABLE_PLACE_CATEGORIES.map((option) => {
              const isSelected = option === category
              return (
                <Pressable
                  key={option}
                  testID={`place-category-${option}`}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  onPress={() => editCategory(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
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
          <GaloyIcon name="info" size={16} color={colors.grey2} />
          <Text style={styles.noteText}>{LL.MapScreen.placeReviewNote()}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <GaloyIcon name="warning-circle" size={14} color={colors.error} />
            <Text testID="place-submission-error" style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}
        <GaloyPrimaryButton
          testID="submit-place"
          title={LL.common.submit()}
          onPress={submit}
          disabled={isSubmitDisabled}
          loading={isSubmitting}
        />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  // Half of what the map screen has, the map keeping the other half — see the
  // sibling `flex: 1` on the map's own half in index.tsx. A share rather than a
  // height so that the split survives the window shrinking under a keyboard.
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.grey4,
  },
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
    fontWeight: "600",
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
  input: {
    fontSize: 16,
    color: colors.black,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    // Android gives inputs their own vertical padding on top of the row's.
    paddingVertical: 0,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    backgroundColor: colors.grey5,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  coordinates: {
    flex: 1,
    fontSize: 15,
    color: colors.black,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
  },
  chip: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.grey5,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.black,
  },
  chipTextSelected: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.white,
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
    color: colors.grey2,
  },
  // Outside the scroll view: the button is the point of the sheet, so it stays
  // on the sheet rather than under whatever the fields have pushed off it.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    // No safe-area inset: the map screen is a tab screen, and the tab bar below
    // it is what the home indicator is already cleared by.
    paddingBottom: 12,
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
