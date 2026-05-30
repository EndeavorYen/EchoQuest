import React, { useRef, useEffect } from 'react';
import { ArrowLeft, FolderOpen, ImagePlus, Trash2 } from 'lucide-react';
import { Panel, QuestButton, ScreenShell } from './QuestFrame';
import type { VocabItem } from '../types/vocab';

export type { VocabItem } from '../types/vocab';

const MAX_IMAGE_BYTES = 1024 * 1024; // 1MB

// Exported for testing
export function fileNameToWord(name: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return base.toLowerCase().replace(/[^a-z]/g, "");
}

// Exported for testing
export function parseDifficultyFromPath(path?: string): number | null {
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

function DifficultyPips({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" title={`Difficulty ${level}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={
            "w-2 h-2 rounded-full " +
            (i < level ? "bg-[color:var(--eq-sun)]" : "bg-stone-300")
          }
        />
      ))}
    </div>
  );
}

function ImagePreview({ src }: { src?: string }) {
  if (!src) {
    return <div className="eq-preview eq-preview--empty" aria-hidden="true">+</div>;
  }
  return (
    <img
      src={src}
      alt="vocab"
      className="eq-preview"
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
    <ScreenShell screen="vocab-management" label="EchoQuest 字彙庫">
      <div className="eq-vocab-shell">
        <Panel className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <p className="text-sm font-extrabold uppercase text-[color:var(--eq-muted)]">Inventory</p>
              <h1 className="eq-display text-3xl font-extrabold text-[color:var(--eq-ink)]">字彙管理</h1>
            </div>
            <QuestButton onClick={onGoBack} variant="quiet" icon={<ArrowLeft className="w-5 h-5" />}>
              返回遊戲
            </QuestButton>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <label className="eq-button eq-button--secondary cursor-pointer text-sm">
              <ImagePlus className="w-5 h-5" />
              <span>新增圖片</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files, false)}
              />
            </label>
            <label className="eq-button eq-button--gold cursor-pointer text-sm">
              <FolderOpen className="w-5 h-5" />
              <span>匯入資料夾</span>
              <input
                ref={dirInputRef}
                type="file"
                className="hidden"
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files, true)}
                multiple
              />
            </label>
          </div>

          <div className="eq-vocab-list">
            <ul>
              {vocab.map((v) => (
                <li key={v.id} className="eq-vocab-row">
                  <ImagePreview src={v.imageDataUrl} />
                  <div className="min-w-0">
                    <span className="font-extrabold text-[color:var(--eq-ink)]">{v.word}</span>
                    <DifficultyPips level={v.difficulty} />
                  </div>
                  <div className="eq-vocab-actions flex flex-wrap items-center gap-3">
                    <select
                      className="eq-select"
                      value={v.difficulty}
                      onChange={(e) =>
                        onVocabChange(vocab.map((i) => i.id === v.id ? { ...i, difficulty: Number(e.target.value) } : i))
                      }
                    >
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[color:var(--eq-forest)]"
                      checked={v.enabled}
                      onChange={(e) =>
                        onVocabChange(vocab.map((i) => i.id === v.id ? { ...i, enabled: e.target.checked } : i))
                      }
                    />
                    <QuestButton
                      onClick={() => onVocabChange(vocab.filter(i => i.id !== v.id))}
                      variant="danger"
                      icon={<Trash2 className="w-4 h-4" />}
                    >
                      刪除
                    </QuestButton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </ScreenShell>
  );
};
