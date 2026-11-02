import React from "react"
import { ActivityIndicator } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"

import {
  ALL_DIRECTIONS,
  NoResultsCard,
  TransactionHistoryFilters,
  toggleDirection,
  type DirectionFilter,
} from "@app/screens/transaction-history/transaction-history-filters"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { ContextForScreen } from "./helper"

describe("toggleDirection", () => {
  it("switches one direction off and leaves the other on", () => {
    expect(toggleDirection(ALL_DIRECTIONS, "sent")).toEqual({
      sent: false,
      received: true,
    })
  })

  it("switches a direction back on", () => {
    expect(toggleDirection({ sent: false, received: true }, "sent")).toEqual(
      ALL_DIRECTIONS,
    )
  })

  it("brings both back when the last one on is switched off", () => {
    expect(toggleDirection({ sent: false, received: true }, "received")).toEqual(
      ALL_DIRECTIONS,
    )
    expect(toggleDirection({ sent: true, received: false }, "sent")).toEqual(
      ALL_DIRECTIONS,
    )
  })

  it("does not change the filter it was given", () => {
    const current = { ...ALL_DIRECTIONS }
    toggleDirection(current, "sent")
    expect(current).toEqual(ALL_DIRECTIONS)
  })
})

describe("TransactionHistoryFilters", () => {
  beforeEach(() => loadLocale("en"))

  const renderPanel = (directions: DirectionFilter = ALL_DIRECTIONS, searchText = "") => {
    const onToggleDirection = jest.fn()
    const onSearchTextChange = jest.fn()
    render(
      <ContextForScreen>
        <TransactionHistoryFilters
          directions={directions}
          onToggleDirection={onToggleDirection}
          searchText={searchText}
          onSearchTextChange={onSearchTextChange}
        />
      </ContextForScreen>,
    )
    return { onToggleDirection, onSearchTextChange }
  }

  it("shows Sent and Received as selected by default", () => {
    renderPanel()

    expect(screen.getByTestId("filter-sent").props.accessibilityState).toMatchObject({
      selected: true,
    })
    expect(screen.getByTestId("filter-received").props.accessibilityState).toMatchObject({
      selected: true,
    })
  })

  it("marks a direction that is off as not selected", () => {
    renderPanel({ sent: false, received: true })

    expect(screen.getByTestId("filter-sent").props.accessibilityState).toMatchObject({
      selected: false,
    })
  })

  it("reports which tab was tapped", () => {
    const { onToggleDirection } = renderPanel()

    fireEvent.press(screen.getByTestId("filter-received"))
    fireEvent.press(screen.getByTestId("filter-sent"))

    expect(onToggleDirection.mock.calls).toEqual([["received"], ["sent"]])
  })

  it("passes typed search text through", () => {
    const { onSearchTextChange } = renderPanel()

    fireEvent.changeText(screen.getByTestId("transaction-history-search"), "coffee")

    expect(onSearchTextChange).toHaveBeenCalledWith("coffee")
  })

  it("shows the search text it is given", () => {
    renderPanel(ALL_DIRECTIONS, "coffee")

    expect(screen.getByTestId("transaction-history-search").props.value).toBe("coffee")
  })

  it("shows the search placeholder", () => {
    renderPanel()

    expect(screen.getByPlaceholderText("Search...")).toBeTruthy()
  })
})

describe("NoResultsCard", () => {
  beforeEach(() => loadLocale("en"))

  it("says nothing came back once the search is done", () => {
    render(
      <ContextForScreen>
        <NoResultsCard expanding={false} />
      </ContextForScreen>,
    )

    expect(screen.getByText("Nothing came back")).toBeTruthy()
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull()
  })

  it("shows a spinner while older payments load to search through", () => {
    render(
      <ContextForScreen>
        <NoResultsCard expanding />
      </ContextForScreen>,
    )

    expect(screen.getByText("Expanding search")).toBeTruthy()
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })
})
