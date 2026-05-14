import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

type MnemonicWordsGridProps = {
  words: readonly string[]
  startIndex?: number
}

export const MnemonicWordsGrid: React.FC<MnemonicWordsGridProps> = ({
  words,
  startIndex = 0,
}) => {
  const styles = useStyles()
  const wordsPerColumn = Math.ceil(words.length / 2)
  const leftColumn = words.slice(0, wordsPerColumn)
  const rightColumn = words.slice(wordsPerColumn)

  const renderCell = (word: string, columnIndex: number) => {
    const number = startIndex + columnIndex + 1
    return (
      <View key={`${number}-${word}`} style={styles.cell}>
        <Text style={styles.number}>{`${number}. `}</Text>
        <Text style={styles.word}>{word}</Text>
      </View>
    )
  }

  return (
    <View style={styles.grid}>
      {leftColumn.map((word, i) => (
        <View key={`row-${i}`} style={styles.row}>
          {renderCell(word, i)}
          {rightColumn[i] === undefined
            ? null
            : renderCell(rightColumn[i], i + wordsPerColumn)}
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  grid: {
    gap: 10,
    width: "100%",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  number: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.grey2,
  },
  word: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
  },
}))
