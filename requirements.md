# Discord Bot 要件定義書

## プロジェクト概要
Discordに投稿された文章をAIが要約・整形し、Obsidianに自動保存するBot

## 機能要件

### 1. Discord Bot基本機能
- Discord APIを使用したメッセージ監視
- 指定チャンネルでのメッセージ受信
- 短いメッセージ（50文字未満）の除外

### 2. AI文章整形機能
- OpenAI API（GPT-3.5-turbo）使用（コストパフォーマンス重視）
- メッセージの要約・構造化
- Obsidian形式での整形

### 3. ファイル保存機能
- ファイル命名規則: `YYYYMMDD_HHMMSS_[トピックの説明].md`
- 保存先: `C:\Users\negic\projects\obsidian\04_fromdicord_memo`
- Markdownフォーマット

### 4. 関連性分析・リンク機能
- 既存メモとの関連性自動分析
- 関連メモへのリンク自動生成
- 関連度の数値表示

## 技術要件

### デプロイ環境
- GitHub連携
- render.comでのホスティング
- 24時間稼働

### 必要な環境変数
- DISCORD_TOKEN
- OPENAI_API_KEY  
- OBSIDIAN_VAULT_PATH=C:\Users\negic\projects\obsidian\04_fromdicord_memo
- DISCORD_CHANNEL_ID

### 依存関係
- discord.js
- openai
- dotenv
- fs-extra

## 特記事項
⚠️ **重要**: 作業中は作業日誌を書きながら進める（ユーザーは見ないため自由に記述可能）