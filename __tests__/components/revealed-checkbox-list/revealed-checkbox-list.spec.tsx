import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { RevealedCheckboxList } from "@app/components/revealed-checkbox-list"

const labels = ["First", "Second", "Third"]

const renderList = (onAllCheckedChange: (allChecked: boolean) => void = jest.fn()) =>
  render(
    <ThemeProvider>
      <RevealedCheckboxList
        labels={labels}
        testIdPrefix="check"
        onAllCheckedChange={onAllCheckedChange}
      />
    </ThemeProvider>,
  )

describe("RevealedCheckboxList", () => {
  it("reveals only the first checkbox until each preceding one is checked", () => {
    renderList()

    expect(screen.getAllByRole("checkbox")).toHaveLength(1)

    fireEvent.press(screen.getByText("First"))
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)

    fireEvent.press(screen.getByText("Second"))
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)
  })

  it("keeps revealed checkboxes visible after an earlier one is unchecked (monotonic)", () => {
    renderList()

    fireEvent.press(screen.getByText("First"))
    fireEvent.press(screen.getByText("Second"))
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)

    fireEvent.press(screen.getByText("First"))
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)
  })

  it("reports allChecked=true only once every box is checked", () => {
    const onAllCheckedChange = jest.fn()
    renderList(onAllCheckedChange)

    fireEvent.press(screen.getByText("First"))
    fireEvent.press(screen.getByText("Second"))
    expect(onAllCheckedChange).not.toHaveBeenCalledWith(true)

    fireEvent.press(screen.getByText("Third"))
    expect(onAllCheckedChange).toHaveBeenLastCalledWith(true)
  })

  it("reports allChecked=false again once a box is unchecked (no one-way latch)", () => {
    const onAllCheckedChange = jest.fn()
    renderList(onAllCheckedChange)

    fireEvent.press(screen.getByText("First"))
    fireEvent.press(screen.getByText("Second"))
    fireEvent.press(screen.getByText("Third"))
    expect(onAllCheckedChange).toHaveBeenLastCalledWith(true)

    fireEvent.press(screen.getByText("First"))
    expect(onAllCheckedChange).toHaveBeenLastCalledWith(false)
  })

  it("gives duplicate labels stable, independent keys (no key collision)", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
    const onAllCheckedChange = jest.fn()
    render(
      <ThemeProvider>
        <RevealedCheckboxList
          labels={["Same", "Same"]}
          testIdPrefix="dup"
          onAllCheckedChange={onAllCheckedChange}
        />
      </ThemeProvider>,
    )

    fireEvent.press(screen.getByTestId("dup-0"))
    expect(onAllCheckedChange).not.toHaveBeenCalledWith(true)
    fireEvent.press(screen.getByTestId("dup-1"))
    expect(onAllCheckedChange).toHaveBeenLastCalledWith(true)

    const keyCollisionWarnings = errorSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === "string" && arg.includes("same key")),
    )
    expect(keyCollisionWarnings).toHaveLength(0)
    errorSpy.mockRestore()
  })
})
