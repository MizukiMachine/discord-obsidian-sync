const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../config');
const { MessageFormatter } = require('../config/messages');

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
            // BOTが返信してくるから、BOT自身のメッセージは無視
            if (message.author.bot) return;
            
            if (config.discordChannelId && message.channel.id !== config.discordChannelId) return;
            
            // 通信エラーとかでの重複処理防止
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
                // エラー時はSetからIDを削除。再処理不可能にしたくない
                this.processedMessages.delete(message.id);
            }
        });
    }

    limitProcessedMessagesSize() {
        // Setのサイズを制限（メモリリーク防止）。configで適当に50くらいに設定している
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
        
        const parsedData = this.parseFormattedContent(formattedContent);
        
        console.log('DEBUG - extracted title:', parsedData.title);
        console.log('DEBUG - extracted content:', parsedData.content);
        console.log('DEBUG - extracted tags:', parsedData.tags);
        
        return MessageFormatter.formatProcessComplete({
            title: parsedData.title,
            content: parsedData.content,
            tags: parsedData.tags,
            relatedNotes: relatedNotes,
            filename: filename
        });
    }

    parseFormattedContent(formattedContent) {
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
        
        return { title, content, tags };
    }

    createURLResponseMessage(topicName, filename) {
        return MessageFormatter.formatURLComplete(topicName, filename);
    }
}

module.exports = DiscordService;