// All code comments must be English
import React, { useEffect, useMemo, useRef, useState } from 'react'

type Vocab = { id: string; word: string; image: string; level: number }

function useInlineOrFetchVocab(): Vocab[] {
  // Inline demo for GitHub Pages/first run; try fetch if available
  const [data, setData] = useState<Vocab[] | null>(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('./vocab.json', { cache: 'no-store' })
        if (res.ok) {
          const json = (await res.json()) as Vocab[]
          if (mounted) setData(normalize(json))
          return
        }
      } catch {}
      // fallback to inline demo
      const demo: Vocab[] = normalize([
        { id: '001-basic/apple', word: 'apple', image: 'pics/001-basic/apple.svg', level: 1 },
        { id: '001-basic/cat', word: 'cat', image: 'pics/001-basic/cat.svg', level: 1 },
        { id: '002-animals/elephant', word: 'elephant', image: 'pics/002-animals/elephant.svg', level: 2 },
        { id: '003-objects/umbrella', word: 'umbrella', image: 'pics/003-objects/umbrella.svg', level: 3 },
      ])
      if (mounted) setData(demo)
    })()
    return () => { mounted = false }
  }, [])
  return data ?? []
}

function normalize(items: any[]): Vocab[] {
  return items.map((x) => ({ id: x.id || x.word, word: String(x.word || '').toLowerCase(), image: x.image, level: Number(x.level || 1) }))
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 1500)
    return () => clearTimeout(t)
  }, [msg])
  return { msg, show: (m: string) => setMsg(m) }
}

function fuzzyEquals(a: string, b: string) {
  if (a === b) return true
  const min = Math.min(a.length, b.length)
  let same = 0
  for (let i = 0; i < min; i++) if (a[i] === b[i]) same++
  const ratio = same / Math.max(1, Math.max(a.length, b.length))
  return ratio >= 0.7
}

export function App() {
  const vocab = useInlineOrFetchVocab()
  const [levelIdx, setLevelIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [bossHp, setBossHp] = useState<number | null>(null)
  const [doorLocks, setDoorLocks] = useState<number | null>(null)
  const [fuzzy, setFuzzy] = useState(true)
  const [silent, setSilent] = useState(false)
  const [selectedTool, setSelectedTool] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const levels = useMemo(() => [
    // Boss level
    () => {
      let hp = 5
      let card = pickRandom(vocab)
      setBossHp(hp); setDoorLocks(null)
      const view = (
        <div className="card">
          <h2>Boss Fight</h2>
          <div className="bossBar">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className={"heart" + (i < hp ? ' alive' : '')}/>))}</div>
          <img className="img" src={card.image} alt={card.word} />
          <div className="status" style={{ justifyContent: 'center' }}>Say the word</div>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button className="btn" onClick={() => { card = pickRandom(vocab); rerender() }}>Skip</button>
          </div>
        </div>
      )
      const rerender = () => setRender(view)
      const onAnswer = (text: string) => {
        const ok = fuzzy ? fuzzyEquals(text, card.word) : text === card.word
        if (ok) {
          const dmg = Math.max(1, card.level)
          hp = Math.max(0, hp - dmg)
          setScore((s) => s + 10 * dmg)
          toast.show(`Correct! Damage ${dmg}.`)
          setBossHp(hp)
          if (hp <= 0) setTimeout(() => { setLevelIdx((i) => i + 1) }, 600)
          else { card = pickRandom(vocab); rerender() }
        } else toast.show('Try again.')
      }
      return { view, onAnswer }
    },
    // Door level
    () => {
      const needed = 3
      let unlocked = 0
      const cards = pickN(vocab, needed)
      setBossHp(null); setDoorLocks(needed - unlocked)
      const rerender = () => setRender(view)
      const view = (
        <div className="card">
          <h2>Locked Door</h2>
          <div className="status" style={{ justifyContent: 'center' }}>{Array.from({ length: needed }).map((_, i) => <span key={i}>{i < unlocked ? '🟩' : '⬜'}</span>)}</div>
          <div className="tools">
            {cards.map((c, i) => (
              <div key={c.id} className={'tool' + (selectedTool === i ? ' sel' : '')} onClick={() => { setSelectedTool(i); rerender() }}>
                <img className="img" src={c.image} alt={c.word} />
                <div className="status" style={{ justifyContent: 'center' }}>Say the word for this tool</div>
              </div>
            ))}
          </div>
        </div>
      )
      const onAnswer = (text: string) => {
        const card = cards[selectedTool]
        if (!card) return
        const ok = fuzzy ? fuzzyEquals(text, card.word) : text === card.word
        if (ok) {
          if (!(card as any).__done) {
            ;(card as any).__done = true
            unlocked += 1
            setScore((s) => s + 15 * Math.max(1, card.level))
            toast.show('Unlocked a lock!')
          }
          setDoorLocks(needed - unlocked)
          if (unlocked >= needed) setTimeout(() => setLevelIdx((i) => i + 1), 600)
          else rerender()
        } else toast.show('Not this one.')
      }
      return { view, onAnswer }
    },
  ], [vocab, fuzzy, selectedTool])

  const [render, setRender] = useState<React.ReactNode>(<div className="card">Press Start to play</div>)
  const levelRef = useRef<{ view: React.ReactNode; onAnswer: (t: string) => void } | null>(null)

  function start() {
    setScore(0)
    setLevelIdx(0)
  }

  useEffect(() => {
    if (!vocab.length) return
    if (levelIdx >= levels.length) {
      setRender(<div className="card"><h2>All levels completed!</h2><p>Great job!</p></div>)
      levelRef.current = null
      return
    }
    const l = levels[levelIdx]()
    setRender(l.view)
    levelRef.current = l
  }, [levelIdx, levels, vocab])

  function submit(text: string) {
    const t = text.trim().toLowerCase().replace(/\s+/g, '')
    levelRef.current?.onAnswer(t)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="wrap">
      <header className="top">
        <h2 style={{ margin: 0 }}>EchoQuest React</h2>
        <div className="controls">
          <button className="btn" onClick={start}>Start</button>
          <label><input type="checkbox" checked={silent} onChange={(e) => setSilent(e.target.checked)} /> Silent Mode</label>
          <label><input type="checkbox" checked={fuzzy} onChange={(e) => setFuzzy(e.target.checked)} /> Fuzzy Match</label>
        </div>
        <div className="status">
          <span>Level: {Math.min(levelIdx + 1, levels.length)}/{levels.length}</span>
          <span>Boss HP: {bossHp ?? '-'}</span>
          <span>Door Locks: {doorLocks ?? '-'}</span>
          <span>Score: {score}</span>
        </div>
      </header>
      <main className="main">
        {render}
      </main>
      <footer className="footer">
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="btn" onClick={() => toast.show('Use microphone on HTTPS only')}>🎤 Listen</button>
          <input ref={inputRef} placeholder="Type here (e.g., a p p l e)" onKeyDown={(e) => { if (e.key === 'Enter') submit((e.target as HTMLInputElement).value) }} />
          <button className="btn" onClick={() => submit(inputRef.current?.value || '')}>Submit</button>
        </div>
      </footer>
      {toast.msg && <div className="toast">{toast.msg}</div>}
    </div>
  )
}

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickN<T>(arr: T[], n: number): T[] {
  const pool = [...arr]; const out: T[] = []
  while (out.length < n && pool.length) { const i = Math.floor(Math.random() * pool.length); out.push(pool.splice(i, 1)[0]) }
  return out
}


