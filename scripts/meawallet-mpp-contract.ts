/**
 * The app types its slice of @meawallet/react-native-mpp by hand (MppPackage), since a
 * normal build never sees the vendored package. This checks that slice against the
 * package's own types wherever the SDK is vendored, so a method renamed or a field changed
 * by an SDK bump fails here instead of hiding the wallet at runtime. It sits outside
 * tsconfig.json, which CI type-checks without the package; the spec in
 * __tests__/scripts/meawallet-mpp-contract.spec.ts compiles it with
 * scripts/tsconfig.meawallet-mpp-contract.json.
 */
import type * as Mpp from "@meawallet/react-native-mpp"

import type { MppPackage } from "../app/screens/card-screen/utils/meawallet-sdk"

declare const mpp: typeof Mpp

export const contract = mpp satisfies MppPackage
