/* eslint-disable no-undef */
// A small in-memory filesystem, so code that actually reads and writes files — the
// telemetry outbox — can be tested through its real storage calls rather than through a
// stub of itself. Directories are implicit: a path is a directory if anything is stored
// beneath it, or if `mkdir` recorded it.
const files = new Map()
const directories = new Set()

const normalize = (path) => String(path).replace(/\/+$/, "")

const parentOf = (path) => normalize(path).split("/").slice(0, -1).join("/")

const mkdir = (path) => {
  let current = normalize(path)
  while (current && !directories.has(current)) {
    directories.add(current)
    current = parentOf(current)
  }
  return Promise.resolve()
}

const exists = (path) => {
  const target = normalize(path)
  if (files.has(target) || directories.has(target)) return Promise.resolve(true)
  return Promise.resolve([...files.keys()].some((file) => file.startsWith(`${target}/`)))
}

const writeFile = (path, contents) => {
  const target = normalize(path)
  return mkdir(parentOf(target)).then(() => {
    files.set(target, String(contents))
  })
}

const readFile = (path) => {
  const target = normalize(path)
  if (!files.has(target)) {
    return Promise.reject(new Error(`ENOENT: no such file, open '${target}'`))
  }
  return Promise.resolve(files.get(target))
}

const readDir = (path) => {
  const target = normalize(path)
  if (
    !directories.has(target) &&
    ![...files.keys()].some((f) => f.startsWith(`${target}/`))
  ) {
    return Promise.reject(new Error(`ENOENT: no such directory, scandir '${target}'`))
  }

  const names = new Set()
  for (const file of files.keys()) {
    if (file.startsWith(`${target}/`)) {
      names.add(file.slice(target.length + 1).split("/")[0])
    }
  }

  return Promise.resolve(
    [...names].map((name) => {
      const full = `${target}/${name}`
      return {
        name,
        path: full,
        size: (files.get(full) ?? "").length,
        isFile: () => files.has(full),
        isDirectory: () => !files.has(full),
      }
    }),
  )
}

const unlink = (path) => {
  const target = normalize(path)
  const removedFile = files.delete(target)
  let removedTree = directories.delete(target)

  for (const file of [...files.keys()]) {
    if (file.startsWith(`${target}/`)) {
      files.delete(file)
      removedTree = true
    }
  }
  for (const dir of [...directories]) {
    if (dir.startsWith(`${target}/`)) {
      directories.delete(dir)
      removedTree = true
    }
  }

  if (!removedFile && !removedTree) {
    return Promise.reject(
      new Error(`ENOENT: no such file or directory, unlink '${target}'`),
    )
  }
  return Promise.resolve()
}

module.exports = {
  DocumentDirectoryPath: "/mock/documents",
  CachesDirectoryPath: "/mock/caches",
  TemporaryDirectoryPath: "/mock/temp",
  mkdir,
  exists,
  writeFile,
  readFile,
  readDir,
  unlink,
  // Test seam: the store is module-scoped, so a suite that writes must be able to start
  // from an empty disk.
  __resetMockFileSystem: () => {
    files.clear()
    directories.clear()
  },
  __mockFilePaths: () => [...files.keys()],
}
