/* eslint-disable no-undef */
// Real bytes rather than a constant: tests assert that two attempts mint two
// different submission ids.
import { randomBytes } from "crypto"

module.exports = {
  generateSecureRandom: jest.fn(async (size) => new Uint8Array(randomBytes(size))),
}
