import React, { useEffect, useMemo, useRef, useState } from "react";

// Declare minimal types to use Web Speech API without extra deps
declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

type VocabItem = {
  id: string;
  word: string; // normalized lowercase word, derived from filename
  imageDataUrl?: string; // base64 data URL for persistence
  imageName: string;
  size: number;
  type: string;
  difficulty: number; // 1..5 (or parsed from folder prefix)
  enabled: boolean;
  pathHint?: string; // optional folder hint (e.g., 001-animals)
};

type Tool = {
  id: string;
  vocabId: string;
  solved: boolean;
};

const STORAGE_KEY = "wordquest_vocab_v1";
const MAX_IMAGE_BYTES = 1024 * 1024; // 1MB per image to stay within localStorage limits

const defaultVocab: VocabItem[] = [
  {
    id: "seed-apple",
    word: "apple",
    imageDataUrl: undefined,
    imageName: "apple",
    size: 0,
    type: "",
    difficulty: 1,
    enabled: true,
  },
  {
    id: "seed-dog",
    word: "dog",
    imageDataUrl: undefined,
    imageName: "dog",
    size: 0,
    type: "",
    difficulty: 1,
    enabled: true,
  },
  {
    id: "seed-cat",
    word: "cat",
    imageDataUrl: undefined,
    imageName: "cat",
    size: 0,
    type: "",
    difficulty: 1,
    enabled: true,
  },
  {
    id: "seed-banana",
    word: "banana",
    imageDataUrl: undefined,
    imageName: "banana",
    size: 0,
    type: "",
    difficulty: 2,
    enabled: true,
  },
  {
    id: "seed-lion",
    word: "lion",
    imageDataUrl: undefined,
    imageName: "lion",
    size: 0,
    type: "",
    difficulty: 2,
    enabled: true,
  },
  {
    id: "seed-icecream",
    word: "icecream",
    imageDataUrl: undefined,
    imageName: "ice-cream",
    size: 0,
    type: "",
    difficulty: 3,
    enabled: true,
  },
];

function normalizeWord(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, "");
}

function fileNameToWord(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return normalizeWord(base);
}

function parseDifficultyFromPath(path?: string): number | null {
  if (!path) return null;
  // Try to find a segment like 001-xxxx or 003-animals
  const segments = path.split("/");
  for (const seg of segments) {
    const m = seg.match(/^(\d{3})-/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n)) {
        // map 001->1, 002->2, ... clamp 1..5
        return Math.max(1, Math.min(5, n));
      }
    }
  }
  return null;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadVocabFromStorage(): VocabItem[] {
  if (typeof window === "undefined") return defaultVocab;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVocab;
    const parsed = JSON.parse(raw) as VocabItem[];
    if (!Array.isArray(parsed)) return defaultVocab;
    return parsed;
  } catch {
    return defaultVocab;
  }
}

function saveVocabToStorage(items: VocabItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

type SpeechHook = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

function useSpeechRecognition(): SpeechHook {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
    return () => {
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {}
        recRef.current = null;
      }
    };
  }, []);

  const start = () => {
    if (!supported || listening) return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      setTranscript("");
      setError(null);
      setListening(true);
    };
    rec.onerror = (e: any) => {
      setError(e?.error || "speech_error");
    };
    rec.onresult = (e: any) => {
      const t = e?.results?.[0]?.[0]?.transcript || "";
      setTranscript(String(t));
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
    } catch (e: any) {
      setError(e?.message || "speech_start_failed");
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {}
  };

  const reset = () => setTranscript("");

  return { supported, listening, transcript, error, start, stop, reset };
}

function HeartRow({ hp, max }: { hp: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={
            "text-2xl " + (i < hp ? "text-red-500" : "text-gray-300")
          }
          aria-hidden
        >
          ❤
        </span>
      ))}
    </div>
  );
}

function DifficultyPips({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" title={`Difficulty ${level}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={
            "w-2 h-2 rounded-full " +
            (i < level ? "bg-amber-500" : "bg-amber-200")
          }
        />
      ))}
    </div>
  );
}

function ImagePreview({ src }: { src?: string }) {
  if (!src) {
    return <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16" />;
  }
  return (
    <img
      src={src}
      alt="vocab"
      className="w-16 h-16 rounded-xl object-cover border border-gray-200"
    />
  );
}

