import {
  decodeFields,
  firstField,
  ProtoWriter,
  utf8Decode,
  WireType,
} from "@app/self-custodial/recovery-bundle/protocol/wire"

describe("protobuf wire codec", () => {
  it("roundtrips varint fields including multi-byte values", () => {
    const encoded = new ProtoWriter()
      .varint(1, 1)
      .varint(2, 300)
      .varint(3, 0x7fffffffffffffffn)
      .finish()

    const fields = decodeFields(encoded)
    expect(firstField(fields, 1)?.varint).toBe(1n)
    expect(firstField(fields, 2)?.varint).toBe(300n)
    expect(firstField(fields, 3)?.varint).toBe(0x7fffffffffffffffn)
  })

  it("omits zero varints and empty bytes, matching proto3 default elision", () => {
    const encoded = new ProtoWriter()
      .varint(1, 0)
      .bytes(2, new Uint8Array(0))
      .bool(3, false)
      .finish()
    expect(encoded).toHaveLength(0)
  })

  it("encodes negative int64 as 10-byte two's-complement varint", () => {
    const encoded = new ProtoWriter().varint(1, -1n).finish()
    // tag byte + 10 varint bytes
    expect(encoded).toHaveLength(11)
    const fields = decodeFields(encoded)
    expect(BigInt.asIntN(64, firstField(fields, 1)?.varint ?? 0n)).toBe(-1n)
  })

  it("roundtrips strings and nested messages", () => {
    const inner = new ProtoWriter().string(1, "node-id").varint(2, 42).finish()
    const outer = new ProtoWriter().bytes(1, inner).string(2, "outer ✓").finish()

    const fields = decodeFields(outer)
    const innerFields = decodeFields(firstField(fields, 1)?.bytes ?? new Uint8Array(0))
    expect(utf8Decode(firstField(innerFields, 1)?.bytes ?? new Uint8Array(0))).toBe(
      "node-id",
    )
    expect(firstField(innerFields, 2)?.varint).toBe(42n)
    expect(utf8Decode(firstField(fields, 2)?.bytes ?? new Uint8Array(0))).toBe("outer ✓")
  })

  it("preserves raw bytes for length-delimited fields", () => {
    const payload = Uint8Array.from([0xde, 0xad, 0xbe, 0xef])
    const encoded = new ProtoWriter().bytes(5, payload).finish()
    const field = firstField(decodeFields(encoded), 5)
    expect(field?.wireType).toBe(WireType.LengthDelimited)
    expect(Buffer.from(field?.bytes ?? []).toString("hex")).toBe("deadbeef")
  })

  it("skips fixed32/fixed64 fields without corrupting subsequent fields", () => {
    // Craft: field 1 fixed64 (tag 0x09), field 2 varint (tag 0x10)
    const raw = Uint8Array.from([0x09, 1, 2, 3, 4, 5, 6, 7, 8, 0x10, 7])
    const fields = decodeFields(raw)
    expect(firstField(fields, 2)?.varint).toBe(7n)
  })

  it("throws on truncated input", () => {
    const encoded = new ProtoWriter().bytes(1, Uint8Array.from([1, 2, 3])).finish()
    expect(() => decodeFields(encoded.subarray(0, encoded.length - 1))).toThrow(
      /truncated/,
    )
  })
})
