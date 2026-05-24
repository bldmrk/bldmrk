import sharp from 'sharp'

export interface ProcessedMedia {
  original: Buffer
  webp: Buffer
  avif: Buffer
  thumbnail: Buffer
  width: number
  height: number
  size: number
}

export const MediaProcessor = {
  async resize(input: Buffer, maxWidth: number): Promise<Buffer> {
    return sharp(input)
      .resize(maxWidth, undefined, { withoutEnlargement: true })
      .toBuffer()
  },

  async toWebP(input: Buffer, quality = 85): Promise<Buffer> {
    return sharp(input).webp({ quality }).toBuffer()
  },

  async toAVIF(input: Buffer, quality = 80): Promise<Buffer> {
    return sharp(input).avif({ quality }).toBuffer()
  },

  async thumbnail(input: Buffer, size: number): Promise<Buffer> {
    return sharp(input)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .toBuffer()
  },

  async processUpload(input: Buffer, _filename: string): Promise<ProcessedMedia> {
    const meta = await sharp(input).metadata()
    let webp = input
    let avif = input
    let thumbnail = input
    try {
      ;[webp, avif, thumbnail] = await Promise.all([
        MediaProcessor.toWebP(input),
        MediaProcessor.toAVIF(input),
        MediaProcessor.thumbnail(input, 200),
      ])
    } catch {
      // Fallback to original if image conversion fails (e.g. SVG, unsupported format)
    }
    return {
      original: input,
      webp,
      avif,
      thumbnail,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      size: input.length,
    }
  },
}
