/**
 * Fetches Google's libaddressinput metadata for all countries and bundles
 * it as a static JSON file used at runtime for address validation.
 *
 * Source: https://chromium-i18n.appspot.com/ssl-address
 * Same dataset Chrome and Android use for address forms.
 *
 * Usage: node scripts/fetch-address-metadata.mjs
 */

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = path.join(SCRIPT_DIR, "../app/utils/address-metadata/data.json")
const API_BASE_URL = "https://chromium-i18n.appspot.com/ssl-address/data"
const BATCH_SIZE = 10
const FALLBACK_COUNTRY_CODE = "ZZ"

const fetchJSON = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

const normalizeCountry = ({
  key,
  name,
  fmt,
  require: requiredFields,
  zip,
  zipex,
  upper,
  zip_name_type: zipNameType,
  state_name_type: stateNameType,
  sub_keys: subKeys,
  sub_names: subNames,
}) => {
  const normalized = { key, name }

  if (fmt) normalized.fmt = fmt
  if (requiredFields) normalized.require = requiredFields
  if (zip) normalized.zip = zip
  if (zipex) normalized.zipex = zipex
  if (upper) normalized.upper = upper
  if (zipNameType) normalized.zipNameType = zipNameType
  if (stateNameType) normalized.stateNameType = stateNameType

  if (subKeys) {
    normalized.subKeys = subKeys.split("~")
    normalized.subNames = (subNames ?? subKeys).split("~")
  }

  return normalized
}

const fetchAllCountries = async (countryCodes) => {
  const results = []

  for (let offset = 0; offset < countryCodes.length; offset += BATCH_SIZE) {
    const batch = countryCodes.slice(offset, offset + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((code) => fetchJSON(`${API_BASE_URL}/${code}`)),
    )
    results.push(...batchResults)

    const fetched = Math.min(offset + BATCH_SIZE, countryCodes.length)
    process.stdout.write(`  fetched ${fetched}/${countryCodes.length}\r`)
  }

  process.stdout.write("\n")
  return results
}

const main = async () => {
  console.log("Fetching country list...")
  const root = await fetchJSON(API_BASE_URL)
  const countryCodes = root.countries.split("~")

  console.log(`Fetching metadata for ${countryCodes.length} countries...`)
  const rawCountries = await fetchAllCountries(countryCodes)

  console.log("Fetching fallback (ZZ)...")
  const rawFallback = await fetchJSON(`${API_BASE_URL}/${FALLBACK_COUNTRY_CODE}`)
  rawFallback.key = rawFallback.key ?? FALLBACK_COUNTRY_CODE
  rawFallback.name = rawFallback.name ?? "DEFAULT"

  const countries = Object.fromEntries(
    rawCountries.map((entry) => [entry.key, normalizeCountry(entry)]),
  )

  const output = {
    generated: new Date().toISOString().split("T")[0],
    fallback: normalizeCountry(rawFallback),
    countries,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n")
  console.log(`Done! ${Object.keys(countries).length} countries → ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
