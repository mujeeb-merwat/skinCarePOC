import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from '@mediapipe/tasks-vision'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

const EMPTY_BEFORE_CPU = 10
const EMPTY_BEFORE_IMAGE = 25

type Delegate = 'GPU' | 'CPU'

let visionResolver: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null =
  null
let videoDetector: FaceDetector | null = null
let imageDetector: FaceDetector | null = null
let imageDetectorPromise: Promise<FaceDetector> | null = null
let videoLoadingPromise: Promise<void> | null = null
let videoNeedsReinit = false
let videoDelegate: Delegate | null = null
let emptyStreak = 0
let useImageFallback = false
let lastVideoTimestamp = -1

function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function preferredVideoDelegate(): Delegate {
  return isAndroid() ? 'CPU' : 'GPU'
}

function nextVideoTimestamp() {
  const requested = performance.now()
  const timestamp = requested <= lastVideoTimestamp ? lastVideoTimestamp + 1 : requested
  lastVideoTimestamp = timestamp
  return timestamp
}

function closeDetector(detector: FaceDetector | null) {
  if (!detector) return
  try {
    detector.close()
  } catch {
    // Detector may already be invalidated after a WebGL context loss.
  }
}

async function getVisionResolver() {
  if (!visionResolver) {
    visionResolver = await FilesetResolver.forVisionTasks(WASM_URL)
  }
  return visionResolver
}

async function createDetector(
  runningMode: 'VIDEO' | 'IMAGE',
  delegate: Delegate,
): Promise<FaceDetector> {
  const vision = await getVisionResolver()
  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode,
    minDetectionConfidence: 0.5,
  })
}

async function createDetectorWithFallback(
  runningMode: 'VIDEO' | 'IMAGE',
  preferred: Delegate = 'GPU',
): Promise<FaceDetector> {
  try {
    return await createDetector(runningMode, preferred)
  } catch {
    const other = preferred === 'GPU' ? 'CPU' : 'GPU'
    return createDetector(runningMode, other)
  }
}

async function createVideoDetector(delegate: Delegate): Promise<FaceDetector> {
  try {
    const detector = await createDetector('VIDEO', delegate)
    videoDelegate = delegate
    return detector
  } catch {
    const other = delegate === 'GPU' ? 'CPU' : 'GPU'
    const detector = await createDetector('VIDEO', other)
    videoDelegate = other
    return detector
  }
}

async function ensureVideoDetector(): Promise<FaceDetector | null> {
  if (videoDetector && !videoNeedsReinit) return videoDetector

  if (!videoLoadingPromise) {
    videoLoadingPromise = (async () => {
      const delegate = videoDelegate ?? preferredVideoDelegate()
      videoDetector = await createVideoDetector(delegate)
      videoNeedsReinit = false
      lastVideoTimestamp = -1
    })().finally(() => {
      videoLoadingPromise = null
    })
  }

  await videoLoadingPromise
  return videoDetector
}

async function recreateVideoDetector(delegate: Delegate): Promise<FaceDetector | null> {
  closeDetector(videoDetector)
  videoDetector = null
  lastVideoTimestamp = -1
  videoNeedsReinit = true
  videoDelegate = delegate
  return ensureVideoDetector()
}

async function ensureImageDetector() {
  if (imageDetector) return imageDetector

  if (!imageDetectorPromise) {
    imageDetectorPromise = createDetectorWithFallback(
      'IMAGE',
      preferredVideoDelegate(),
    ).finally(() => {
      imageDetectorPromise = null
    })
  }

  imageDetector = await imageDetectorPromise
  return imageDetector
}

export async function initFaceDetection() {
  await ensureVideoDetector()
}

export function resetVideoDetectionSession() {
  emptyStreak = 0
  useImageFallback = false
  lastVideoTimestamp = -1
}

async function afterEmptyDetections(
  source: HTMLCanvasElement,
): Promise<Detection[]> {
  emptyStreak += 1

  if (emptyStreak >= EMPTY_BEFORE_CPU && videoDelegate === 'GPU') {
    const switched = await recreateVideoDetector('CPU')
    emptyStreak = 0
    if (!switched) {
      useImageFallback = true
      return detectFacesInImage(source)
    }
    try {
      return switched.detectForVideo(source, nextVideoTimestamp()).detections
    } catch {
      useImageFallback = true
      return detectFacesInImage(source)
    }
  }

  if (emptyStreak >= EMPTY_BEFORE_IMAGE) {
    useImageFallback = true
    return detectFacesInImage(source)
  }

  return []
}

export async function detectFacesInVideoFrame(
  source: HTMLCanvasElement,
): Promise<Detection[]> {
  if (source.width === 0 || source.height === 0) {
    return []
  }

  if (useImageFallback) {
    return detectFacesInImage(source)
  }

  let detector = await ensureVideoDetector()
  if (!detector) {
    useImageFallback = true
    return detectFacesInImage(source)
  }

  try {
    const detections = detector.detectForVideo(
      source,
      nextVideoTimestamp(),
    ).detections

    if (detections.length > 0) {
      emptyStreak = 0
      return detections
    }

    return afterEmptyDetections(source)
  } catch {
    closeDetector(detector)
    videoDetector = null
    lastVideoTimestamp = -1
    videoNeedsReinit = true
    videoDelegate = 'CPU'

    try {
      detector = await ensureVideoDetector()
      if (!detector) {
        useImageFallback = true
        return detectFacesInImage(source)
      }
      const detections = detector.detectForVideo(
        source,
        nextVideoTimestamp(),
      ).detections
      if (detections.length > 0) {
        emptyStreak = 0
        return detections
      }
      return afterEmptyDetections(source)
    } catch {
      useImageFallback = true
      return detectFacesInImage(source)
    }
  }
}

export async function detectFacesInImage(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<Detection[]> {
  const detector = await ensureImageDetector()
  try {
    return detector.detect(source).detections
  } catch {
    closeDetector(imageDetector)
    imageDetector = null
    const retryDetector = await ensureImageDetector()
    return retryDetector.detect(source).detections
  }
}
