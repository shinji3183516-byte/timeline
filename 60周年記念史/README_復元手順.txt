高岡工場60周年 Himari — GitHubアップロード用 分割版
====================================================

【目的】
元の大容量HTMLを、GitHubで扱いやすい構成へ分離しています。
index.html、画像、ナレーション音声、BGMを元のフォルダ構成へ戻せば動作します。

【完成時のフォルダ構成】
Takaoka60_Himari_GitHub/
├─ index.html
└─ assets/
   ├─ images/
   │  └─ image_01...image_18 など
   └─ audio/
      ├─ audi_01.wav ～ audi_35.wav
      └─ bgm.wav

【復元手順】
1. 01_HTML_Images.zip、02_Audio_01-12.zip、03_Audio_13-24.zip、
   04_Audio_25-35.zip をすべて展開します。
2. 展開した内容を、同じ「Takaoka60_Himari_GitHub」フォルダへ統合します。
   ※ assets/images と assets/audio の階層を変更しないでください。
3. BGMは容量が大きいため3分割しています。
   05_BGM_part1.zip、06_BGM_part2.zip、07_BGM_part3.zip を展開し、
   bgm.wav.part01、bgm.wav.part02、bgm.wav.part03 を同じ場所に置きます。
4. Macの「ターミナル」を開き、3つのpartファイルがあるフォルダで次を実行します。

   cat bgm.wav.part01 bgm.wav.part02 bgm.wav.part03 > bgm.wav

5. 完成した bgm.wav を
   Takaoka60_Himari_GitHub/assets/audio/bgm.wav
   に入れます。
6. bgm.wav.part01～03 は削除して構いません。
7. 最後に index.html をダブルクリックして、画像・ナレーション・BGMが正常に動くことを確認します。

【GitHubへアップロードするもの】
復元後の「Takaoka60_Himari_GitHub」フォルダの中身をアップロードします。
ZIPファイルや bgm.wav.part01～03 はGitHubへアップロードする必要はありません。

GitHub上では次の構成を維持してください。
index.html
assets/images/...
assets/audio/...

【重要】
・index.html と assets フォルダの相対位置を変えないでください。
・audio や images のファイル名を変更しないでください。
・bgm.wav は3つのpartを必ず 01 → 02 → 03 の順番で結合してください。
・元データの表示内容や音声内容は変更せず、ファイル参照方式のみ外部化しています。
