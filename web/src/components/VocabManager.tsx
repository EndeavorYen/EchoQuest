import React, { useEffect, useMemo, useRef, useState } from 'react';
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

export function mergeImportedVocab(existing: VocabItem[], incoming: VocabItem[]) {
  const seen = new Set(existing.map((item) => item.word.trim().toLowerCase()));
  const addedItems: VocabItem[] = [];
  let skipped = 0;

  for (const item of incoming) {
    const word = item.word.trim().toLowerCase();
    if (!word || seen.has(word)) {
      skipped += 1;
      continue;
    }
    seen.add(word);
    addedItems.push({ ...item, word });
  }

  return {
    vocab: [...existing, ...addedItems],
    added: addedItems.length,
    skipped,
  };
}

function DifficultyPips({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" title={`難度 ${level}`}>
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

function ImagePreview({ src, label }: { src?: string; label: string }) {
  if (!src) {
    return <div className="eq-preview eq-preview--empty" aria-hidden="true">+</div>;
  }
  return (
    <img
      src={src}
      alt={`${label} 圖片`}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [importSummary, setImportSummary] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);

  const visibleVocab = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return vocab.filter((item) => {
      const matchesQuery = !query || item.word.toLowerCase().includes(query);
      const matchesVisibility = visibility === 'all'
        || (visibility === 'enabled' ? item.enabled : !item.enabled);
      return matchesQuery && matchesVisibility;
    });
  }, [searchQuery, visibility, vocab]);

  useEffect(() => {
    if (dirInputRef.current) {
      dirInputRef.current.setAttribute('webkitdirectory', '');
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
        errors.push(`${f.name}：不是圖片檔案`);
        continue;
      }
      if (f.size > MAX_IMAGE_BYTES) {
        errors.push(`${f.name}：檔案超過 1MB`);
        continue;
      }
      let dataUrl: string | undefined;
      try {
        dataUrl = await fileToDataUrl(f);
      } catch {
        errors.push(`${f.name}：讀取失敗`);
        continue;
      }
      const relPath = directoryMode ? f.webkitRelativePath : undefined;
      const word = fileNameToWord(f.name);
      if (!word) {
        errors.push(`${f.name}：檔名中找不到英文單字`);
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
    const merged = mergeImportedVocab(vocab, newItems);
    setImportSummary({ added: merged.added, skipped: merged.skipped, errors });
    if (merged.added > 0) {
      onVocabChange(merged.vocab);
    }
  }

  return (
    <ScreenShell screen="vocab-management" label="EchoQuest 字彙庫">
      <div className="eq-vocab-shell">
        <Panel className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <p className="text-sm font-extrabold text-[color:var(--eq-muted)]">家庭字庫</p>
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

          {importSummary && (
            <div className="mb-5 rounded-md border border-[color:var(--eq-line)] bg-white p-3 text-sm text-[color:var(--eq-ink)]" role="status">
              <strong>匯入完成：</strong>新增 {importSummary.added} 個、略過重複 {importSummary.skipped} 個、失敗 {importSummary.errors.length} 個。
              {importSummary.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5">
                  {importSummary.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
                </ul>
              )}
            </div>
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="grid gap-1 text-sm font-bold text-[color:var(--eq-ink)]">
              搜尋單字
              <input
                type="search"
                className="eq-input"
                aria-label="搜尋單字"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-[color:var(--eq-ink)]">
              顯示範圍
              <select className="eq-select" aria-label="顯示範圍" value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)}>
                <option value="all">全部</option>
                <option value="enabled">已啟用</option>
                <option value="disabled">已停用</option>
              </select>
            </label>
          </div>

          <div className="eq-vocab-list">
            <ul>
              {visibleVocab.map((v) => (
                <li key={v.id} className="eq-vocab-row">
                  <ImagePreview src={v.imageDataUrl ?? v.imageSrc} label={v.word} />
                  <label className="min-w-0 text-sm font-bold text-[color:var(--eq-ink)]">
                    單字
                    <input
                      className="eq-input mt-1 w-full font-extrabold"
                      aria-label={`${v.word} 單字`}
                      value={v.word}
                      onChange={(event) => {
                        const word = event.target.value.toLowerCase().replace(/[^a-z]/g, '');
                        onVocabChange(vocab.map((item) => item.id === v.id ? { ...item, word } : item));
                      }}
                    />
                    <DifficultyPips level={v.difficulty} />
                  </label>
                  <div className="eq-vocab-actions flex flex-wrap items-center gap-3">
                    <label className="grid gap-1 text-sm font-bold text-[color:var(--eq-ink)]">
                      難度
                      <select
                        className="eq-select"
                        aria-label={`${v.word} 難度`}
                        value={v.difficulty}
                        onChange={(e) =>
                          onVocabChange(vocab.map((i) => i.id === v.id ? { ...i, difficulty: Number(e.target.value) } : i))
                        }
                      >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold text-[color:var(--eq-ink)]">
                      <input
                        type="checkbox"
                        aria-label={`${v.word} 啟用`}
                        className="h-5 w-5 accent-[color:var(--eq-forest)]"
                        checked={v.enabled}
                        onChange={(e) =>
                          onVocabChange(vocab.map((i) => i.id === v.id ? { ...i, enabled: e.target.checked } : i))
                        }
                      />
                      啟用
                    </label>
                    <QuestButton
                      onClick={() => onVocabChange(vocab.filter(i => i.id !== v.id))}
                      variant="danger"
                      icon={<Trash2 className="w-4 h-4" />}
                      aria-label={`刪除 ${v.word}`}
                    >
                      刪除
                    </QuestButton>
                  </div>
                </li>
              ))}
            </ul>
            {visibleVocab.length === 0 && <p className="p-6 text-center text-[color:var(--eq-muted)]" role="status">找不到符合條件的單字。</p>}
          </div>
        </Panel>
      </div>
    </ScreenShell>
  );
};
