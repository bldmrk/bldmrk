import { describe, it, expect, beforeAll } from 'vitest'
import sharp from 'sharp'
import { MediaProcessor } from './MediaProcessor.js'

let testImage: Buffer

beforeAll(async () => {
  testImage = await sharp({
    create: { width: 200, height: 150, channels: 3, background: { r: 255, g: 100, b: 50 } },
  })
    .jpeg()
    .toBuffer()
})

describe('MediaProcessor.resize()', () => {
  it('outputs image with width <= maxWidth', async () => {
    const result = await MediaProcessor.resize(testImage, 100)
    const meta = await sharp(result).metadata()
    expect(meta.width).toBeLessThanOrEqual(100)
  })

  it('does not upscale images smaller than maxWidth', async () => {
    const result = await MediaProcessor.resize(testImage, 500)
    const meta = await sharp(result).metadata()
    expect(meta.width).toBeLessThanOrEqual(200)
  })
})

describe('MediaProcessor.toWebP()', () => {
  it('outputs valid WebP (RIFF magic bytes)', async () => {
    const result = await MediaProcessor.toWebP(testImage)
    expect(result[0]).toBe(0x52) // R
    expect(result[1]).toBe(0x49) // I
    expect(result[2]).toBe(0x46) // F
    expect(result[3]).toBe(0x46) // F
  })

  it('accepts custom quality', async () => {
    const r60 = await MediaProcessor.toWebP(testImage, 60)
    const r90 = await MediaProcessor.toWebP(testImage, 90)
    expect(r60.length).toBeLessThan(r90.length)
  })
})

describe('MediaProcessor.toAVIF()', () => {
  it('outputs Buffer with data', async () => {
    const result = await MediaProcessor.toAVIF(testImage)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('MediaProcessor.thumbnail()', () => {
  it('outputs square image of exact size', async () => {
    const result = await MediaProcessor.thumbnail(testImage, 64)
    const meta = await sharp(result).metadata()
    expect(meta.width).toBe(64)
    expect(meta.height).toBe(64)
  })
})

describe('MediaProcessor.processUpload()', () => {
  it('returns all variants as Buffers', async () => {
    const result = await MediaProcessor.processUpload(testImage, 'test.jpg')
    expect(result.original).toBeInstanceOf(Buffer)
    expect(result.webp).toBeInstanceOf(Buffer)
    expect(result.avif).toBeInstanceOf(Buffer)
    expect(result.thumbnail).toBeInstanceOf(Buffer)
  })

  it('returns correct image dimensions', async () => {
    const result = await MediaProcessor.processUpload(testImage, 'test.jpg')
    expect(result.width).toBe(200)
    expect(result.height).toBe(150)
  })

  it('returns file size > 0', async () => {
    const result = await MediaProcessor.processUpload(testImage, 'test.jpg')
    expect(result.size).toBeGreaterThan(0)
  })
})
