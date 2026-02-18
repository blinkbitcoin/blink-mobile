import React, { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, Pressable } from "react-native"
import { makeStyles, useTheme } from "@rn-vui/themed"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import BottomSheet from "./bottom-sheet"

type Props = {
  visible: boolean
  onClose: () => void
  merchantName?: string
}

export const VerifyMerchantSheet: React.FC<Props> = ({ visible, onClose, merchantName }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const [vote, setVote] = useState<"yes" | "no" | null>(null)
  const [comment, setComment] = useState("")

  const handleSendReport = () => {
    // TODO: API call
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} peekHeight={340}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Can you pay with bitcoin here?</Text>
          <TouchableOpacity hitSlop={8}>
            <GaloyIcon name="share" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.voteRow}>
          <Pressable
            style={[styles.voteButton, vote === "yes" && styles.voteButtonYesActive]}
            onPress={() => setVote("yes")}
          >
            <Text style={[styles.voteText, vote === "yes" && styles.voteTextYesActive]}>
              Yes
            </Text>
            <Text style={styles.voteEmoji}>👍</Text>
          </Pressable>

          <Pressable
            style={[styles.voteButton, vote === "no" && styles.voteButtonNoActive]}
            onPress={() => setVote("no")}
          >
            <Text style={[styles.voteText, vote === "no" && styles.voteTextNoActive]}>
              No
            </Text>
            <Text style={styles.voteEmoji}>👎</Text>
          </Pressable>
        </View>

        <Text style={styles.commentLabel}>Optional comment</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Additional comment"
            placeholderTextColor={colors.grey3}
            value={comment}
            onChangeText={setComment}
            multiline={false}
          />
          <GaloyIcon name="pencil" size={16} color={colors.primary} />
        </View>

        <TouchableOpacity
          style={[styles.sendButton, !vote && styles.sendButtonDisabled]}
          onPress={handleSendReport}
          disabled={!vote}
        >
          <Text style={styles.sendButtonText}>Send report</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.black,
    flex: 1,
    marginRight: 10,
  },
  voteRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  voteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.grey5,
    borderWidth: 2,
    borderColor: "transparent",
  },
  voteButtonYesActive: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  voteButtonNoActive: {
    borderColor: colors.error,
    backgroundColor: "#FEF2F2",
  },
  voteText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  voteTextYesActive: {
    color: "#22C55E",
  },
  voteTextNoActive: {
    color: colors.error,
  },
  voteEmoji: {
    fontSize: 18,
  },
  commentLabel: {
    fontSize: 13,
    color: colors.grey2,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.black,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
}))
