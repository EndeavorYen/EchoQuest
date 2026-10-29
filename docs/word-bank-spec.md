# 字庫規格（人與 agent 共用）

這份文件是字庫的唯一規格。要請 agent（例如 Gemini）產生或修訂字庫時，用 `npm run words:prompt` 產出提示詞，提示詞內容就是下面的規則；驗證器（`src/data/validate.ts`）執行的也是同一組規則。規格改了，兩邊一起改。

## 1. 單字檔（pack）

字庫放在 `src/data/packs/<id>.json`，一個檔案一個來源（`starter`、`cefrj`、之後的 `moe1200`…）。遊戲啟動時全部合併。

```jsonc
{
 "id": "cefrj",                 // 小寫英數與 -
 "name": "CEFR-J Wordlist v1.5",
 "license": "出處與為什麼可以放進來（必填）",
 "lists": ["cefrj"],            // 這個檔案裡每個字都加入的清單
 "words": [
  {"w":"apple","pos":"n","zh":"蘋果","lv":1,"topic":"produce","icon":"🍎","cefr":"A1","heard":["apple pie"]}
 ]
}
```

## 2. 每個字的欄位

| 欄位 | 必填 | 規則 |
|---|---|---|
| `w` | 是 | 小寫英文字或片語（可含空格、`-`、`'`、`.`），不含前後空白。美式拼法。 |
| `pos` | 是 | `n` `v` `adj` `adv` `prep` `conj` `pron` `det` `num` `interj` `phr` 之一。助動詞、be、do、have 一律 `v`。 |
| `zh` | 是 | 台灣慣用的**繁體中文**短義，最多 14 字，只有中文（不要拼音、不要英文、不要簡體、不要中國用語）。給孩子聽的日常說法，不是字典定義。多義時取最常用的一個，必要時用「、」放最多三個。 |
| `lv` | 是 | 遊戲難度 1–4，見第 3 節。 |
| `topic` | 新字必填 | `src/data/topics.json` 裡的 id。選最貼近這個字**日常用法**的一個。 |
| `icon` | 否 | 一個 emoji。有明確、孩子看得懂的圖才給；沒有就不要給。**沒有圖完全沒關係**：遊戲會顯示中文，並且先念英文、再念中文。 |
| `cefr` | 否 | 來源清單標的 CEFR 等級（A1 A2 B1 B2 C1），由腳本填入，agent 不要改。 |
| `heard` | 否 | 語音辨識常把這個字聽成什麼（小寫，最多 12 個，不可與字相同）。只在有把握時填，例如 `egg` → `ag`。 |
| `lists` | 否 | 這個字另外加入的清單 id。 |
| `retired` / `replacedBy` | 否 | 見第 5 節。 |

**字的身分**是 `w` + `pos`，寫成 `w:pos`（如 `bank:n`）。玩家的進度、收藏都用這個 id 記。`bank` 當名詞和動詞是兩個字。

## 3. 難度 `lv`

| lv | 對象 | 給法 |
|---|---|---|
| 1 幼兒園 | 約 3–6 歲，家長陪著學 | 孩子在繪本、兒歌、日常對話最先接觸的字：身邊的人事物、顏色、數字、簡單動作與形容詞、打招呼。全庫**大約 300 字**，寧缺勿濫。 |
| 2 國小 | 國小 | 其餘 A1，以及 A2。 |
| 3 國中 | 國中 | B1。 |
| 4 高中 | 高中以上 | B2、C1。 |

有 `cefr` 時，`lv` 只能落在：A1→1 或 2；A2→2；B1→3；B2→4；C1→4。不確定就取較高的一級。

不用因為「畫不出來」而降級或跳過。介系詞、連接詞、抽象的字照樣收，只是通常 lv 2 以上。

## 4. 不適合的字

下列字用 `"skip": true` 並寫 `"why"`，不進字庫：粗話與侮辱性用語、性與暴力相關的詞、菸酒藥物的口語說法、縮寫與符號（如 `a.m.`）、只能當專有名詞的字。其餘中性或學術的字（如 `alcohol`、`death`）照收，由 lv 3 以上承擔。

## 5. 修改、退役與合併（字庫一直在變）

**不刪除。** 想拿掉一個字：

- 單純不要了：`{"w":"x","pos":"n","retired":true}`。字留在檔案裡，遊戲不再出這個字，玩家舊進度保留但被忽略（之後復活，進度還在）。
- 改名或詞性不同、或兩個字合併：舊字標 `"retired":true,"replacedBy":"新字:pos"`，另外加入新字。玩家的進度、收藏、學過的辨識別名會在下次開啟遊戲時搬到新字；兩邊都有進度則取較好的熟練度並累加次數。
- 改中文、難度、主題、圖示、`heard`：直接改欄位，id 不變，進度不受影響。
- 復活：移掉 `retired`（和 `replacedBy`）。

改完一定要跑 `npm run words:commit -- --note "做了什麼"`。它比對上次提交，在 `src/data/bankstate/ledger.json` 加一筆修訂（新增／搬移／退役／修訂的字清單，附日期與說明），並更新 `snapshot.json`。單元測試會擋住「改了字庫卻沒提交」和「字被刪掉」。

## 6. 玩家存檔如何跟上

- 存檔記 `bankRev`＝它對帳到的字庫修訂號。
- 遊戲每次讀檔，把 `ledger.json` 裡比它新的修訂依序重播：只有「搬移」會改資料。重播是冪等的（做兩次結果一樣）。
- 存檔比程式新（`bankRev` 較大，例如另一台裝置已更新）不處理，也不降級。
- 不認得的字 id 永遠保留，不清掉。
- 一場對戰開始後，字庫在那場內不變。

## 7. 流程

```
npm run words:batches                          # 把 CEFR-J 切成每批 100 字：words-work/batches/cefrj-001.json …
npm run words:prompt -- words-work/batches/cefrj-001.json > p.txt   # 產生提示詞（規則＋這一批的字）
#   → 交給 agent 處理，回傳格式見 docs/word-bank-reply.schema.json，存成 reply.json
npm run words:merge -- reply.json --batch words-work/batches/cefrj-001.json
#   → 通過的併入 pack；不通過的寫進 words-work/rejects/，把原因貼回去請它重做
npm run words:commit -- --note "cefrj batch 1"
npm run words:check                            # 隨時可跑；CI 與單元測試也會跑
```

修訂既有字：`npm run words:prompt -- --revise "把食物類的中文改得更口語" --topic food --lv 2`，同樣存成 reply.json 後 merge。回傳的每筆只需要 `w`、`pos` 與要改的欄位。

匯入另一份清單（例如教育部 1200 字）：每行一個字（可選 `字<Tab>詞性`）存成文字檔，`npm run words:batches -- --list moe1200.txt --pack moe1200`。已經在字庫裡的字不會重做。

## 8. 授權

每個 pack 的 `license` 必須寫明來源與可以使用的依據。只取英文單字本身；中文、主題、圖示、難度是我們自己的。CEFR-J 要求引用：Tono Laboratory, TUFS，見 `data-source/README.md`。
