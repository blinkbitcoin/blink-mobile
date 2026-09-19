import {
  GrpcWebError,
  grpcWebUnaryCall,
} from "@app/self-custodial/recovery-bundle/protocol/grpc-web"

const frame = (flag: number, payload: Uint8Array): Uint8Array => {
  const framed = new Uint8Array(5 + payload.length)
  framed[0] = flag
  new DataView(framed.buffer).setUint32(1, payload.length, false)
  framed.set(payload, 5)
  return framed
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const textBytes = (text: string): Uint8Array => Uint8Array.from(Buffer.from(text, "utf8"))

type MockResponse = {
  ok?: boolean
  status?: number
  headers?: Record<string, string>
  body?: Uint8Array
}

const mockFetchOnce = ({ ok = true, status = 200, headers = {}, body }: MockResponse) => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    arrayBuffer: async () =>
      (body ?? new Uint8Array(0)).buffer.slice(
        (body ?? new Uint8Array(0)).byteOffset,
        (body ?? new Uint8Array(0)).byteOffset + (body ?? new Uint8Array(0)).byteLength,
      ),
  })
  global.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

describe("grpcWebUnaryCall", () => {
  const params = {
    baseUrl: "https://operator.example",
    methodPath: "/spark.SparkService/query_nodes",
    request: Uint8Array.from([1, 2, 3]),
  }

  it("frames the request and returns the message frame", async () => {
    const message = Uint8Array.from([9, 8, 7])
    const fetchMock = mockFetchOnce({
      body: concat(frame(0, message), frame(0x80, textBytes("grpc-status: 0"))),
    })

    const result = await grpcWebUnaryCall({ ...params, authorization: "Bearer tok" })
    expect(Buffer.from(result)).toEqual(Buffer.from(message))

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://operator.example/spark.SparkService/query_nodes")
    expect(init.headers["Content-Type"]).toBe("application/grpc-web+proto")
    expect(init.headers.Authorization).toBe("Bearer tok")
    // 5-byte prefix: flag 0 + big-endian length 3
    expect(Buffer.from(init.body)).toEqual(Buffer.from([0, 0, 0, 0, 3, 1, 2, 3]))
  })

  it("throws on non-zero grpc-status in trailers", async () => {
    mockFetchOnce({
      body: concat(
        frame(0, Uint8Array.from([1])),
        frame(0x80, textBytes("grpc-status: 16\r\ngrpc-message: unauthenticated")),
      ),
    })
    await expect(grpcWebUnaryCall(params)).rejects.toThrow(/status 16.*unauthenticated/)
  })

  it("throws on trailers-only responses with grpc-status in HTTP headers", async () => {
    mockFetchOnce({ headers: { "grpc-status": "5", "grpc-message": "not found" } })
    await expect(grpcWebUnaryCall(params)).rejects.toMatchObject({ grpcStatus: 5 })
  })

  it("throws on HTTP errors", async () => {
    mockFetchOnce({ ok: false, status: 503 })
    await expect(grpcWebUnaryCall(params)).rejects.toMatchObject({ httpStatus: 503 })
  })

  it("throws when no message frame is present", async () => {
    mockFetchOnce({ body: frame(0x80, textBytes("grpc-status: 0")) })
    await expect(grpcWebUnaryCall(params)).rejects.toThrow(/no message frame/)
  })

  it("wraps network failures in GrpcWebError", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("boom")) as unknown as typeof fetch
    await expect(grpcWebUnaryCall(params)).rejects.toBeInstanceOf(GrpcWebError)
  })

  it("rejects a compressed message frame instead of feeding it to the decoder", async () => {
    // Flag bit 0x01 = compressed. Compression is never negotiated, so this
    // must fail as a protocol violation, not as a cryptic protobuf error.
    mockFetchOnce({
      body: concat(
        frame(0x01, Uint8Array.from([1, 2, 3])),
        frame(0x80, textBytes("grpc-status: 0")),
      ),
    })
    await expect(grpcWebUnaryCall(params)).rejects.toThrow(/compressed/)
  })

  it("rejects a response with a message frame but no trailers frame", async () => {
    // A stream cut after the message frame may have swallowed a non-OK
    // grpc-status; missing trailers must not be treated as success.
    mockFetchOnce({ body: frame(0, Uint8Array.from([1, 2, 3])) })
    await expect(grpcWebUnaryCall(params)).rejects.toThrow(/without a trailers frame/)
  })

  it("accepts a message frame without trailers when grpc-status: 0 came in the HTTP headers", async () => {
    const message = Uint8Array.from([4, 5, 6])
    mockFetchOnce({ headers: { "grpc-status": "0" }, body: frame(0, message) })
    const result = await grpcWebUnaryCall(params)
    expect(Buffer.from(result)).toEqual(Buffer.from(message))
  })

  it("aborts a hung call after the 30s timeout and reports it as a network error", async () => {
    jest.useFakeTimers()
    try {
      global.fetch = jest.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new Error("Aborted")))
          }),
      ) as unknown as typeof fetch

      const pending = grpcWebUnaryCall(params).then(
        () => {
          throw new Error("expected the call to reject on timeout")
        },
        (err) => err,
      )
      jest.advanceTimersByTime(30_000)
      const error = await pending
      expect(error).toMatchObject({
        name: "GrpcWebError",
        message: expect.stringContaining("network error"),
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it("rejects a trailing remainder shorter than a frame header", async () => {
    // 2 stray bytes after the trailers frame: the stream was cut mid-frame.
    mockFetchOnce({
      body: concat(
        frame(0, Uint8Array.from([1])),
        frame(0x80, textBytes("grpc-status: 0")),
        Uint8Array.from([0x80, 0x00]),
      ),
    })
    await expect(grpcWebUnaryCall(params)).rejects.toThrow(/truncated/)
  })
})
