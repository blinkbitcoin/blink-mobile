import {
  coerceNwcTimestampToSeconds,
  getNwcConnectionStatus,
  sortNwcConnectionsByLastUsed,
  toNwcManagedConnection,
} from "@app/screens/nostr-wallet-connect/hooks"

describe("use-nwc-connection-management helpers", () => {
  it("maps backend connections to UI-safe display names", () => {
    const connection = toNwcManagedConnection({
      id: "conn-1",
      alias: null,
      appPubkey: "a".repeat(64),
      permissions: ["GET_INFO"],
      budgets: [],
      revoked: false,
      expiresAt: null,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: 1_000,
      updatedAt: 1_000,
    })

    expect(connection.appName).toBe("aaaaaaaa...aaaaaaaa")
  })

  it("normalizes backend timestamp shapes to unix seconds", () => {
    expect(coerceNwcTimestampToSeconds(1_700_000_000)).toBe(1_700_000_000)
    expect(coerceNwcTimestampToSeconds(1_700_000_000_000)).toBe(1_700_000_000)
    expect(coerceNwcTimestampToSeconds(1_700_000_000_000_000_000)).toBe(1_700_000_000)
    expect(coerceNwcTimestampToSeconds("2023-11-14T22:13:20.000Z")).toBe(1_700_000_000)
  })

  it("normalizes connection timestamps while mapping backend fields", () => {
    const connection = toNwcManagedConnection({
      id: "conn-1",
      alias: "Amethyst",
      appPubkey: "a".repeat(64),
      permissions: ["GET_INFO"],
      budgets: [
        {
          amountSats: 10_000,
          usedSats: 1_000,
          remainingSats: 9_000,
          period: "DAILY",
          resetsAt: "2023-11-14T22:13:20.000Z",
        },
      ],
      revoked: false,
      expiresAt: "1700000000",
      revokedAt: null,
      lastUsedAt: "2023-11-14T22:13:20.000Z",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000,
    })

    expect(connection.expiresAt).toBe(1_700_000_000)
    expect(connection.lastUsedAt).toBe(1_700_000_000)
    expect(connection.createdAt).toBe(1_700_000_000)
    expect(connection.budgets[0].resetsAt).toBe(1_700_000_000)
  })

  it("sorts by last used descending and falls back to created date", () => {
    const connections = [
      {
        id: "old",
        appName: "Old",
        appPubkey: "a",
        permissions: [],
        budgets: [],
        revoked: false,
        lastUsedAt: 100,
        createdAt: 300,
        updatedAt: 300,
      },
      {
        id: "new",
        appName: "New",
        appPubkey: "b",
        permissions: [],
        budgets: [],
        revoked: false,
        lastUsedAt: 200,
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: "fallback",
        appName: "Fallback",
        appPubkey: "c",
        permissions: [],
        budgets: [],
        revoked: false,
        lastUsedAt: null,
        createdAt: 150,
        updatedAt: 150,
      },
    ]

    expect(sortNwcConnectionsByLastUsed(connections).map((c) => c.id)).toEqual([
      "new",
      "fallback",
      "old",
    ])
  })

  it("derives active, expired, and revoked statuses", () => {
    expect(getNwcConnectionStatus({ revoked: false, expiresAt: null }, 100)).toBe(
      "active",
    )
    expect(getNwcConnectionStatus({ revoked: false, expiresAt: 100 }, 100)).toBe(
      "expired",
    )
    expect(getNwcConnectionStatus({ revoked: true, expiresAt: 200 }, 100)).toBe("revoked")
  })
})
