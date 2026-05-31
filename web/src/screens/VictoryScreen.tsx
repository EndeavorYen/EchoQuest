import React from 'react';
import { Trophy } from 'lucide-react';
import { Panel, QuestButton, ScreenShell } from '../components/QuestFrame';

type VictoryScreenProps = {
  score: number;
  correctAnswers: number;
  onStartGame: () => void;
};

export function VictoryScreen({ score, correctAnswers, onStartGame }: VictoryScreenProps) {
  return (
    <ScreenShell screen="victory" label="EchoQuest 勝利結果" className="grid place-items-center">
      <Panel className="w-full max-w-md p-8 text-center">
        <Trophy className="w-20 h-20 text-[color:var(--eq-sun)] mx-auto mb-4" />
        <h1 className="eq-display text-4xl font-extrabold text-[color:var(--eq-ink)] mb-4">勝利！</h1>
        <p className="text-2xl font-extrabold text-[color:var(--eq-river)] mb-2">最終分數: {score}</p>
        <p className="text-lg text-[color:var(--eq-muted)] mb-6">答對 {correctAnswers} 個單字</p>
        <QuestButton onClick={onStartGame} className="w-full" variant="gold" icon={<Trophy className="w-5 h-5" />}>
          再玩一次
        </QuestButton>
      </Panel>
    </ScreenShell>
  );
}
