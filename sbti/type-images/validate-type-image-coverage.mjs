#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { types, drunkType, hhhhType } from '../../src/data/types.js'

const TYPE_CODE_NORMALIZED = Object.freeze({
  'FU?K': 'FUKK',
  'WOC!': 'WOC',
})

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir)
const manifestPath = path.join(root, 'locale-type-image-manifest.json')

function normalizeTypeCode(rawCode = '') {
  if (!rawCode || typeof rawCode !== 'string') {
    return ''
  }
  return TYPE_CODE_NORMALIZED[rawCode] || rawCode.trim()
}

function getCanonicalTypeCodes() {
  const unique = new Set()

  for (const item of types) {
    const normalized = normalizeTypeCode(item.code)
    if (normalized) {
      unique.add(normalized)
    }
  }

  const extraCodes = [drunkType?.code, hhhhType?.code]
  for (const rawCode of extraCodes) {
    const normalized = normalizeTypeCode(rawCode)
    if (normalized) {
      unique.add(normalized)
    }
  }

  return [...unique].sort()
}

const contract = {
  localeFallbackChain: ['currentLocale', 'zh', 'placeholder'],
  supportedLocales: ['zh', 'en', 'ja'],
  placeholderPath: '/type-images/placeholder/placeholder.png',
}

function fail(message) {
  console.error(`[type-image-coverage] ${message}`)
  process.exitCode = 1
}

