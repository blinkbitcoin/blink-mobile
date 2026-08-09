import React from "react"
import { ScrollView, StyleProp, View, ViewStyle } from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"

type MigrationStepLayoutProps = {
  children: React.ReactNode
  footer: React.ReactNode
  header?: React.ReactNode
  headerShown?: boolean
  contentStyle?: StyleProp<ViewStyle>
}

/**
 * The migration flow's shared step scaffold: an optional header row, the step content,
 * and the footer actions pinned to the bottom with the flow's spacing.
 *
 * The content scrolls so that enlarged system text can never push it into the footer,
 * and the footer is a sibling below the scroll view rather than an overlay, so the
 * scroll area is always whatever height the buttons leave behind.
 */
export const MigrationStepLayout: React.FC<MigrationStepLayoutProps> = ({
  children,
  footer,
  header,
  headerShown,
  contentStyle,
}) => {
  const styles = useStyles()

  return (
    <Screen preset="fixed" headerShown={headerShown}>
      <View style={styles.container}>
        {header}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        <View style={styles.buttonsContainer}>{footer}</View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  scroll: {
    flex: 1,
  },
  content: {
    // flexGrow rather than flex so short content keeps today's full-height box
    // while tall content is allowed to grow past the viewport and scroll.
    flexGrow: 1,
    paddingBottom: 10,
  },
  buttonsContainer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
