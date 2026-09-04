import { Camera, ImageUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFlow } from '../../context/FlowContext'
import { Button } from '../ui/Button'

type Mode = 'choose' | 'camera' | 'preview'

export function PhotoScreen() {
  const { photo, setPhoto, nextStep } = useFlow()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<Mode>(photo ? 'preview' : 'choose')
  const [cameraError, setCameraError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const startCamera = async () => {
    stopCamera()
    setCameraError(null)
    setMode('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError(
        'Camera access is unavailable. Upload a photo instead.',
      )
      setMode('choose')
    }
  }

  const captureFrame = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    stopCamera()
    setPhoto(dataUrl)
    setMode('preview')
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      stopCamera()
      setPhoto(reader.result as string)
      setMode('preview')
    }
    reader.onerror = () => {
      setCameraError('Upload failed. Pick a different image and try again.')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRetake = () => {
    setPhoto(null)
    setMode('choose')
    setCameraError(null)
  }

  if (mode === 'preview' && photo) {
    return (
      <div className="flex flex-col items-center">
        <h1 className="font-display text-[28px] font-bold leading-[1.15] text-ink md:text-[32px]">
          Time for your close-up
        </h1>
        <p className="mt-2 text-center text-base text-ink-muted">
          Natural light, no filters, face centered — this helps us read your
          skin accurately.
        </p>
        <div
          className="mt-6 overflow-hidden rounded-frame border-2 shadow-berry-glow"
          style={{ borderColor: 'var(--berry)' }}
        >
          <img
            src={photo}
            alt="Your uploaded face photo for skin analysis"
            className="aspect-[3/4] w-full max-w-[280px] object-cover"
          />
        </div>
        <p className="mt-3 text-center text-[13px] text-ink-muted">
          Your photo stays private and isn&apos;t used to train anything.
        </p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <Button onClick={nextStep}>Continue</Button>
          <Button variant="secondary" onClick={handleRetake}>
            Retake
          </Button>
        </div>
      </div>
    )
  }

  if (mode === 'camera') {
    return (
      <div className="flex flex-col items-center">
        <h1 className="font-display text-[28px] font-bold leading-[1.15] text-ink md:text-[32px]">
          Time for your close-up
        </h1>
        <div className="relative mt-6 w-full max-w-[280px] overflow-hidden rounded-frame">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-[3/4] w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="h-[70%] w-[55%] rounded-[50%] border-2 border-white/70"
              style={{
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(0px)',
              }}
            />
          </div>
        </div>
        <p className="mt-3 text-[13px] text-ink-muted">
          Center your face in the oval
        </p>
        <canvas ref={canvasRef} className="hidden" />
        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <Button onClick={captureFrame}>Take a photo</Button>
          <Button
            variant="secondary"
            onClick={() => {
              stopCamera()
              setMode('choose')
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-display text-[28px] font-bold leading-[1.15] text-ink md:text-[32px]">
        Time for your close-up
      </h1>
      <p className="mt-2 text-center text-base text-ink-muted">
        Natural light, no filters, face centered — this helps us read your skin
        accurately.
      </p>

      {cameraError && (
        <p className="mt-4 text-center text-[13px] text-berry" role="alert">
          {cameraError}
        </p>
      )}

      <div className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={startCamera}
          className="focus-ring glass-panel flex flex-col items-center gap-3 rounded-panel p-6 transition-transform hover:scale-[1.01]"
        >
          <Camera className="h-8 w-8 text-berry" aria-hidden="true" />
          <span className="text-base font-semibold text-ink">Take a photo</span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="focus-ring glass-panel flex flex-col items-center gap-3 rounded-panel p-6 transition-transform hover:scale-[1.01]"
        >
          <ImageUp className="h-8 w-8 text-berry" aria-hidden="true" />
          <span className="text-base font-semibold text-ink">Upload a photo</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
        aria-label="Upload a photo"
      />
    </div>
  )
}
