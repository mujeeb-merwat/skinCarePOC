import type { BoundingBox } from '@mediapipe/tasks-vision'

export type Rect = {
  x: number
  y: number
  w: number
  h: number
}

export type FaceValidationStatus =
  | 'no_face'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'valid'

export type FaceValidationResult = {
  status: FaceValidationStatus
  message: string
}

const MIN_SCORE = 0.5
const GUIDE_INSET = 0.78
const GUIDE_INNER_PAD = 0.05

// Expand tight BlazeFace boxes so forehead/chin count toward the frame
const FACE_EXPAND_WIDTH = 0.12
const FACE_EXPAND_HEIGHT = 0.25

// Enter/exit bands to prevent flip-flopping at size thresholds
const SIZE_ENTER = 0.3
const SIZE_EXIT = 0.26
const SIZE_MAX_ENTER = 0.92
const SIZE_MAX_EXIT = 0.96

const STABILIZER_FRAMES = 3

const STATUS_MESSAGES: Record<FaceValidationStatus, string> = {
  no_face: "We can't see your face clearly",
  too_far: 'Move a little closer',
  too_close: 'Move back a little',
  off_center: 'Put your face in the frame',
  valid: 'Looks good',
}

export function getObjectCoverTransform(
  sourceW: number,
  sourceH: number,
  displayW: number,
  displayH: number,
) {
  const sourceAspect = sourceW / sourceH
  const displayAspect = displayW / displayH

  if (sourceAspect > displayAspect) {
    const scale = displayH / sourceH
    return {
      scale,
      offsetX: (displayW - sourceW * scale) / 2,
      offsetY: 0,
    }
  }

  const scale = displayW / sourceW
  return {
    scale,
    offsetX: 0,
    offsetY: (displayH - sourceH * scale) / 2,
  }
}

export function getObjectCoverSourceRect(
  sourceW: number,
  sourceH: number,
  displayW: number,
  displayH: number,
): Rect {
  const sourceAspect = sourceW / sourceH
  const displayAspect = displayW / displayH

  if (sourceAspect > displayAspect) {
    const w = sourceH * displayAspect
    return {
      x: (sourceW - w) / 2,
      y: 0,
      w,
      h: sourceH,
    }
  }

  const h = sourceW / displayAspect
  return {
    x: 0,
    y: (sourceH - h) / 2,
    w: sourceW,
    h,
  }
}

const DETECT_MAX_SIDE = 640

export function drawCoveredVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  displayW: number,
  displayH: number,
): { width: number; height: number } | null {
  if (!video.videoWidth || !video.videoHeight || !displayW || !displayH) {
    return null
  }

  const crop = getObjectCoverSourceRect(
    video.videoWidth,
    video.videoHeight,
    displayW,
    displayH,
  )

  const scale = Math.min(1, DETECT_MAX_SIDE / Math.max(crop.w, crop.h))
  const width = Math.max(1, Math.round(crop.w * scale))
  const height = Math.max(1, Math.round(crop.h * scale))

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
  return { width, height }
}

export function mapBboxToDisplay(
  bbox: BoundingBox,
  transform: ReturnType<typeof getObjectCoverTransform>,
): Rect {
  return {
    x: bbox.originX * transform.scale + transform.offsetX,
    y: bbox.originY * transform.scale + transform.offsetY,
    w: bbox.width * transform.scale,
    h: bbox.height * transform.scale,
  }
}

export function getGuideRect(displayW: number, displayH: number): Rect {
  const size = Math.min(displayW, displayH) * GUIDE_INSET
  return {
    x: (displayW - size) / 2,
    y: (displayH - size) / 2,
    w: size,
    h: size,
  }
}

function getInnerGuideRect(guideRect: Rect): Rect {
  const pad = guideRect.w * GUIDE_INNER_PAD
  return {
    x: guideRect.x + pad,
    y: guideRect.y + pad,
    w: guideRect.w - pad * 2,
    h: guideRect.h - pad * 2,
  }
}

function expandFaceRect(faceRect: Rect, displayW: number, displayH: number): Rect {
  const extraW = faceRect.w * FACE_EXPAND_WIDTH
  const extraH = faceRect.h * FACE_EXPAND_HEIGHT

  let x = faceRect.x - extraW / 2
  let y = faceRect.y - extraH / 2
  let w = faceRect.w + extraW
  let h = faceRect.h + extraH

  if (x < 0) {
    w += x
    x = 0
  }
  if (y < 0) {
    h += y
    y = 0
  }
  if (x + w > displayW) {
    w = displayW - x
  }
  if (y + h > displayH) {
    h = displayH - y
  }

  return { x, y, w: Math.max(0, w), h: Math.max(0, h) }
}

