import React, { useRef, useEffect } from 'react';

// Type definitions moved to a central place, e.g., src/types.ts
// For now, we redefine them here.
export interface VocabItem {
  id: string;
  word: string;
  imageDataUrl?: string;
  imageName: string;
  size: number;
  type: string;
  difficulty: number;
  enabled: boolean;
  pathHint?: string;
}

const MAX_IMAGE_BYTES = 1024 * 1024; // 1MB

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

interface VocabManagerProps {
  vocab: VocabItem[];
  onVocabChange: (vocab: VocabItem[]) => void;
  onGoBack: () => void;
}

export const VocabManager: React.FC<VocabManagerProps> = ({ vocab, onVocabChange, onGoBack }) => {
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (dirInputRef.current) {
      // @ts-ignore
      dirInputRef.current.webkitdirectory = true;
    }
  }, []);

  async function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function fileNameToWord(name: string): string {
    const base = name.replace(/\.[^.]+$/, "");
    return base.toLowerCase().replace(/[^a-z]/g, "");
  }

  function parseDifficultyFromPath(path?: string): number | null {
    if (!path) return null;
    const segments = path.split("/");
    for (const seg of segments) {
      const m = seg.match(/^(\d{3})-/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n)) return Math.max(1, Math.min(5, n));
      }
    }
    return null;
  }

  function uid(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function handleFilesSelected(files: FileList, directoryMode: boolean) {
    const arr = Array.from(files);
    const newItems: VocabItem[] = [];
    const errors: string[] = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        errors.push(`${f.name}: Not an image file`);
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        errors.push(`${f.name}: File too large`);
        continue;
      }
      let dataUrl: string | undefined;
      try {
        dataUrl = await fileToDataUrl(f);
      } catch {
        errors.push(`${f.name}: Failed to load`);
        continue;
      }
      const anyFile = f as any;
      const relPath: string | undefined = directoryMode ? anyFile.webkitRelativePath : undefined;
      const word = fileNameToWord(f.name);
      if (!word) {
        errors.push(`${f.name}: Could not derive word from filename`);
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
      onVocabChange([...vocab, ...newItems]);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">字彙管理</h1>
                <button onClick={onGoBack} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">返回遊戲</button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="px-4 py-2 bg-sky-600 text-white rounded-lg cursor-pointer text-sm font-medium">
                新增圖片
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handleFilesSelected(e.target.files, false)}
                />
              </label>
              <label className="px-4 py-2 bg-amber-500 text-white rounded-lg cursor-pointer text-sm font-medium">
                匯入資料夾
                <input
                  ref={dirInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFilesSelected(e.target.files, true)}
                  multiple
                />
              </label>
            </div>

            <div className="max-h-96 overflow-auto border rounded-lg">
              <ul className="divide-y divide-gray-200">
                {vocab.map((v) => (
                  <li key={v.id} className="p-3 flex items-center gap-4">
                    <ImagePreview src={v.imageDataUrl} />
                    <div className="flex-1">
                      <span className="font-semibold">{v.word}</span>
                      <DifficultyPips level={v.difficulty} />
                    </div>
                    <div className="flex items-center gap-4">
                      <select
                        className="border-gray-300 rounded-md"
                        value={v.difficulty}
                        onChange={(e) =>
                          onVocabChange(vocab.map((i) => i.id === v.id ? { ...i, difficulty: Number(e.target.value) } : i))
                        }
                      >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5"
                        checked={v.enabled}
                        onChange={(e) =>
                          onVocabChange(vocab.map((i) => i.id === v.id ? { ...i, enabled: e.target.checked } : i))
                        }
                      />
                      <button onClick={() => onVocabChange(vocab.filter(i => i.id !== v.id))} className="text-red-500 hover:text-red-700">刪除</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
        </div>
    </div>
  );
};
