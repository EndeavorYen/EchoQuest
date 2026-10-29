# Speech-recognition reports: what has been handled

Parents can copy the on-device recognition log from **Party settings → 辨識紀錄**
("複製新的" = records since the last export, "複製全部" = everything). Records are never
deleted on the phone. Every export begins with a stamped header:

```
# EchoQuest 辨識回報
ID: EQ-20261029-1432-K7QF
匯出: 第 3 次　時間: 2026-10-29 14:32 (UTC+8)
範圍: 上次匯出之後的新紀錄　筆數: 12　版本: 2.3
```

Each record line is JSON: `n` running number, `w` wanted word, `c` what the recogniser heard,
`r` verdict (`perfect`/`good`/`miss`, `confirmed` = "我念對了", `rescued` = defence let through after
two unheard attempts, `skipped` = attack word skipped, `none` = the engine returned nothing, `c` holds
the reason), `lv` level, `t` unix seconds, `s` = very short sound (bee, she…), `d` = defence round.

## How a report is handled

1. When a report is pasted, read its `ID`. If the ID is already listed below, it was handled: skip it.
   (Overlapping records between different exports are harmless.)
2. Otherwise, look at `confirmed` / `rescued` / `skipped` / `none` records, most-repeated words first.
   Add commonly mis-heard spellings to the alias table (`heard` on the word in `src/data/words*`),
   or tune `src/speech/match.ts` when many short words fail the same way.
3. Commit with the export ID(s) in the message, and add a row here in the same commit.

The git history is the second source of truth: `git log --grep "EQ-"` lists handled exports.

## Handled exports

| Export ID | Records | Handled in | What was changed |
| --- | --- | --- | --- |
| _(none yet)_ | | | |
