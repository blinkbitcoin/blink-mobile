import path from "path"

import { isInstalled, root } from "../../scripts/meawallet-mpp"

const mockExistsSync = jest.fn()
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: (target: string) => mockExistsSync(target),
}))

const VENDORED_ROOT = path.resolve(__dirname, "../../vendor/meawallet/react-native-mpp")

describe("meawallet-mpp", () => {
  beforeEach(() => {
    mockExistsSync.mockReset()
  })

  it("points at the copy the install script vendors", () => {
    expect(root).toBe(VENDORED_ROOT)
  })

  it("counts the SDK as installed once its package.json is there", () => {
    mockExistsSync.mockReturnValue(true)

    expect(isInstalled()).toBe(true)
    expect(mockExistsSync).toHaveBeenCalledWith(path.join(VENDORED_ROOT, "package.json"))
  })

  it("counts the SDK as missing without it", () => {
    mockExistsSync.mockReturnValue(false)

    expect(isInstalled()).toBe(false)
  })
})
