/**
 * AD-23: the contract is data, and the landing schema derives from it.
 *
 * Emits `app/telemetry/telemetry-contract.v<version>.json` from the typed table in
 * `app/telemetry/contract.ts`. The relay's allowlist, the landing schema and the dbt
 * column tests are generated from that artifact, never written by hand, so a parameter
 * change lands in the app, the relay and the tests from one edit — or fails
 * `check:telemetry-contract` if the artifact was not regenerated.
 *
 *   yarn telemetry:contract          # regenerate
 *   yarn check:telemetry-contract    # CI: fail if the committed artifact is stale
 */
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { CONTRACT, CONTRACT_VERSION } from "../app/telemetry/contract"

export const renderContractArtifact = (): string =>
  `${JSON.stringify(
    {
      contractVersion: CONTRACT_VERSION,
      generatedFrom: "app/telemetry/contract.ts",
      events: CONTRACT.map((row) => ({
        name: row.event,
        version: row.version,
        modes: row.modes,
        params: row.params,
        ...(row.review ? { review: row.review } : {}),
      })),
    },
    null,
    2,
  )}\n`

export const artifactPath = (): string =>
  resolve(__dirname, `../app/telemetry/telemetry-contract.v${CONTRACT_VERSION}.json`)

if (require.main === module) {
  writeFileSync(artifactPath(), renderContractArtifact())
  console.log(`wrote ${artifactPath()}`)
}