export default function Home() {
  const [vocab, setVocab] = useState<VocabItem[]>(defaultVocab);
  const [screen, setScreen] = useState<"menu" | "level1" | "level2">("menu");
  const [silentMode, setSilentMode] = useState(false);

  // Level 1 state
  const [bossHP, setBossHP] = useState(5);
  const bossMax = 5;
  const [currentWordId, setCurrentWordId] = useState<string | null>(null);
  const [strikeMessage, setStrikeMessage] = useState<string>("");

  // Level 2 state
  const [tools, setTools] = useState<Tool[]>([]);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  // Input state
  const [typedInput, setTypedInput] = useState("");

  // Speech
  const speech = useSpeechRecognition();

  // Directory input ref to enable folder selection
  const dirInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (dirInputRef.current) {
      // @ts-ignore - set nonstandard property for Chrome folder import
      dirInputRef.current.webkitdirectory = true;
    }
  }, []);

  // Load from storage on mount
  useEffect(() => {
    const stored = loadVocabFromStorage();
    setVocab(stored);
  }, []);

  // Persist on vocab changes
  useEffect(() => {
    saveVocabToStorage(vocab);
  }, [vocab]);

  // Derived lists
  const enabledVocab = useMemo(
    () => vocab.filter((v) => v.enabled),
    [vocab]
  );

  const currentVocab = useMemo(() => {
    if (!currentWordId) return null;
    return vocab.find((v) => v.id === currentWordId) || null;
  }, [currentWordId, vocab]);

  const activeTargetWord = useMemo(() => {
    if (screen === "level1") return currentVocab?.word || null;
    if (screen === "level2") {
      const t = tools.find((x) => x.id === activeToolId);
      const v = vocab.find((v) => v.id === t?.vocabId);
      return v?.word || null;
    }
    return null;
  }, [screen, currentVocab, tools, activeToolId, vocab]);

  // Handle speech transcript -> attempt automatically
  useEffect(() => {
    if (!speech.transcript || !activeTargetWord) return;
    const normalizedHeard = normalizeWord(speech.transcript);
    const normalizedTarget = normalizeWord(activeTargetWord);
    // Accept exact match or if the recognized contains the target as a token
    if (
      normalizedHeard === normalizedTarget ||
      normalizedHeard.includes(normalizedTarget)
    ) {
      handleSuccess(normalizedTarget, "voice");
    }
    // Reset transcript so next recognition produces a new event
    // Slight delay to allow UI feedback
    const t = setTimeout(() => speech.reset(), 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.transcript]);

  function pickRandomEnabled(excludeIds: string[] = []): VocabItem | null {
    const candidates = enabledVocab.filter((v) => !excludeIds.includes(v.id));
    if (candidates.length === 0) return null;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  function startLevel1() {
    setScreen("level1");
    setBossHP(bossMax);
    const first = pickRandomEnabled();
    setCurrentWordId(first ? first.id : null);
    setStrikeMessage("");
    setTypedInput("");
    setActiveToolId(null);
  }

  function startLevel2() {
    setScreen("level2");
    setTypedInput("");
    // Pick 3 distinct words
    const chosen: VocabItem[] = [];
    let pool = [...enabledVocab];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const w = pool.splice(idx, 1)[0];
      chosen.push(w);
    }
    const t: Tool[] = chosen.map((v) => ({ id: uid(), vocabId: v.id, solved: false }));
    setTools(t);
    setActiveToolId(t[0]?.id || null);
  }

  function nextWordLevel1(prevId?: string | null) {
    const next = pickRandomEnabled(prevId ? [prevId] : []);
    setCurrentWordId(next ? next.id : null);
    setTypedInput("");
  }

  function handleTypedSubmit() {
    if (!activeTargetWord) return;
    const normalized = normalizeWord(typedInput);
    const target = normalizeWord(activeTargetWord);
    if (!normalized) return;
    if (normalized === target) {
      handleSuccess(target, "typed");
    } else {
      setStrikeMessage("再試一次！Try again!");
    }
  }

  function handleSuccess(target: string, source: "voice" | "typed") {
    setStrikeMessage(source === "voice" ? "太棒了！Perfect!" : "做得好！Great!");
    if (screen === "level1" && currentVocab) {
      const damage = Math.max(1, Math.min(5, currentVocab.difficulty));
      setBossHP((hp) => Math.max(0, hp - damage));
      // Show feedback then move to next word if boss still alive
      setTimeout(() => {
        if (bossHP - damage <= 0) return; // victory handled by UI
        nextWordLevel1(currentVocab.id);
        setStrikeMessage("");
      }, 900);
    }
    if (screen === "level2" && activeToolId) {
      setTools((ts) => ts.map((t) => (t.id === activeToolId ? { ...t, solved: true } : t)));
      setTimeout(() => {
        // Move to next unsolved tool
        const remaining = tools.filter((t) => !t.solved && t.id !== activeToolId);
        const next = remaining[0];
        setActiveToolId(next ? next.id : null);
        setStrikeMessage("");
        setTypedInput("");
      }, 800);
    }
  }

  function resetGame() {
    setScreen("menu");
    setBossHP(bossMax);
    setCurrentWordId(null);
    setTools([]);
    setActiveToolId(null);
    setStrikeMessage("");
    setTypedInput("");
    speech.stop();
  }

  async function handleFilesSelected(files: FileList, directoryMode: boolean) {
    const arr = Array.from(files);
    const newItems: VocabItem[] = [];
    const errors: string[] = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        errors.push(`${f.name}: 非圖片格式`);
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        errors.push(`${f.name}: 檔案過大 (上限 ${Math.round(MAX_IMAGE_BYTES / 1024)}KB)`);
        continue;
      }
      let dataUrl: string | undefined;
      try {
        dataUrl = await fileToDataUrl(f);
      } catch {
        errors.push(`${f.name}: 載入失敗`);
        continue;
      }
      // Try to use webkitRelativePath when importing folder
      const anyFile = f as any;
      const relPath: string | undefined = directoryMode ? anyFile.webkitRelativePath : undefined;
      const word = fileNameToWord(f.name);
      if (!word) {
        errors.push(`${f.name}: 檔名無法轉為單字`);
        continue;
      }
      const parsedLevel = parseDifficultyFromPath(relPath);
      const item: VocabItem = {
        id: uid(),
        word,
        imageDataUrl: dataUrl,
        imageName: f.name,
        size: f.size,
        type: f.type,
        difficulty: parsedLevel ?? 1,
        enabled: true,
        pathHint: relPath,
      };
      newItems.push(item);
    }
    if (errors.length) {
      alert(errors.join("\n"));
    }
    if (newItems.length) {
      setVocab((prev) => {
        // Avoid duplicates by word; prefer new item
        const existingByWord = new Map(prev.map((v) => [v.word, v] as const));
        const merged = [...prev.filter((v) => !newItems.find((n) => n.word === v.word)) , ...newItems];
        // Ensure uniqueness by id and keep enabled values
        return merged;
      });
    }
  }

  const totalEnabled = enabledVocab.length;
  const difficultyCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const v of enabledVocab) counts[v.difficulty as 1|2|3|4|5]++;
    return counts;
  }, [enabledVocab]);

  const level1Victory = screen === "level1" && bossHP <= 0;
  const level2Victory = screen === "level2" && tools.length > 0 && tools.every((t) => t.solved);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 to-purple-100 text-gray-800">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-full p-3 shadow">
              <span className="text-2xl" aria-hidden>🎮</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-sky-700">Word Quest</h1>
              <p className="text-sm text-gray-600">說出圖片的英文單字，打敗怪物、解開機關！</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm">靜音模式</span>
              <input
                type="checkbox"
                className="accent-sky-600"
                checked={silentMode}
                onChange={(e) => {
                  setSilentMode(e.target.checked);
                  if (e.target.checked) speech.stop();
                }}
              />
            </label>
            <button
              className={
                "px-4 py-2 rounded-lg text-sm font-semibold " +
                (screen === "menu"
                  ? "bg-sky-600 text-white"
                  : "bg-white text-sky-700 border border-sky-200")
              }
              onClick={() => setScreen("menu")}
            >
              首頁
            </button>
          </div>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <section className="md:col-span-2 bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-semibold text-purple-600 mb-4">字彙管理</h2>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="px-4 py-2 bg-sky-600 text-white rounded-lg cursor-pointer text-sm font-medium">
                新增圖片（多選）
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files) await handleFilesSelected(files, false);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <label className="px-4 py-2 bg-amber-500 text-white rounded-lg cursor-pointer text-sm font-medium">
                匯入資料夾（Chrome）
                <input
                  ref={dirInputRef}
                  type="file"
                  className="hidden"
                  // @ts-ignore webkitdirectory set in useEffect
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files) await handleFilesSelected(files, true);
                    e.currentTarget.value = "";
                  }}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  multiple
                />
              </label>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm border border-gray-200"
                onClick={() => {
                  if (confirm("清除所有自訂字彙？（預設字彙會保留）")) {
                    setVocab(defaultVocab);
                  }
                }}
              >
                清除自訂
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">提示：支援 PNG / JPG / WEBP / GIF / SVG。建議檔案大小 ≤ {Math.round(MAX_IMAGE_BYTES/1024)}KB。若使用資料夾，子資料夾以 001-xxx / 002-yyy 表示難度。</p>

            <div className="max-h-64 overflow-auto border border-gray-100 rounded-lg">
              {vocab.length === 0 ? (
                <div className="p-6 text-center text-gray-500">尚未有字彙，請上傳圖片</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {vocab.map((v) => (
                    <li key={v.id} className="p-3 flex items-center gap-3">
                      <ImagePreview src={v.imageDataUrl} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 capitalize">{v.word}</span>
                          <DifficultyPips level={v.difficulty} />
                        </div>
                        {v.pathHint ? (
                          <div className="text-xs text-gray-400 truncate">{v.pathHint}</div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">難度</label>
                        <select
                          className="border border-gray-200 rounded-md px-2 py-1 text-sm"
                          value={v.difficulty}
                          onChange={(e) =>
                            setVocab((all) => all.map((x) => (x.id === v.id ? { ...x, difficulty: Number(e.target.value) } : x)))
                          }
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-xs">
                          啟用
                          <input
                            type="checkbox"
                            className="accent-sky-600"
                            checked={v.enabled}
                            onChange={(e) =>
                              setVocab((all) => all.map((x) => (x.id === v.id ? { ...x, enabled: e.target.checked } : x)))
                            }
                          />
                        </label>
                        <button
                          className="px-2 py-1 text-xs rounded-md bg-red-50 text-red-600 border border-red-200"
                          onClick={() => setVocab((all) => all.filter((x) => x.id !== v.id))}
                        >
                          刪除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className="bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-semibold text-sky-600 mb-4">冒險準備</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">已啟用單字</span>
                <span className="text-sm font-semibold text-gray-800">{totalEnabled}</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <div key={lvl} className="bg-gray-50 rounded-md p-2">
                    <div className="text-xs text-gray-500">Lv.{lvl}</div>
                    <div className="text-sm font-semibold">{difficultyCounts[lvl as 1|2|3|4|5] || 0}</div>
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <button
                  className="w-full mb-2 px-4 py-3 rounded-lg bg-purple-600 text-white font-semibold shadow hover:bg-purple-500 disabled:opacity-50"
                  onClick={startLevel1}
                  disabled={enabledVocab.length === 0}
                >
                  關卡 1：魔王戰（5 命）
                </button>
                <button
                  className="w-full px-4 py-3 rounded-lg bg-amber-500 text-white font-semibold shadow hover:bg-amber-400 disabled:opacity-50"
                  onClick={startLevel2}
                  disabled={enabledVocab.length < 3}
                >
                  關卡 2：開鎖解謎（3 工具）
                </button>
              </div>
              <div className="text-xs text-gray-500">
                說話模式使用英語辨識；若瀏覽器不支援麥克風，請啟用「靜音模式」改用打字。
              </div>
            </div>
          </aside>
        </div>

        {screen !== "menu" && (
          <div className="bg-white rounded-xl p-6 shadow mb-8">
            {screen === "level1" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-2xl" aria-hidden>👹</span>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">魔王 HP</div>
                      <HeartRow hp={bossHP} max={bossMax} />
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 border border-gray-200"
                    onClick={resetGame}
                  >
                    結束挑戰
                  </button>
                </div>

                {level1Victory ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4 animate-bounce" aria-hidden>🏆</div>
                    <h3 className="text-xl font-bold text-green-600 mb-2">你打敗了魔王！</h3>
                    <p className="text-gray-600 mb-4">太棒了！再挑戰一次或試試看第二關吧！</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        className="px-4 py-2 rounded-lg bg-purple-600 text-white"
                        onClick={startLevel1}
                      >
                        再一次
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg bg-amber-500 text-white"
                        onClick={startLevel2}
                      >
                        去第二關
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="bg-sky-50 rounded-xl p-6 border border-sky-100">
                      <div className="text-sm text-gray-600 mb-2">請說出或輸入圖片的英文單字</div>
                      <div className="flex items-center gap-4">
                        {currentVocab?.imageDataUrl ? (
                          <img
                            src={currentVocab.imageDataUrl}
                            alt="word"
                            className="w-40 h-40 object-cover rounded-xl border border-sky-200"
                          />
                        ) : (
                          <div className="bg-gray-200 border-2 border-dashed rounded-xl w-40 h-40" />
                        )}
                        <div className="flex-1">
                          <div className="mb-2">
                            <span className="inline-block px-2 py-1 rounded-md bg-white border border-sky-200 text-sky-700 text-xs font-semibold">
                              傷害：難度 Lv.{currentVocab?.difficulty ?? 1}
                            </span>
                          </div>
                          <div className="text-3xl">❓❓❓</div>
                          <div className="text-xs text-gray-500">提示：英文小寫、可以輸入 a p p l e 也可以 apple</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                      <h4 className="font-semibold text-amber-600 mb-3">作答區</h4>
                      <div className="space-y-3">
                        {!silentMode && (
                          <div className="flex items-center gap-3">
                            <button
                              className={
                                "px-4 py-2 rounded-lg font-semibold " +
                                (speech.listening
                                  ? "bg-red-500 text-white"
                                  : "bg-amber-500 text-white")
                              }
                              onClick={() => (speech.listening ? speech.stop() : speech.start())}
                              disabled={!speech.supported}
                            >
                              {speech.supported ? (speech.listening ? "停止聽取" : "開始聽取") : "不支援語音"}
                            </button>
                            <div className="text-sm text-gray-600 flex-1">
                              {speech.supported ? (
                                speech.listening ? (
                                  <span className="text-red-600">聽取中… 請說出單字</span>
                                ) : (
                                  <span className="text-gray-500">點擊「開始聽取」並用英文說出單字</span>
                                )
                              ) : (
                                <span className="text-gray-500">請啟用「靜音模式」改用打字</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                            placeholder="輸入單字或分開字母 (例如 a p p l e)"
                            value={typedInput}
                            onChange={(e) => setTypedInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleTypedSubmit();
                            }}
                          />
                          <button
                            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold"
                            onClick={handleTypedSubmit}
                          >
                            送出
                          </button>
                        </div>
                        {strikeMessage && (
                          <div className="text-center text-green-600 font-semibold">{strikeMessage}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {screen === "level2" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-2xl" aria-hidden>🚪</span>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">上鎖的門</div>
                      <div className="font-semibold text-gray-800">使用三個工具來開門</div>
                    </div>
                  </div>
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 border border-gray-200"
                    onClick={resetGame}
                  >
                    結束挑戰
                  </button>
                </div>

                {tools.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">請先在右側開始關卡</div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6 items-start">
                    <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                      <div className="text-sm text-gray-600 mb-2">選擇工具並念出或輸入對應單字</div>
                      <div className="grid grid-cols-3 gap-4">
                        {tools.map((t) => {
                          const v = vocab.find((x) => x.id === t.vocabId);
                          return (
                            <button
                              key={t.id}
                              onClick={() => setActiveToolId(t.id)}
                              className={
                                "rounded-xl p-3 border flex flex-col items-center gap-2 " +
                                (activeToolId === t.id
                                  ? "border-purple-400 bg-white"
                                  : "border-purple-100 bg-white")
                              }
                            >
                              {v?.imageDataUrl ? (
                                <img src={v.imageDataUrl} alt="tool" className="w-20 h-20 object-cover rounded-lg border border-purple-100" />
                              ) : (
                                <div className="bg-gray-200 border-2 border-dashed rounded-xl w-20 h-20" />
                              )}
                              <div className="text-xs text-gray-600">Lv.{v?.difficulty ?? 1}</div>
                              <div className={"text-sm font-semibold " + (t.solved ? "text-green-600" : "text-gray-800")}>{t.solved ? "完成" : "未完成"}</div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4">
                        <div className="h-2 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-green-500"
                            style={{ width: `${(tools.filter((x) => x.solved).length / tools.length) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-right">
                          {tools.filter((x) => x.solved).length} / {tools.length} 完成
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                      {level2Victory ? (
                        <div className="text-center py-8">
                          <div className="text-5xl mb-4 animate-bounce" aria-hidden>🔓</div>
                          <h3 className="text-xl font-bold text-green-600 mb-2">門打開了！</h3>
                          <p className="text-gray-600 mb-4">你成功使用了三個工具！</p>
                          <div className="flex items-center justify-center gap-3">
                            <button
                              className="px-4 py-2 rounded-lg bg-amber-500 text-white"
                              onClick={startLevel2}
                            >
                              再玩一次
                            </button>
                            <button
                              className="px-4 py-2 rounded-lg bg-purple-600 text-white"
                              onClick={startLevel1}
                            >
                              去打魔王
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h4 className="font-semibold text-amber-600">目前工具</h4>
                          {(() => {
                            const selected = tools.find((t) => t.id === activeToolId) || tools[0];
                            const v = vocab.find((x) => x.id === selected?.vocabId);
                            if (!selected || !v) return <div className="text-gray-500">請先選擇工具</div>;
                            return (
                              <div>
                                <div className="flex items-center gap-4 mb-4">
                                  {v.imageDataUrl ? (
                                    <img src={v.imageDataUrl} alt="word" className="w-32 h-32 object-cover rounded-xl border border-amber-200" />
                                  ) : (
                                    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-32 h-32" />
                                  )}
                                  <div>
                                    <div className="mb-1"><span className="inline-block px-2 py-1 rounded-md bg-white border border-amber-200 text-amber-700 text-xs font-semibold">難度 Lv.{v.difficulty}</span></div>
                                    <div className="text-2xl">🔒</div>
                                    <div className="text-xs text-gray-500">說出或輸入該工具的英文名稱來解鎖！</div>
                                  </div>
                                </div>
                                {!silentMode && (
                                  <div className="flex items-center gap-3 mb-3">
                                    <button
                                      className={
                                        "px-4 py-2 rounded-lg font-semibold " +
                                        (speech.listening ? "bg-red-500 text-white" : "bg-amber-500 text-white")
                                      }
                                      onClick={() => (speech.listening ? speech.stop() : speech.start())}
                                      disabled={!speech.supported || selected.solved}
                                    >
                                      {speech.supported ? (speech.listening ? "停止聽取" : "開始聽取") : "不支援語音"}
                                    </button>
                                    <div className="text-sm text-gray-600 flex-1">
                                      {selected.solved ? (
                                        <span className="text-green-600">已解鎖！</span>
                                      ) : speech.supported ? (
                                        speech.listening ? (
                                          <span className="text-red-600">聽取中…</span>
                                        ) : (
                                          <span className="text-gray-500">點擊開始聽取並說出單字</span>
                                        )
                                      ) : (
                                        <span className="text-gray-500">請啟用靜音模式改用打字</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <input
                                    className="flex-1 border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                    placeholder="輸入單字或分開字母"
                                    value={typedInput}
                                    onChange={(e) => setTypedInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleTypedSubmit();
                                    }}
                                    disabled={selected.solved}
                                  />
                                  <button
                                    className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold disabled:opacity-50"
                                    onClick={handleTypedSubmit}
                                    disabled={selected.solved}
                                  >
                                    送出
                                  </button>
                                </div>
                                {strikeMessage && (
                                  <div className="text-center text-green-600 font-semibold mt-2">{strikeMessage}</div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <footer className="text-center text-xs text-gray-500">
          建議使用 Chrome 以支援語音輸入。適合小朋友的可愛闖關遊戲 ∙ 單字管理支援圖片與難度分級。
        </footer>
      </div>
    </div>
  );
}
