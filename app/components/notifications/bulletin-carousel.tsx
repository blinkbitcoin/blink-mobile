import React from "react"
import {
  AccessibilityActionEvent,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from "react-native"

import { makeStyles } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

import { BulletinCarouselItemContext } from "./bulletin-carousel-context"
import { INDICATOR_BAR, indicatorBarWidth } from "./select-carousel-bulletins"

export type CarouselItem = { key: string; node: React.ReactNode }

type Props = { items: readonly CarouselItem[] }

/**
 * One card in view at a time, swiped horizontally. The carousel takes the height of the
 * card in view, without a transition, once a swipe settles and whenever that card grows,
 * shrinks or closes. The card in view is tracked by key, so a refetch
 * keeps the user on the card they were reading. When that card closes, the card that
 * takes its place is the next one in the list.
 */
export const BulletinCarousel: React.FC<Props> = ({ items }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const [width, setWidth] = React.useState(0)
  const [activeKey, setActiveKey] = React.useState(items[0]?.key)
  const lastActiveIndex = React.useRef(0)
  const [heights, setHeights] = React.useState<Record<string, number>>({})
  const scrollRef = React.useRef<ScrollView>(null)
  const scrollX = React.useRef(0)

  const foundIndex = items.findIndex(({ key }) => key === activeKey)
  const activeIndex =
    foundIndex >= 0 ? foundIndex : Math.min(lastActiveIndex.current, items.length - 1)
  const resolvedKey = items[activeIndex]?.key

  React.useEffect(() => {
    lastActiveIndex.current = Math.max(activeIndex, 0)
    if (resolvedKey !== activeKey) setActiveKey(resolvedKey)
  }, [activeIndex, resolvedKey, activeKey])

  /** A card added or closed before the one in view shifts its offset: put the scroll
   *  back on it without animating, so the list change never reads as a swipe. */
  React.useEffect(() => {
    if (!width || activeIndex < 0) return
    const offset = activeIndex * width
    if (Math.abs(scrollX.current - offset) < 1) return
    scrollRef.current?.scrollTo({ x: offset, animated: false })
    scrollX.current = offset
  }, [activeIndex, width, items.length])

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = event.nativeEvent.contentOffset.x
  }

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return
    const index = Math.round(event.nativeEvent.contentOffset.x / width)
    const key = items[Math.max(0, Math.min(index, items.length - 1))]?.key
    if (key) setActiveKey(key)
  }

  const goTo = (index: number) => {
    const key = items[index]?.key
    if (!key || !width) return
    scrollRef.current?.scrollTo({ x: index * width, animated: true })
    setActiveKey(key)
  }

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") goTo(activeIndex + 1)
    if (event.nativeEvent.actionName === "decrement") goTo(activeIndex - 1)
  }

  const activeHeight = resolvedKey ? heights[resolvedKey] : undefined

  const onPageLayout = (key: string) => (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setHeights((current) =>
      current[key] === height ? current : { ...current, [key]: height },
    )
  }

  if (items.length === 0) return null

  const barWidth = indicatorBarWidth(items.length, width)

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width === 0 ? (
        items[0].node
      ) : (
        <View style={[styles.viewport, activeHeight ? { height: activeHeight } : null]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={items.length > 1}
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumScrollEnd}
            contentContainerStyle={styles.pages}
            {...testProps("bulletin-carousel")}
          >
            {items.map(({ key, node }, index) => (
              <View key={key} style={{ width }} onLayout={onPageLayout(key)}>
                <BulletinCarouselItemContext.Provider
                  value={{ isActive: index === activeIndex }}
                >
                  {node}
                </BulletinCarouselItemContext.Provider>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      {barWidth > 0 && (
        <View
          style={styles.indicators}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={LL.HomeScreen.bulletinPosition({
            position: activeIndex + 1,
            total: items.length,
          })}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          {items.map(({ key }, index) => (
            <View
              key={key}
              style={[
                styles.bar,
                { width: barWidth },
                index === activeIndex ? styles.barActive : styles.barInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  viewport: {
    overflow: "hidden",
  },
  pages: {
    alignItems: "flex-start",
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: INDICATOR_BAR.gap,
    marginTop: 8,
  },
  bar: {
    height: INDICATOR_BAR.height,
  },
  barActive: {
    backgroundColor: colors.primary,
  },
  barInactive: {
    backgroundColor: colors.grey4,
  },
}))
