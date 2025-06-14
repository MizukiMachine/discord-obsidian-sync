# Discord → Obsidian インポーターBot

Discordでだらだら書いた投稿が、整形されたメモになってObsidianに保存

## 何をしてくれるの？
- Discord投稿を監視
- 長めの投稿（50文字以上）を自動でピックアップ
- OpenAIで要約・整理
- 関連する過去のメモも自動でリンク
- Obsidianに保存（GitHubリポジトリ経由）

## 使い道
- 思いついたアイデアをDiscordに投稿
- 内容を自動でまとめてくれる
- Obsidian連携に一番お手軽で便利なDiscordの投稿を活用

render.comで24時間動かしっぱなし想定

## セットアップ

### 1. Google Drive設定
1. Google Cloud Consoleでプロジェクト作成
2. Google Drive APIを有効化
3. Service Accountを作成してJSONキーをダウンロード
4. Google Driveで保存先フォルダを作成し、Service Accountと共有
5. フォルダIDをメモ（URLの最後の部分）

### 2. Obsidian同期設定
1. Google Drive Desktopアプリをインストール
2. `C:\Users\negic\projects\obsidian\04_fromdicord_memo` フォルダを作成
3. 上記で作成したGoogle Driveフォルダと同期設定

### 3. 環境変数の設定
以下の環境変数が必要です：

```
DISCORD_TOKEN=あなたのDiscord Botトークン
OPENAI_API_KEY=あなたのOpenAI APIキー
DISCORD_CHANNEL_ID=監視したいDiscordチャンネルのID
GOOGLE_SERVICE_ACCOUNT_KEY=Service AccountのJSONキー（文字列として）
GOOGLE_DRIVE_FOLDER_ID=Google Driveの保存先フォルダID
```

### 4. render.comでのデプロイ
1. このリポジトリをGitHubにプッシュ
2. render.comでWeb Serviceを作成
3. 上記の環境変数を設定
4. デプロイ完了

### 5. 動作確認
1. Discord Botを対象チャンネルに招待
2. 50文字以上のメッセージを投稿
3. Google Driveフォルダにファイルが作成される
4. Google Drive Desktopで自動同期される
5. `C:\Users\negic\projects\obsidian\04_fromdicord_memo` にメモファイルが表示される

## 使い方
1. Discord Botを対象チャンネルに招待
2. 50文字以上のメッセージを投稿
3. Botが✅リアクションをつけたら処理完了
4. 数分後、ローカルObsidianフォルダに整理されたメモが自動で追加される
5. 関連リンク付きのメモがObsidianで利用可能

## ファイル形式
保存されるメモは以下の形式
```
# 20250614_192830_投稿内容の要約タイトル

2025年06月14日19時28分作成

[投稿内容を要約・整理した本文]

#タグ1 #タグ2 #タグ3 #タグ4

[[関連メモ1]]
[[関連メモ2]]
```

## 注意点
- OpenAI APIの利用料金が発生します
- render.comの無料プランでも動作しますが、スリープ機能があります
- Google Drive Desktopアプリが必要です（自動同期のため）
- Google Drive APIの利用制限があります（通常は十分な容量）
