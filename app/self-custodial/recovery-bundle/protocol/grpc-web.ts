/**
 * Unary gRPC-web client over fetch, sufficient for the two Spark operator
 * services the exporter calls. The Spark operators serve gRPC-web on the same
 * URLs as native gRPC (the Spark SDK's browser/WASM builds use it), and unary
 * calls need no response streaming, so plain fetch + arrayBuffer works in
 * React Native.
 */

const GRPC_WEB_CONTENT_TYPE = "application/grpc-web+proto"
const TRAILER_FLAG = 0x80
/** Compression is never negotiated (no grpc-encoding header is sent), so a
 * compressed frame is a protocol violation - e.g. a proxy that compresses
 * anyway. Passing it to the protobuf decoder would fail with a misleading
 * wire-format error. */
const COMPRESSED_FLAG = 0x01
const CALL_TIMEOUT_MS = 30_000
const GRPC_STATUS_OK = 0
const DECIMAL_STATUS_CODE = /^\d+$/

export class GrpcWebError extends Error {
  constructor(
    readonly grpcStatus: number | undefined,
    readonly httpStatus: number | undefined,
    message: string,
  ) {
    super(message)
    this.name = "GrpcWebError"
  }
}

const frameRequest = (message: Uint8Array): Uint8Array => {
  const framed = new Uint8Array(5 + message.length)
  framed[0] = 0
  new DataView(framed.buffer).setUint32(1, message.length, false)
  framed.set(message, 5)
  return framed
}

type Frame = { flag: number; payload: Uint8Array }

const parseFrames = (body: Uint8Array): Frame[] => {
  const frames: Frame[] = []
  let offset = 0
  while (offset + 5 <= body.length) {
    const flag = body[offset]
    const length = new DataView(body.buffer, body.byteOffset + offset + 1, 4).getUint32(
      0,
      false,
    )
    offset += 5
    if (offset + length > body.length) {
      throw new GrpcWebError(undefined, undefined, "grpc-web: truncated response frame")
    }
    frames.push({ flag, payload: body.subarray(offset, offset + length) })
    offset += length
  }
  if (offset !== body.length) {
    // A remainder shorter than a 5-byte frame header means the stream was cut
    // mid-frame; dropping it silently could hide a lost trailers frame.
    throw new GrpcWebError(undefined, undefined, "grpc-web: truncated response frame")
  }
  return frames
}

const parseTrailers = (payload: Uint8Array): Map<string, string> => {
  const trailers = new Map<string, string>()
  for (const line of Buffer.from(payload).toString("utf8").split("\r\n")) {
    const separator = line.indexOf(":")
    if (separator !== -1) {
      trailers.set(
        line.slice(0, separator).trim().toLowerCase(),
        line.slice(separator + 1).trim(),
      )
    }
  }
  return trailers
}

/** Response headers and a parsed trailers frame both answer `get` by name. */
type GrpcMetadata = { get: (name: string) => string | null | undefined }

/**
 * Reports whether the metadata carries an OK grpc-status, and throws when it
 * carries any other value. A status that is not a decimal code is refused too:
 * it cannot vouch for the call having completed any more than a failing one.
 */
const hasOkGrpcStatus = (
  metadata: GrpcMetadata,
  methodPath: string,
  httpStatus: number,
): boolean => {
  const status = metadata.get("grpc-status")
  const isStatusAbsent = status === null || status === undefined
  if (isStatusAbsent) return false
  if (!DECIMAL_STATUS_CODE.test(status)) {
    throw new GrpcWebError(
      undefined,
      httpStatus,
      `grpc-web: ${methodPath} returned a malformed grpc-status "${status}"`,
    )
  }
  const code = Number(status)
  if (code !== GRPC_STATUS_OK) {
    throw new GrpcWebError(
      code,
      httpStatus,
      `grpc-web: ${methodPath} failed with status ${code}: ${
        metadata.get("grpc-message") ?? ""
      }`,
    )
  }
  return true
}

type UnaryCallParams = {
  baseUrl: string
  /** Full method path, e.g. "/spark.SparkService/query_nodes". */
  methodPath: string
  request: Uint8Array
  /** Value for the `authorization` header, if the method requires a session. */
  authorization?: string
  /** Per-call timeout override; callers with an overall deadline pass their
   * remaining budget so one call cannot outlive it. Capped by the default. */
  timeoutMs?: number
}

export const grpcWebUnaryCall = async ({
  baseUrl,
  methodPath,
  request,
  authorization,
  timeoutMs,
}: UnaryCallParams): Promise<Uint8Array> => {
  const headers: Record<string, string> = {
    "Content-Type": GRPC_WEB_CONTENT_TYPE,
    "Accept": GRPC_WEB_CONTENT_TYPE,
    "X-Grpc-Web": "1",
    "X-User-Agent": "blink-mobile-recovery-bundle",
  }
  if (authorization) headers.Authorization = authorization

  const controller = new AbortController()
  const effectiveTimeoutMs = Math.min(timeoutMs ?? CALL_TIMEOUT_MS, CALL_TIMEOUT_MS)
  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs)

  let response: Response
  let body: Uint8Array
  try {
    response = await fetch(`${baseUrl}${methodPath}`, {
      method: "POST",
      headers,
      body: frameRequest(request),
      signal: controller.signal,
    })
    body = new Uint8Array(await response.arrayBuffer())
  } catch (err) {
    throw new GrpcWebError(
      undefined,
      undefined,
      `grpc-web: ${methodPath} network error: ${err instanceof Error ? err.message : String(err)}`,
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new GrpcWebError(
      undefined,
      response.status,
      `grpc-web: ${methodPath} failed with HTTP ${response.status}`,
    )
  }

  // Trailers-only responses carry grpc-status in the HTTP headers
  const isOkInHeaders = hasOkGrpcStatus(response.headers, methodPath, response.status)

  let message: Uint8Array | undefined
  let isOkInTrailers = false
  for (const frame of parseFrames(body)) {
    // eslint-disable-next-line no-bitwise -- gRPC-web compressed flag is the low bit
    if (frame.flag & COMPRESSED_FLAG) {
      throw new GrpcWebError(
        undefined,
        response.status,
        `grpc-web: ${methodPath} returned a compressed frame (not supported)`,
      )
    }
    // eslint-disable-next-line no-bitwise -- gRPC-web trailer flag is the high bit
    const isTrailerFrame = (frame.flag & TRAILER_FLAG) !== 0
    const isOkTrailerFrame =
      isTrailerFrame &&
      hasOkGrpcStatus(parseTrailers(frame.payload), methodPath, response.status)
    if (isOkTrailerFrame) isOkInTrailers = true
    const isFirstMessageFrame = !isTrailerFrame && message === undefined
    if (isFirstMessageFrame) message = frame.payload
  }

  /**
   * The grpc-status is the call's authoritative outcome, and it arrives in the
   * trailers frame unless the server already sent it in the HTTP headers. A
   * body without one was cut short or rewritten by a proxy, so a failing
   * status may never have arrived. Neither case counts as success.
   */
  const isOkStatusReported = isOkInHeaders || isOkInTrailers
  if (!isOkStatusReported) {
    throw new GrpcWebError(
      undefined,
      response.status,
      `grpc-web: ${methodPath} response carried no grpc-status`,
    )
  }

  if (message === undefined) {
    throw new GrpcWebError(
      undefined,
      response.status,
      `grpc-web: ${methodPath} returned no message frame`,
    )
  }
  return message
}
