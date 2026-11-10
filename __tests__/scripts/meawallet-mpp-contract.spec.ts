import { existsSync } from "fs"
import path from "path"
import * as ts from "typescript"

const ROOT = path.resolve(__dirname, "../..")
const CONTRACT_CONFIG = path.join(ROOT, "scripts/tsconfig.meawallet-mpp-contract.json")
const SDK_TYPES = path.join(
  ROOT,
  "vendor/meawallet/react-native-mpp/lib/typescript/index.d.ts",
)

/** The type errors compiling the contract reports, as readable lines. */
const contractErrors = (): string[] => {
  const { config } = ts.readConfigFile(CONTRACT_CONFIG, ts.sys.readFile)
  const { options, fileNames } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    path.dirname(CONTRACT_CONFIG),
  )
  const program = ts.createProgram(fileNames, options)
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
}

/** Only where the SDK is vendored: elsewhere there are no types to check against, and
 *  the build goes without the SDK anyway. */
const describeWithSdk = existsSync(SDK_TYPES) ? describe : describe.skip

describeWithSdk("the SDK slice the app types by hand", () => {
  it("still matches the vendored package's own types", () => {
    expect(contractErrors()).toEqual([])
  })
})
