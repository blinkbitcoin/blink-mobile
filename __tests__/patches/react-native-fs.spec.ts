import { readFileSync } from "fs"
import { join } from "path"

/**
 * React Native's TurboModule interop can't pass a JS number to an Objective-C pointer
 * argument: it throws "Objective C type NSInteger is unsupported" before the method runs.
 * Upstream react-native-fs declares `read`'s length and position as `NSInteger *`, so on
 * iOS every `RNFS.read` rejected and the wallet log export always failed (#4373).
 * patches/react-native-fs+*.patch fixes the signature; the JS specs mock the module, so
 * this is the only check that would notice the patch going missing.
 */
const exportedMethods = (source: string): string[] =>
  source.match(/RCT_EXPORT_METHOD\([^{]*/g) ?? []

const PRIMITIVE_POINTER = /\((?:NSInteger|NSUInteger|int|long|double|float|BOOL)\s*\*\)/

describe("react-native-fs iOS module", () => {
  const source = readFileSync(
    join(__dirname, "../../node_modules/react-native-fs/RNFSManager.m"),
    "utf8",
  )

  it("exports read", () => {
    expect(exportedMethods(source).some((method) => method.includes("(read:"))).toBe(true)
  })

  it("takes no exported argument as a pointer to a number", () => {
    const offending = exportedMethods(source).filter((method) =>
      PRIMITIVE_POINTER.test(method),
    )
    expect(offending).toEqual([])
  })
})
