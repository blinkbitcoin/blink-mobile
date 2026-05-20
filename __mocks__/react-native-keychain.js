const setGenericPassword = jest.fn(() => Promise.resolve({ service: "mock-service" }))
const getGenericPassword = jest.fn(() => Promise.resolve(false))
const resetGenericPassword = jest.fn(() => Promise.resolve(true))

export { setGenericPassword, getGenericPassword, resetGenericPassword }

export default {
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
}
