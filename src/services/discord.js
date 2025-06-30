const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../config');

class DiscordService {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });
        
        this.processedMessages = new Set();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`Logged in as ${this.client.user.tag}!`);
            config.logConfigStatus();
        });
    }

    async login() {
        return this.client.login(config.discordToken);
    }

    onMessage(callback) {
        this.client.on('messageCreate', async (message) => {
            // Bot自身のメッセージは無視
            if (message.author.bot) return;
            
            // 指定チャンネル以外は無視
            if (config.discordChannelId && message.channel.id !== config.discordChannelId) return;
            
            // 重複処理防止
            if (this.processedMessages.has(message.id)) {
                console.log(`Already processed message: ${message.id}`);
                return;
            }
            
            this.processedMessages.add(message.id);
            this.limitProcessedMessagesSize();
            
            try {
                console.log(`Processing message: ${message.content.substring(0, 100)}...`);
                await callback(message);
            } catch (error) {
                console.error('Error processing message:', error);
                await this.reactError(message);
                // エラー時はSetからIDを削除（再試行可能にする）
                this.processedMessages.delete(message.id);
            }
        });
    }

    limitProcessedMessagesSize() {
        // Setのサイズを制限（メモリリーク防止）
        if (this.processedMessages.size > config.processedMessagesLimit) {
            const firstEntry = this.processedMessages.values().next().value;
            this.processedMessages.delete(firstEntry);
        }
    }

    async reactSuccess(message) {
        await message.react('✅');
    }

    async reactUrl(message) {
        await message.react('🔗');
    }

    async reactError(message) {
        await message.react('❌');
    }

    async reply(message, content) {
        await message.reply(content);
    }

    isURLOnly(content) {
        const trimmed = content.trim();
        const urlRegex = /^https?:\/\/[^\s]+$/;
        return urlRegex.test(trimmed);
    }

    createResponseMessage(formattedContent, filename, relatedNotes) {
        console.log('DEBUG - formattedContent:', formattedContent);
        
        // フォーマットされたコンテンツからタイトル、本文、タグを抽出
        const lines = formattedContent.split('\n').map(line => line.trim()).filter(line => line);
        
        let title = '';
        let content = '';
        let tags = '';
        let contentLines = [];
        let isContentSection = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('# ')) {
                title = line.substring(2);
                isContentSection = false;
            } else if (line.includes('年') && line.includes('月') && line.includes('日') && line.includes('作成')) {
                isContentSection = true;
                continue;
            } else if (line.startsWith('#') && line.includes(' #')) {
                tags = line;
                isContentSection = false;
            } else if (line.startsWith('[[') && line.endsWith(']]')) {
                isContentSection = false;
            } else if (isContentSection && line.length > 0) {
                contentLines.push(line);
            }
        }
        
        // コンテンツを結合
        if (contentLines.length > 0) {
            if (contentLines[0].startsWith('-')) {
                content = contentLines.join('\n');
            } else {
                content = contentLines.join(' ');
            }
            
            // Discord表示用に長すぎる場合のみ制限
            if (content.length > 300) {
                if (contentLines[0].startsWith('-')) {
                    content = contentLines.slice(0, 7).join('\n');
                    if (contentLines.length > 7) content += '\n...';
                } else {
                    content = content.substring(0, 300) + '...';
                }
            }
        }
        
        console.log('DEBUG - extracted title:', title);
        console.log('DEBUG - extracted content:', content);
        console.log('DEBUG - extracted tags:', tags);
        
        // 関連タイトル情報
        let relatedInfo = '';
        if (relatedNotes.length > 0) {
            const relatedTitles = relatedNotes.map(note => note.filename).join(', ');
            relatedInfo = `\n* **関連メモ**: ${relatedTitles}`;
        }
        
        const responseMessage = `**Bot処理完了！**

* **タイトル**: ${title}
* **コンテンツ**: ${content}
* **タグ**: ${tags}${relatedInfo}
* **保存完了**: テキストmemoを \`${filename}\` として保存しました！（Obsidian連携フォルダ）`;

        return responseMessage;
    }

    createURLResponseMessage(topicName, filename) {
        return `**URL要約完了！**\n* **タイトル**: ${topicName}\n* **保存完了**: \`${filename}\``;
    }
}

module.exports = DiscordService;