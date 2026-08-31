import React from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
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
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

type Props = {
  isVisible: boolean
  /** Where the pin was dropped, which is what the place is being added at. */
  location: LatLng | null
  /**
   * Sends the place. Resolves to why it did not go — a message ready to be
   * read — or to null when it did.
   */
  onSubmit: (submission: PlaceSubmission) => Promise<string | null>
  /** Back to the map to move the pin, keeping whatever has been typed. */
  onChangeLocation: () => void
  onClose: () => void
}

/**
 * What is being added, once its location has been picked.
 *
 * Full screen rather than a sheet over the map: the location question has
 * already been answered by this point, so there is nothing left to see behind
 * it, and the fields plus a keyboard do not fit under one.
 *
 * The name and the category are both required — see `buildPlaceSubmission` for
 * why the category is. Submit stays disabled rather than explaining itself
 * afterwards, since which of the two is missing is visible on the form.
 *
 * What has been typed lives exactly as long as one attempt at adding a place:
 * the map re-keys this component when a new one starts, so going back to move
 * the pin keeps the form and starting again never inherits an abandoned one.
 */
export const AddPlaceModal: React.FC<Props> = ({
  isVisible,
  location,
  onSubmit,
  onChangeLocation,
  onClose,
}) => {
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const insets = useSafeAreaInsets()
  const styles = useStyles({ topInset: insets.top, bottomInset: insets.bottom })

  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState<PlaceCategory | null>(null)
  // Sending is a round trip. The guard keeps a second tap from firing a
  // concurrent mutation, and the spinner is what tells the first tap landed.
  const [isSubmitting, setSubmitting] = React.useState(false)
  // Why the last send did not go. It is shown here rather than raised as a
  // toast because this is a native modal and the app's toast is mounted outside
  // it: a toast raised from behind this window is drawn behind it too, so the
  // failure would be invisible and the form would look untouched.
  const [error, setError] = React.useState<string | null>(null)

  const nameInputRef = React.useRef<TextInput>(null)

  // A failure on the form is about the place as it stood, so editing the place
  // — name, category, or the pin (see the location row) — takes it off:
  // otherwise a refusal keeps accusing a place that no longer exists.
  const editName = (text: string) => {
    setName(text)
    setError(null)
  }
  const editCategory = (option: PlaceCategory) => {
    setCategory((current) => (current === option ? null : option))
    setError(null)
  }

  const submission = buildPlaceSubmission({ name, category, location })
  const isSubmitDisabled = !submission || isSubmitting

  const submit = async () => {
    if (!submission || isSubmitting) return
    setSubmitting(true)
    setError(null)
    try {
      setError(await onSubmit(submission))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      transparent={false}
      // `autoFocus` is unreliable inside a Modal on Android — the field mounts
      // before the window it lives in is attached — so the field is focused
      // once the window is actually on screen. Not when there is already a name
      // in it: coming back from moving the pin should leave the form as it was.
      onShow={() => {
        if (!name) nameInputRef.current?.focus()
      }}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        // Android already resizes the window for the keyboard; adding padding on
        // top of that pushes the submit button off its own screen.
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            <View style={styles.locationRow}>
              <GaloyIcon name="map-pin" size={16} color={colors.grey1} />
              <Text style={styles.coordinates} numberOfLines={1}>
                {location ? formatCoordinates(location) : ""}
              </Text>
              <Pressable
                testID="change-place-location"
                // The failure was about the place as it stood, pin included, so
                // it stops being true the moment the pin is on the move.
                onPress={() => {
                  setError(null)
                  onChangeLocation()
                }}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.change}>{LL.MapScreen.changeLocation()}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{LL.MapScreen.placeName()}</Text>
            <TextInput
              testID="place-name-input"
              ref={nameInputRef}
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
      </KeyboardAvoidingView>
    </Modal>
  )
}

type StyleProps = { topInset: number; bottomInset: number }

const useStyles = makeStyles(({ colors }, { topInset, bottomInset }: StyleProps) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: topInset + 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: colors.black,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    rowGap: 20,
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
  change: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: bottomInset + 12,
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
