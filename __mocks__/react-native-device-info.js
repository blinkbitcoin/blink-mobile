const getReadableVersion = jest.fn(() => "1.0.0")
const getBuildNumber = jest.fn(() => "1234")

export { getReadableVersion, getBuildNumber }

export default {
  getReadableVersion,
  getBuildNumber,
}
