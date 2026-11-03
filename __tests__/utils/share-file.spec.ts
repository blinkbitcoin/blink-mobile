import Share from "react-native-share"

import { shareTextFile } from "@app/utils/share-file"

const mockOpen = Share.open as jest.Mock

describe("shareTextFile", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shares the file by URL as plain text, without failing on a dismissal", async () => {
    mockOpen.mockResolvedValue({ success: true })

    await expect(
      shareTextFile("/caches/exports/logs.txt", { title: "logs", subject: "Help" }),
    ).resolves.toBe(true)

    expect(mockOpen).toHaveBeenCalledWith({
      title: "logs",
      subject: "Help",
      url: "file:///caches/exports/logs.txt",
      type: "text/plain",
      failOnCancel: false,
    })
  })

  it("resolves false when the user dismisses the sheet", async () => {
    mockOpen.mockResolvedValue({ success: false, dismissedAction: true })

    await expect(shareTextFile("/caches/logs.txt", { title: "logs" })).resolves.toBe(
      false,
    )
  })

  it("rejects on a real error", async () => {
    mockOpen.mockRejectedValue(new Error("no activity"))

    await expect(shareTextFile("/caches/logs.txt", { title: "logs" })).rejects.toThrow(
      "no activity",
    )
  })
})
