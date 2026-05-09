/* eslint-disable camelcase */
import { classifySdkError, SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"

jest.mock("@breeztech/breez-sdk-spark-react-native", () => {
  const tags = {
    SparkError: "SparkError",
    InsufficientFunds: "InsufficientFunds",
    InvalidUuid: "InvalidUuid",
    InvalidInput: "InvalidInput",
    NetworkError: "NetworkError",
    StorageError: "StorageError",
    ChainServiceError: "ChainServiceError",
    MaxDepositClaimFeeExceeded: "MaxDepositClaimFeeExceeded",
    MissingUtxo: "MissingUtxo",
    LnurlError: "LnurlError",
    Signer: "Signer",
    Generic: "Generic",
  }
  return {
    SdkError: {
      instanceOf: (obj: unknown) =>
        typeof obj === "object" && obj !== null && "tag" in obj,
    },
    SdkError_Tags: tags,
  }
})

const sdkError = (tag: string, inner?: readonly [string]) => ({ tag, inner })

describe("classifySdkError", () => {
  it("classifies non-SdkError exceptions as Generic", () => {
    expect(classifySdkError(new Error("plain js error"))).toBe(
      SelfCustodialErrorCode.Generic,
    )
    expect(classifySdkError("string thrown")).toBe(SelfCustodialErrorCode.Generic)
    expect(classifySdkError(undefined)).toBe(SelfCustodialErrorCode.Generic)
  })

  it("maps InsufficientFunds tag directly", () => {
    expect(classifySdkError(sdkError("InsufficientFunds"))).toBe(
      SelfCustodialErrorCode.InsufficientFunds,
    )
  })

  it("maps MaxDepositClaimFeeExceeded as InsufficientFunds (not enough left for fees)", () => {
    expect(classifySdkError(sdkError("MaxDepositClaimFeeExceeded"))).toBe(
      SelfCustodialErrorCode.InsufficientFunds,
    )
  })

  it("maps NetworkError and ChainServiceError to NetworkError", () => {
    expect(classifySdkError(sdkError("NetworkError"))).toBe(
      SelfCustodialErrorCode.NetworkError,
    )
    expect(classifySdkError(sdkError("ChainServiceError"))).toBe(
      SelfCustodialErrorCode.NetworkError,
    )
  })

  it("maps invalid-input shaped tags to InvalidInput", () => {
    for (const tag of ["InvalidInput", "InvalidUuid", "LnurlError", "MissingUtxo"]) {
      expect(classifySdkError(sdkError(tag))).toBe(SelfCustodialErrorCode.InvalidInput)
    }
  })

  it("maps purely technical tags to Generic", () => {
    for (const tag of ["StorageError", "Signer"]) {
      expect(classifySdkError(sdkError(tag))).toBe(SelfCustodialErrorCode.Generic)
    }
  })

  it("refines SparkError using its inner string", () => {
    expect(
      classifySdkError(
        sdkError("SparkError", ["Tree service error: insufficient funds"]),
      ),
    ).toBe(SelfCustodialErrorCode.InsufficientFunds)
    expect(classifySdkError(sdkError("SparkError", ["amount below minimum"]))).toBe(
      SelfCustodialErrorCode.BelowMinimum,
    )
    expect(classifySdkError(sdkError("SparkError", ["network unreachable"]))).toBe(
      SelfCustodialErrorCode.NetworkError,
    )
    expect(classifySdkError(sdkError("SparkError", ["request timeout"]))).toBe(
      SelfCustodialErrorCode.NetworkError,
    )
  })

  it("refines Generic using its inner string (real-world conversion failure)", () => {
    expect(
      classifySdkError(
        sdkError("Generic", [
          "Wallet: Service error: token output service error: insufficient funds",
        ]),
      ),
    ).toBe(SelfCustodialErrorCode.InsufficientFunds)
  })

  it("falls back to the tag mapping when no inner hint matches", () => {
    expect(classifySdkError(sdkError("SparkError", ["some other failure"]))).toBe(
      SelfCustodialErrorCode.Generic,
    )
    expect(classifySdkError(sdkError("Generic", ["unrecognized cause"]))).toBe(
      SelfCustodialErrorCode.Generic,
    )
  })

  it("handles wrapper tags missing or malformed inner without throwing", () => {
    expect(classifySdkError(sdkError("Generic"))).toBe(SelfCustodialErrorCode.Generic)
    expect(classifySdkError({ tag: "SparkError", inner: [] })).toBe(
      SelfCustodialErrorCode.Generic,
    )
  })

  it("refines InvalidInput using its inner string (Critical #9)", () => {
    expect(classifySdkError(sdkError("InvalidInput", ["amount below minimum"]))).toBe(
      SelfCustodialErrorCode.BelowMinimum,
    )
  })

  it("refines InsufficientFunds using its inner string (Critical #9)", () => {
    expect(
      classifySdkError(sdkError("InsufficientFunds", ["amount below minimum"])),
    ).toBe(SelfCustodialErrorCode.BelowMinimum)
  })

  it("falls back to the tag mapping for InvalidInput when no inner hint matches", () => {
    expect(classifySdkError(sdkError("InvalidInput", ["some other failure"]))).toBe(
      SelfCustodialErrorCode.InvalidInput,
    )
  })
})
