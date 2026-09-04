import type { BoundingBox } from '@mediapipe/tasks-vision'

export type Rect = {
  x: number
  y: number
  w: number
  h: number
}

export type FaceValidationStatus = 'no_face' | 'out_of_frame' | 'valid'

export type FaceValidationResult = {
  status: FaceValidationStatus
  message: string
}

const MIN_SCORE = 0.5
const MIN_FACE_IN_GUIDE = 0.7
const MIN_FACE_TO_GUIDE_RATIO = 0.28
const MAX_FACE_TO_GUIDE_RATIO = 0.95
const GUIDE_INSET = 0.78

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

function intersectionArea(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.w, b.x + b.w)
  const y2 = Math.min(a.y + a.h, b.y + b.h)
  if (x2 <= x1 || y2 <= y1) return 0
  return (x2 - x1) * (y2 - y1)
}

export function validateFaceInGuide(
  faceRect: Rect | null,
  guideRect: Rect,
): FaceValidationResult {
  if (!faceRect) {
    return {
      status: 'no_face',
      message: "We can't see your face clearly",
    }
  }

  const faceArea = faceRect.w * faceRect.h
  const guideArea = guideRect.w * guideRect.h
  const overlap = intersectionArea(faceRect, guideRect)
  const overlapRatio = overlap / faceArea

  const faceCenterX = faceRect.x + faceRect.w / 2
  const faceCenterY = faceRect.y + faceRect.h / 2
  const centerInGuide =
    faceCenterX >= guideRect.x &&
    faceCenterX <= guideRect.x + guideRect.w &&
    faceCenterY >= guideRect.y &&
    faceCenterY <= guideRect.y + guideRect.h

  const faceToGuideRatio = faceArea / guideArea

  if (
    !centerInGuide ||
    overlapRatio < MIN_FACE_IN_GUIDE ||
    faceToGuideRatio < MIN_FACE_TO_GUIDE_RATIO ||
    faceToGuideRatio > MAX_FACE_TO_GUIDE_RATIO
  ) {
    return {
      status: 'out_of_frame',
      message: 'Put your face in the frame',
    }
  }

  return {
    status: 'valid',
    message: 'Looks good',
  }
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
): FaceValidationResult {
  const transform = getObjectCoverTransform(sourceW, sourceH, displayW, displayH)
  const guide = getGuideRect(displayW, displayH)

  const usable = detections.filter(
    (d) => d.boundingBox && (d.categories[0]?.score ?? 0) >= MIN_SCORE,
  )

  if (usable.length === 0) {
    return validateFaceInGuide(null, guide)
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
  return validateFaceInGuide(faceRect, guide)
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
