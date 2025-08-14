import { useRef, useEffect } from 'react'

const Game = () => {
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

  return <canvas ref={canvasRef} width={800} height={600} />
}

export default Game
