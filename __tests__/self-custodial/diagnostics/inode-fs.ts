/**
 * An in-memory react-native-fs whose files are inodes, and a stand-in for the SDK's
 * file logger. As on Android and iOS, a file the logger has open keeps receiving its
 * lines after its path is unlinked, moved or replaced; that is what the log lifecycle
 * has to get right, and what a path-keyed mock can't show.
 *
 * State lives on globalThis so a module graph reloaded with jest.isolateModules (a new
 * process) still sees the same disk.
 */

type Inode = { data: Buffer }

type DiskState = {
  files: Map<string, Inode>
  dirs: Set<string>
  /** The inode the running logger appends to, if it opened a file. */
  loggerFile: Inode | undefined
  loggerStarts: number
  failures: Map<string, Error>
  holds: Map<string, Promise<void>>
}

const globalDisk = globalThis as { __inodeDisk?: DiskState }
if (!globalDisk.__inodeDisk) {
  globalDisk.__inodeDisk = {
    files: new Map(),
    dirs: new Set(),
    loggerFile: undefined,
    loggerStarts: 0,
    failures: new Map(),
    holds: new Map(),
  }
}
const disk: DiskState = globalDisk.__inodeDisk

/** A new device: empty disk, no logger running. */
export const resetDisk = (): void => {
  disk.files.clear()
  disk.dirs.clear()
  disk.loggerFile = undefined
  disk.loggerStarts = 0
  disk.failures.clear()
  disk.holds.clear()
}

/** A process exit: the logger's handle goes away, the disk stays. */
export const endProcess = (): void => {
  disk.loggerFile = undefined
}

/** Makes the next call of an RNFS operation on `path` reject. */
export const failNext = (operation: string, path: string, error = new Error(operation)) =>
  disk.failures.set(`${operation}:${path}`, error)

/** Makes the next call of an RNFS operation on `path` wait until the returned release
 *  is called: a way to stop one async flow part-way while another runs. */
export const holdNext = (operation: string, path: string): (() => void) => {
  let release: () => void = () => {}
  disk.holds.set(
    `${operation}:${path}`,
    new Promise<void>((resolve) => {
      release = resolve
    }),
  )
  return () => release()
}

const waitIfHeld = async (operation: string, path: string): Promise<void> => {
  const key = `${operation}:${path}`
  const hold = disk.holds.get(key)
  if (!hold) return
  disk.holds.delete(key)
  await hold
}

const maybeFail = (operation: string, path: string): void => {
  const key = `${operation}:${path}`
  const error = disk.failures.get(key)
  if (!error) return
  disk.failures.delete(key)
  throw error
}

export const makeDir = (path: string): void => {
  disk.dirs.add(path)
}

export const writeText = (path: string, text: string): void => {
  disk.files.set(path, { data: Buffer.from(text, "utf8") })
}

export const readText = (path: string): string | undefined =>
  disk.files.get(path)?.data.toString("utf8")

export const hasPath = (path: string): boolean =>
  disk.files.has(path) || disk.dirs.has(path)

export const loggerStarts = (): number => disk.loggerStarts

/** Every file reachable by path, joined: what a later export or a person could read. A
 *  file the logger still holds after its path is gone is not reachable, so not here. */
export const everythingOnDisk = (): string =>
  [...disk.files.values()].map((inode) => inode.data.toString("utf8")).join("\n")

/** A line from the SDK, appended to whatever inode the logger holds. */
export const sdkWrites = (line: string): void => {
  if (!disk.loggerFile) return
  disk.loggerFile.data = Buffer.concat([disk.loggerFile.data, Buffer.from(`${line}\n`)])
}

/** The SDK's initLogging: opens `{logDir}/sdk.log` for append and holds it. */
export const initLogging = (logDir: string | undefined): void => {
  maybeFail("initLogging", logDir ?? "")
  disk.loggerStarts += 1
  if (logDir === undefined) return
  const path = `${logDir}/sdk.log`
  const inode = disk.files.get(path) ?? { data: Buffer.alloc(0) }
  disk.files.set(path, inode)
  disk.loggerFile = inode
}

export const rnfs = {
  CachesDirectoryPath: "/caches",
  DocumentDirectoryPath: "/documents",
  mkdir: async (path: string) => {
    maybeFail("mkdir", path)
    disk.dirs.add(path)
  },
  exists: async (path: string) => {
    maybeFail("exists", path)
    return hasPath(path)
  },
  stat: async (path: string) => {
    const inode = disk.files.get(path)
    if (!inode) throw new Error(`${path} does not exist`)
    return { size: inode.data.length }
  },
  read: async (
    ...[path, length, position, encoding]: [string, number, number, string]
  ) => {
    await waitIfHeld("read", path)
    maybeFail("read", path)
    if (encoding !== "base64")
      throw new Error("utf8 range reads throw on a split character")
    // Android's RNFS allocates `new byte[length]`, so a negative length rejects
    if (length < 0) throw new Error("NegativeArraySizeException")
    const inode = disk.files.get(path)
    if (!inode) throw new Error(`${path} does not exist`)
    return inode.data.subarray(position, position + length).toString("base64")
  },
  readFile: async (path: string) => {
    maybeFail("readFile", path)
    const inode = disk.files.get(path)
    if (!inode) throw new Error(`${path} does not exist`)
    return inode.data.toString("utf8")
  },
  /** Replaces the path with a new inode, as iOS does; a held handle keeps the old one. */
  writeFile: async (path: string, contents: string, encoding = "utf8") => {
    maybeFail("writeFile", path)
    disk.files.set(path, { data: Buffer.from(contents, encoding as BufferEncoding) })
  },
  unlink: async (path: string) => {
    maybeFail("unlink", path)
    if (disk.dirs.delete(path)) {
      for (const file of [...disk.files.keys()]) {
        if (file.startsWith(`${path}/`)) disk.files.delete(file)
      }
      return
    }
    if (!disk.files.delete(path)) throw new Error(`${path} does not exist`)
  },
  /** Refuses an existing destination, as NSFileManager does on iOS. */
  moveFile: async (from: string, to: string) => {
    maybeFail("moveFile", from)
    if (disk.files.has(to)) throw new Error(`${to} already exists`)
    const inode = disk.files.get(from)
    if (!inode) throw new Error(`${from} does not exist`)
    disk.files.delete(from)
    disk.files.set(to, inode)
  },
}
