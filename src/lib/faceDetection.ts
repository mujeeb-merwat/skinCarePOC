import {
  FaceDetector,
  FilesetResolver,
  type Detection,
} from '@mediapipe/tasks-vision'

const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

let videoDetector: FaceDetector | null = null
let imageDetector: FaceDetector | null = null
let loadingPromise: Promise<void> | null = null

async function ensureDetectors() {
  if (videoDetector && imageDetector) return

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL)

      videoDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      })

      imageDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      })
    })()
  }

  await loadingPromise
}

export async function initFaceDetection() {
  await ensureDetectors()
}

export function detectFacesInVideo(
  video: HTMLVideoElement,
  timestamp: number,
): Detection[] {
  if (!videoDetector || video.videoWidth === 0 || video.videoHeight === 0) {
    return []
  }

  return videoDetector.detectForVideo(video, timestamp).detections
}

export function detectFacesInImage(
  source: HTMLImageElement | HTMLCanvasElement,
): Detection[] {
  if (!imageDetector) return []
  return imageDetector.detect(source).detections
}
