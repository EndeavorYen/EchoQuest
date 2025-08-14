import { useRef, useEffect } from 'react'

interface GameProps {
  onWin?: () => void
  onLose?: () => void
}

const Game = ({ onWin = () => {}, onLose = () => {} }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let frameId: number
    const canvas = canvasRef.current
    let context: CanvasRenderingContext2D | null = null

    try {
      context = canvas?.getContext('2d') ?? null
    } catch {
      context = null
    }

    const loop = () => {
      if (!canvas || !context) return

      context.clearRect(0, 0, canvas.width, canvas.height)
      // Game logic and rendering would go here

      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4">
        <div className="sprite sprite-hero" />
        <div className="sprite sprite-monster" />
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-pastelPurple"
      />
      <div className="flex gap-2">
        <button
          className="px-2 py-1 rounded bg-pastelGreen text-gray-700"
          onClick={onWin}
        >
          Win
        </button>
        <button
          className="px-2 py-1 rounded bg-pastelYellow text-gray-700"
          onClick={onLose}
        >
          Lose
        </button>
      </div>
    </div>
  )
}

export default Game
