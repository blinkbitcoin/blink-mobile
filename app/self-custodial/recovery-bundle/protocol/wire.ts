/* eslint-disable no-bitwise -- protobuf varint/tag encoding is bit manipulation */
/**
 * Minimal protobuf wire-format primitives for the handful of Spark operator
 * messages the recovery-bundle exporter needs. Hand-rolled instead of pulling
 * in a protobuf runtime: only varint and length-delimited wire types are used
 * by those messages, and decoding keeps raw sub-message bytes so TreeNodes can
 * be stored byte-for-byte as received (preserving fields we don't model).
 */

export const WireType = {
  Varint: 0,
  Fixed64: 1,
  LengthDelimited: 2,
  Fixed32: 5,
} as const

export type WireField = {
  fieldNumber: number
  wireType: number
  /** Varint value (present for wire type 0). Fits Spark's timestamps/values. */
  varint?: bigint
  /** Raw payload bytes (present for wire type 2). */
  bytes?: Uint8Array
}

export class ProtoWriter {
  private chunks: number[] = []

  private pushVarint(value: bigint): void {
    let v = value
    if (v < 0n) {
      // Negative int32/int64 values are encoded as 10-byte two's complement varints
      v &= 0xffffffffffffffffn
    }
    while (v > 0x7fn) {
      this.chunks.push(Number(v & 0x7fn) | 0x80)
      v >>= 7n
    }
    this.chunks.push(Number(v))
  }

  private pushTag(fieldNumber: number, wireType: number): void {
    this.pushVarint(BigInt((fieldNumber << 3) | wireType))
  }

  /** Writes a varint field; omitted when zero, matching proto3 default elision. */
  varint(fieldNumber: number, value: bigint | number): this {
    const v = typeof value === "number" ? BigInt(value) : value
    if (v === 0n) return this
    this.pushTag(fieldNumber, WireType.Varint)
    this.pushVarint(v)
    return this
  }

  bool(fieldNumber: number, value: boolean): this {
    return this.varint(fieldNumber, value ? 1n : 0n)
  }

  /** Writes a length-delimited field; omitted when empty. */
  bytes(fieldNumber: number, value: Uint8Array): this {
    if (value.length === 0) return this
    this.pushTag(fieldNumber, WireType.LengthDelimited)
    this.pushVarint(BigInt(value.length))
    for (const byte of value) this.chunks.push(byte)
    return this
  }

  string(fieldNumber: number, value: string): this {
    return this.bytes(fieldNumber, Uint8Array.from(Buffer.from(value, "utf8")))
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.chunks)
  }
}

export const decodeFields = (data: Uint8Array): WireField[] => {
  const fields: WireField[] = []
  let offset = 0

  const readVarint = (): bigint => {
    let result = 0n
    let shift = 0n
    for (;;) {
      if (offset >= data.length) throw new Error("proto: truncated varint")
      const byte = data[offset]
      offset += 1
      result |= BigInt(byte & 0x7f) << shift
      if ((byte & 0x80) === 0) return result
      shift += 7n
      if (shift > 63n) throw new Error("proto: varint too long")
    }
  }

  while (offset < data.length) {
    const tag = readVarint()
    const fieldNumber = Number(tag >> 3n)
    const wireType = Number(tag & 0x7n)
    if (fieldNumber === 0) throw new Error("proto: invalid field number 0")

    switch (wireType) {
      case WireType.Varint:
        fields.push({ fieldNumber, wireType, varint: readVarint() })
        break
      case WireType.LengthDelimited: {
        const length = Number(readVarint())
        if (offset + length > data.length) throw new Error("proto: truncated bytes")
        fields.push({
          fieldNumber,
          wireType,
          bytes: data.subarray(offset, offset + length),
        })
        offset += length
        break
      }
      case WireType.Fixed64:
        if (offset + 8 > data.length) throw new Error("proto: truncated fixed64")
        fields.push({ fieldNumber, wireType, bytes: data.subarray(offset, offset + 8) })
        offset += 8
        break
      case WireType.Fixed32:
        if (offset + 4 > data.length) throw new Error("proto: truncated fixed32")
        fields.push({ fieldNumber, wireType, bytes: data.subarray(offset, offset + 4) })
        offset += 4
        break
      default:
        throw new Error(`proto: unsupported wire type ${wireType}`)
    }
  }

  return fields
}

export const firstField = (
  fields: WireField[],
  fieldNumber: number,
): WireField | undefined => fields.find((f) => f.fieldNumber === fieldNumber)

export const utf8Decode = (bytes: Uint8Array): string =>
  Buffer.from(bytes).toString("utf8")
