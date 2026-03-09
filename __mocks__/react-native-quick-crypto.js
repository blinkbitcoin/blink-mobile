/* eslint-disable no-undef */
const mockCipher = {
  update: jest.fn().mockReturnValue(Buffer.from("encrypted")),
  final: jest.fn().mockReturnValue(Buffer.from("")),
  getAuthTag: jest.fn().mockReturnValue(Buffer.from("0123456789abcdef")),
}

module.exports = {
  __esModule: true,
  default: {
    randomBytes: jest.fn((size) => Buffer.alloc(size, 0xab)),
    publicEncrypt: jest.fn().mockReturnValue(Buffer.from("rsa-encrypted-data")),
    createCipheriv: jest.fn().mockReturnValue(mockCipher),
    constants: {
      RSA_PKCS1_OAEP_PADDING: 4,
    },
  },
}
