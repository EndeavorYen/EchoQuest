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