if (!fs.existsSync(manifestPath)) {
  fail(`Missing manifest: ${manifestPath}`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const canonicalTypeCodes = getCanonicalTypeCodes()
const manifestTypeCodes = new Set(Array.isArray(manifest.typeCodes) ? manifest.typeCodes : [])
const missingFromManifest = canonicalTypeCodes.filter((code) => !manifestTypeCodes.has(code))
if (missingFromManifest.length) {
  fail(`Manifest missing canonical type codes: ${missingFromManifest.join(', ')}`)
}

const unexpectedManifestCodes = [...manifestTypeCodes].filter((code) => !canonicalTypeCodes.includes(normalizeTypeCode(code)))
if (unexpectedManifestCodes.length) {
  fail(`Manifest has unknown type codes (outside runtime canonical + normalized set): ${unexpectedManifestCodes.join(', ')}`)
}

if (JSON.stringify(manifest.contract?.localeFallbackChain) !== JSON.stringify(contract.localeFallbackChain)) {
  fail('Manifest fallback chain mismatch')
}

if (!manifest.contract?.placeholderFile) {
  fail('Manifest placeholder path missing')
}

const placeholderPath = path.join(root, 'placeholder', 'placeholder.png')
if (!fs.existsSync(placeholderPath)) {
  fail('Missing placeholder asset: placeholder/placeholder.png')
}

// ---------------------------------------------------------------------------
// Enhanced checks: PNG magic bytes + non-placeholder validation (T003 B-step)
// ---------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MIN_COMPOSED_BYTES = 50 * 1024  // F7-4 AC: composed images ≥ 50 KB

/** Return true if buffer starts with PNG magic bytes. */
function isPngMagic(buf) {
  if (buf.length < 8) return false
  return PNG_MAGIC.every((b, i) => buf[i] === b)
}

/**
 * Compute SHA-256 of a file, reading only first 16 KB (enough to fingerprint
 * small placeholder files without loading large composed images fully).
 * For a reliable full-file hash comparison, reads up to 256 KB.
 */
function fileHash(filePath) {
  const SAMPLE = 256 * 1024
  const fd = fs.openSync(filePath, 'r')
  const buf = Buffer.alloc(SAMPLE)
  const read = fs.readSync(fd, buf, 0, SAMPLE, 0)
  fs.closeSync(fd)
  return crypto.createHash('sha256').update(buf.subarray(0, read)).digest('hex')
}

// Compute placeholder hash once (used to detect files that are identical to
// the known placeholder asset — these would not be composed images).
const placeholderHash = fs.existsSync(placeholderPath) ? fileHash(placeholderPath) : null

/**
 * Validate a single image file:
 *   1. File exists
 *   2. PNG magic bytes valid
 *   3. File size ≥ MIN_COMPOSED_BYTES (non-placeholder threshold)
 *   4. SHA-256 prefix differs from placeholder.png (extra safety net)
 */
function validateImageFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing ${label}: ${filePath}`)
    return
  }

  const stat = fs.statSync(filePath)

  // Read first 8 bytes for PNG magic
  const fd = fs.openSync(filePath, 'r')
  const header = Buffer.alloc(8)
  fs.readSync(fd, header, 0, 8, 0)
  fs.closeSync(fd)

  if (!isPngMagic(header)) {
    fail(`Not a valid PNG (bad magic bytes) — ${label}: ${filePath}`)
    return
  }

  if (stat.size < MIN_COMPOSED_BYTES) {
    fail(
      `File too small (${Math.round(stat.size / 1024)} KB < 50 KB) — ` +
      `likely a placeholder — ${label}: ${filePath}`
    )
    return
  }

  // Extra guard: if hash matches placeholder, it's definitely not composed
  if (placeholderHash) {
    const h = fileHash(filePath)
    if (h === placeholderHash) {
      fail(`File hash matches placeholder.png — not a composed image — ${label}: ${filePath}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Per-locale file existence + quality checks
// ---------------------------------------------------------------------------

const zhDir = path.join(root, 'zh')
for (const code of canonicalTypeCodes) {
  const pngPath = path.join(zhDir, `${code}.png`)
  const jpgPath = path.join(zhDir, `${code}.jpg`)
  const hasPng = fs.existsSync(pngPath)
  const hasJpg = fs.existsSync(jpgPath)
  if (!hasPng && !hasJpg) {
    fail(`Missing zh asset for ${code}`)
  } else {
    // Validate whichever exists; skip magic check for jpg (different magic)
    if (hasPng) {
      validateImageFile(pngPath, `zh/${code}`)
    } else {
      // jpg: only size check (not PNG magic)
      const stat = fs.statSync(jpgPath)
      if (stat.size < MIN_COMPOSED_BYTES) {
        fail(`zh/${code}.jpg too small (${Math.round(stat.size / 1024)} KB < 50 KB)`)
      }
    }
  }
}

for (const locale of contract.supportedLocales) {
  if (!manifest.coverage?.[locale]) {
    fail(`Manifest missing coverage section for ${locale}`)
    continue
  }

  const localeDir = path.join(root, locale)
  for (const code of canonicalTypeCodes) {
    const pngPath = path.join(localeDir, `${code}.png`)
    const jpgPath = path.join(localeDir, `${code}.jpg`)
    const hasPng = fs.existsSync(pngPath)
    const hasJpg = fs.existsSync(jpgPath)
    if (!hasPng && !hasJpg) {
      fail(`Missing ${locale} asset for ${code}`)
    } else {
      if (hasPng) {
        validateImageFile(pngPath, `${locale}/${code}`)
      } else {
        const stat = fs.statSync(jpgPath)
        if (stat.size < MIN_COMPOSED_BYTES) {
          fail(`${locale}/${code}.jpg too small (${Math.round(stat.size / 1024)} KB < 50 KB)`)
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Manifest coverage status check: all locales should be 'primary' after B-step
// ---------------------------------------------------------------------------
for (const locale of contract.supportedLocales) {
  const cov = manifest.coverage?.[locale]
  if (!cov) continue
  if (cov.status !== 'primary') {
    fail(`manifest.coverage.${locale}.status is '${cov.status}', expected 'primary' (set by B-step)`)
  }
}

if (process.exitCode) {
  process.exit(process.exitCode)
}

console.log('[type-image-coverage] All checks passed: manifest, PNG magic bytes, size, placeholder, and coverage status.')
