import {
  parseStringToNumberPad,
  numberPadToString,
  formatNumberPadNumber,
  NumberPadNumber,
} from "@app/components/amount-input-screen/number-pad-reducer"

describe("parseStringToNumberPad", () => {
  it("parses integer string", () => {
    const result = parseStringToNumberPad("1000")
    expect(result).toEqual({
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("parses decimal string", () => {
    const result = parseStringToNumberPad("1000.50")
    expect(result).toEqual({
      majorAmount: "1000",
      minorAmount: "50",
      hasDecimal: true,
    })
  })

  it("parses string with trailing decimal", () => {
    const result = parseStringToNumberPad("1000.")
    expect(result).toEqual({
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: true,
    })
  })

  it("parses empty string", () => {
    const result = parseStringToNumberPad("")
    expect(result).toEqual({
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("parses zero", () => {
    const result = parseStringToNumberPad("0")
    expect(result).toEqual({
      majorAmount: "0",
      minorAmount: "",
      hasDecimal: false,
    })
  })

  it("parses decimal less than 1", () => {
    const result = parseStringToNumberPad("0.99")
    expect(result).toEqual({
      majorAmount: "0",
      minorAmount: "99",
      hasDecimal: true,
    })
  })
})

describe("numberPadToString", () => {
  it("converts integer numberPad to string", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(numberPadToString(numberPad)).toBe("1000")
  })

  it("converts decimal numberPad to string", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "50",
      hasDecimal: true,
    }
    expect(numberPadToString(numberPad)).toBe("1000.50")
  })

  it("converts numberPad with trailing decimal to string", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: true,
    }
    expect(numberPadToString(numberPad)).toBe("1000.")
  })

  it("converts empty numberPad to zero", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(numberPadToString(numberPad)).toBe("0")
  })

  it("converts decimal with empty major to string with zero", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "",
      minorAmount: "50",
      hasDecimal: true,
    }
    expect(numberPadToString(numberPad)).toBe("0.50")
  })
})

describe("formatNumberPadNumber", () => {
  it("formats integer with locale separators", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("1,000")
  })

  it("formats large number with locale separators", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000000",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("1,000,000")
  })

  it("formats decimal number", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "50",
      hasDecimal: true,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("1,000.50")
  })

  it("formats number with trailing decimal", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "1000",
      minorAmount: "",
      hasDecimal: true,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("1,000.")
  })

  it("returns empty string for empty numberPad", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("")
  })

  it("formats zero correctly", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "0",
      minorAmount: "",
      hasDecimal: false,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("0")
  })

  it("formats decimal less than 1", () => {
    const numberPad: NumberPadNumber = {
      majorAmount: "0",
      minorAmount: "99",
      hasDecimal: true,
    }
    expect(formatNumberPadNumber(numberPad)).toBe("0.99")
  })
})
