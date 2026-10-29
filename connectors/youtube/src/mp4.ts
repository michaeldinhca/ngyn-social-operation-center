// Reads length and display shape from an MP4 or MOV file without decoding it, so a Short can be
// checked (3 minutes or less, square or vertical) before spending upload quota.
// Walks the box tree: moov > mvhd for duration, moov > trak > tkhd for the video track size.

export interface VideoInfo {
  durationSec: number
  width: number
  height: number
}

interface Box {
  type: string
  start: number
  end: number
}

function* boxes(v: DataView, from: number, to: number): Generator<Box> {
  let at = from
  while (at + 8 <= to) {
    let size = v.getUint32(at)
    const type = String.fromCharCode(v.getUint8(at + 4), v.getUint8(at + 5), v.getUint8(at + 6), v.getUint8(at + 7))
    let header = 8
    if (size === 1) {
      if (at + 16 > to) return
      size = Number(v.getBigUint64(at + 8))
      header = 16
    } else if (size === 0) {
      size = to - at
    }
    if (size < header || at + size > to) return
    yield { type, start: at + header, end: at + size }
    at += size
  }
}

const child = (v: DataView, b: Box, type: string) => [...boxes(v, b.start, b.end)].find((c) => c.type === type)

/** null when the file isn't MP4 or MOV, or has no video track. */
export function mp4Info(bytes: Uint8Array): VideoInfo | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  try {
    const moov = [...boxes(v, 0, bytes.byteLength)].find((b) => b.type === 'moov')
    if (!moov) return null
    const mvhd = child(v, moov, 'mvhd')
    if (!mvhd) return null
    const mv = v.getUint8(mvhd.start)
    const timescale = v.getUint32(mvhd.start + (mv === 1 ? 20 : 12))
    const duration = mv === 1 ? Number(v.getBigUint64(mvhd.start + 24)) : v.getUint32(mvhd.start + 16)
    if (!timescale) return null
    for (const trak of boxes(v, moov.start, moov.end)) {
      if (trak.type !== 'trak') continue
      const tkhd = child(v, trak, 'tkhd')
      if (!tkhd) continue
      // Matrix, then width and height as 16.16 fixed point, sit at the end of the box.
      const matrix = tkhd.end - 44
      const w = v.getUint32(tkhd.end - 8) / 65536
      const h = v.getUint32(tkhd.end - 4) / 65536
      if (!w || !h) continue // audio track
      // Phones often store landscape pixels with a 90 degree rotation; b != 0 means width and height swap on screen.
      const rotated = v.getInt32(matrix + 4) !== 0
      return { durationSec: duration / timescale, width: rotated ? h : w, height: rotated ? w : h }
    }
    return null
  } catch {
    return null
  }
}
