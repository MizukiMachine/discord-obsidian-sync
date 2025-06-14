# Discord → Obsidian メモBot

Discordでだらだら書いた投稿が、気づいたらちゃんとしたメモになってObsidianに保存されてる。
そんなBotです。

## 何をしてくれるの？
- Discord投稿を監視
- 長めの投稿（50文字以上）を自動でピックアップ
- OpenAIで要約・整理
- 関連する過去のメモも自動でリンク
- Obsidianに保存（GitHubリポジトリ経由）

## 使い道
- 思いついたアイデアをDiscordに投稿しておけば、後でちゃんとしたメモになってる
- 議論の内容を自動でまとめてくれる
- Obsidian連携に一番お手軽で便利なDiscordの投稿を活用

render.comで24時間動かしっぱなしにできます。

## セットアップ

### 1. 環境変数の設定
```
DISCORD_TOKEN=あなたのDiscord Botトークン
OPENAI_API_KEY=あなたのOpenAI APIキー
DISCORD_CHANNEL_ID=監視したいDiscordチャンネルのID
GITHUB_TOKEN=GitHubのPersonal Access Token
GITHUB_OWNER=GitHubのユーザー名
GITHUB_REPO=Obsidianメモを保存するリポジトリ名
```

### 2. render.comでのデプロイ
1. このリポジトリをGitHubにプッシュ
2. render.comでWeb Serviceを作成
3. 上記の環境変数を設定
4. デプロイ完了

### 3. Obsidianでの設定
- Gitプラグインを使って、上記のGitHubリポジトリをObsidianで同期
- `04_fromdicord_memo` フォルダにメモが保存されます

## 使い方
1. Discord Botを対象チャンネルに招待
2. 50文字以上のメッセージを投稿
3. Botが✅リアクションをつけたら処理完了
4. GitHubリポジトリを確認すると、整理されたメモが保存されています
5. Obsidianで同期すると、関連リンク付きのメモが利用できます

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