function isFullyContained(faceRect: Rect, guideRect: Rect): boolean {
  const inner = getInnerGuideRect(guideRect)
  return (
    faceRect.x >= inner.x &&
    faceRect.y >= inner.y &&
    faceRect.x + faceRect.w <= inner.x + inner.w &&
    faceRect.y + faceRect.h <= inner.y + inner.h
  )
}

function resultForStatus(status: FaceValidationStatus): FaceValidationResult {
  return {
    status,
    message: STATUS_MESSAGES[status],
  }
}

function classifyFaceMetrics(
  faceRect: Rect,
  guideRect: Rect,
  displayW: number,
  displayH: number,
  previousStatus: FaceValidationStatus | null,
): FaceValidationStatus {
  const expanded = expandFaceRect(faceRect, displayW, displayH)
  const faceArea = expanded.w * expanded.h
  const guideArea = guideRect.w * guideRect.h
  const faceToGuideRatio = faceArea / guideArea

  const wasValid = previousStatus === 'valid'
  const minSize = wasValid ? SIZE_EXIT : SIZE_ENTER
  const maxSize = wasValid ? SIZE_MAX_EXIT : SIZE_MAX_ENTER

  if (faceToGuideRatio < minSize) {
    return 'too_far'
  }

  if (faceToGuideRatio > maxSize) {
    return 'too_close'
  }

  if (!isFullyContained(expanded, guideRect)) {
    return 'off_center'
  }

  return 'valid'
}

export function validateFaceInGuide(
  faceRect: Rect | null,
  guideRect: Rect,
  displayW: number,
  displayH: number,
  previousStatus: FaceValidationStatus | null = null,
): FaceValidationResult {
  if (!faceRect) {
    return resultForStatus('no_face')
  }

  const status = classifyFaceMetrics(
    faceRect,
    guideRect,
    displayW,
    displayH,
    previousStatus,
  )
  return resultForStatus(status)
}

type DetectionLike = {
  boundingBox?: BoundingBox
  categories: { score: number }[]
}

export function validateDetections(
  detections: DetectionLike[],
  sourceW: number,
  sourceH: number,
  displayW: number,
  displayH: number,
  previousStatus: FaceValidationStatus | null = null,
): FaceValidationResult {
  const transform = getObjectCoverTransform(sourceW, sourceH, displayW, displayH)
  const guide = getGuideRect(displayW, displayH)

  const usable = detections.filter(
    (d) => d.boundingBox && (d.categories[0]?.score ?? 0) >= MIN_SCORE,
  )

  if (usable.length === 0) {
    return validateFaceInGuide(null, guide, displayW, displayH, previousStatus)
  }

  let best = usable[0]
  let bestArea = 0
  for (const detection of usable) {
    const box = detection.boundingBox!
    const area = box.width * box.height
    if (area > bestArea) {
      bestArea = area
      best = detection
    }
  }

  const faceRect = mapBboxToDisplay(best.boundingBox!, transform)
  return validateFaceInGuide(faceRect, guide, displayW, displayH, previousStatus)
}

export function createValidationStabilizer(requiredFrames = STABILIZER_FRAMES) {
  let stableStatus: FaceValidationStatus | null = null
  let pendingStatus: FaceValidationStatus | null = null
  let pendingCount = 0

  return {
    update(raw: FaceValidationResult): FaceValidationResult {
      if (raw.status === stableStatus) {
        pendingStatus = null
        pendingCount = 0
        return resultForStatus(stableStatus!)
      }

      if (raw.status === pendingStatus) {
        pendingCount += 1
      } else {
        pendingStatus = raw.status
        pendingCount = 1
      }

      if (stableStatus === null || pendingCount >= requiredFrames) {
        stableStatus = raw.status
        pendingStatus = null
        pendingCount = 0
        return resultForStatus(stableStatus)
      }

      return resultForStatus(stableStatus ?? raw.status)
    },
    reset() {
      stableStatus = null
      pendingStatus = null
      pendingCount = 0
    },
  }
}

export const PREVIEW_DISPLAY_WIDTH = 280

export function getPreviewDisplaySize() {
  const displayW = PREVIEW_DISPLAY_WIDTH
  const displayH = (displayW * 4) / 3
  return { displayW, displayH }
}

export async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = dataUrl
  })
}
