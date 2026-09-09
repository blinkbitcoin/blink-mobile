module.exports = {
  DocumentDirectoryPath: "/mock/documents",
  CachesDirectoryPath: "/mock/caches",
  TemporaryDirectoryPath: "/mock/temp",
  DownloadDirectoryPath: "/mock/downloads",
  exists: jest.fn().mockResolvedValue(false),
  writeFile: jest.fn().mockResolvedValue(undefined),
  scanFile: jest.fn().mockResolvedValue([]),
}
