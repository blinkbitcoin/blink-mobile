import {
  modalContentBleed,
  toastSideInset,
  toastTopOffset,
} from "@app/components/galoy-toast/toast-frame"

describe("toastSideInset", () => {
  it("keeps a 20dp gap on a phone, independent of width", () => {
    expect(toastSideInset(320)).toEqual({ marginLeft: 20, marginRight: 20 })
    expect(toastSideInset(360)).toEqual({ marginLeft: 20, marginRight: 20 })
    expect(toastSideInset(599)).toEqual({ marginLeft: 20, marginRight: 20 })
  })

  it("uses the safe-area inset when a cutout is deeper than 20", () => {
    expect(toastSideInset(360, 47, 0)).toEqual({ marginLeft: 47, marginRight: 20 })
  })

  it("caps the row at 480 and centres it once the window is a tablet", () => {
    expect(toastSideInset(600)).toEqual({ marginLeft: 60, marginRight: 60 })
    expect(toastSideInset(768)).toEqual({ marginLeft: 144, marginRight: 144 })
    expect(toastSideInset(1024)).toEqual({ marginLeft: 272, marginRight: 272 })
  })

  it("centres inside the safe area on a tablet", () => {
    expect(toastSideInset(768, 24, 24)).toEqual({ marginLeft: 144, marginRight: 144 })
  })
})

describe("toastTopOffset", () => {
  it("sits 40 below the safe area on the root window", () => {
    expect(toastTopOffset({ safeTop: 0, inModal: false, platform: "android" })).toBe(40)
    expect(toastTopOffset({ safeTop: 24, inModal: false, platform: "android" })).toBe(64)
    expect(toastTopOffset({ safeTop: 59, inModal: false, platform: "ios" })).toBe(99)
  })

  it("does not add the status bar again inside an Android modal", () => {
    expect(toastTopOffset({ safeTop: 24, inModal: true, platform: "android" })).toBe(40)
    expect(toastTopOffset({ safeTop: 48, inModal: true, platform: "android" })).toBe(40)
  })

  it("still clears the notch inside an iOS modal", () => {
    expect(toastTopOffset({ safeTop: 59, inModal: true, platform: "ios" })).toBe(99)
  })
})

describe("modalContentBleed", () => {
  it("is zero on the root window", () => {
    expect(modalContentBleed(360, false)).toBe(0)
    expect(modalContentBleed(1024, false)).toBe(0)
  })

  it("cancels the modal content margin so the 20dp inset is from the window", () => {
    expect(modalContentBleed(360, true)).toBe(18)
    expect(modalContentBleed(768, true)).toBeCloseTo(38.4)
    expect(modalContentBleed(1024, true)).toBeCloseTo(51.2)
  })
})
