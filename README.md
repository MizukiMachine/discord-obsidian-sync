# Discord → Obsidian インポーターBot

Discordでだらだら書いた投稿が、AI整形されてObsidianのメモになって保存

## してくれること
- Discordの投稿を監視・整理してObsidianに保存
- URLのみの投稿は別途要約してURL専用フォルダに保存
- AIで自動整理して読みやすい形に
- 過去のメモとの関連も自動で見つけてリンク

## 必要な設定

### 1. ObsidianをGoogle Drive上に配置
ObsidianのVault自体をGoogle Driveフォルダ内に作成想定です

### 2. 環境変数の設定
```
DISCORD_TOKEN=Discord Botトークン
OPENAI_API_KEY=OpenAI APIキー
DISCORD_CHANNEL_ID=監視するチャンネルID
GOOGLE_SERVICE_ACCOUNT_KEY=Google Service AccountのJSONキー
GOOGLE_DRIVE_FOLDER_ID=Obsidian内の通常メモ保存先フォルダID
GOOGLE_DRIVE_URL_FOLDER_ID=Obsidian内のURL要約保存先フォルダID
```

### 3. render.comにデプロイ
上記の環境変数を設定してデプロイする

## 使い方

**通常メッセージ**
1. Discordチャンネルにメッセージを投稿
2. Botが✅リアクションをつけたら処理完了
3. Obsidianに整理されたメモが自動で追加される

**URL投稿**
1. DiscordチャンネルにURLのみ投稿
2. Botが🔗リアクションをつけたら処理完了
3. URL要約がObsidianの専用フォルダに自動保存される

## 生成されるファイル例
**ファイル名**: `2025_06-15_19-30_投稿の内容.md`

**中身**:
```
# 投稿の内容

2025年06月15日19時30分作成

- 投稿内容を読みやすく整理した内容
- 元の情報は削らずに箇条書きで整形
- 自然な日本語に修正

#タグ1 #タグ2 #タグ3

[[関連するメモ]]
```

## 注意点
- OpenAI APIの料金がかかります
- Google Drive上でObsidianを動かす必要があります