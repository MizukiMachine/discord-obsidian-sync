const DiscordService = require('./src/services/discord');
const OpenAIService = require('./src/services/openai');
const DriveService = require('./src/services/drive');
const HttpService = require('./src/utils/http');
const FilenameUtils = require('./src/utils/filename');
const { MessageFormatter } = require('./src/config/messages');

class DiscordObsidianBot {
    constructor() {
        this.discordService = new DiscordService();
        this.openaiService = new OpenAIService();
        this.driveService = new DriveService();
    }

    async start() {
        this.discordService.onMessage(async (message) => {
            await this.processMessage(message);
        });

        await this.discordService.login();
    }

    async processMessage(message) {
        const japanTime = FilenameUtils.getJapanTime();
        
        if (this.discordService.isURLOnly(message.content)) {
            console.log('Detected URL-only message, processing as URL summary...');
            await this.processURLMessage(message, japanTime);
        } else {
            await this.processNormalMessage(message, japanTime);
        }
    }

    async processNormalMessage(message, japanTime) {
        // トピック名を生成
        const topicName = await this.openaiService.generateTopicName(message.content);
        
        // ファイル名を生成
        const filename = FilenameUtils.generateFilename(topicName, japanTime);
        
        // フォーマット済みコンテンツを生成
        const formattedContent = await this.openaiService.formatMessageWithAI(message.content, japanTime, topicName);
        
        // 関連メモを検索
        const relatedNotes = await this.driveService.findRelatedNotes(
            formattedContent, 
            this.openaiService.extractKeywords.bind(this.openaiService)
        );
        
        // 関連リンクを追加
        const finalContent = FilenameUtils.addRelatedLinks(formattedContent, relatedNotes);
        
        // Google Driveに保存
        await this.driveService.saveToGoogleDrive(finalContent, filename);
        
        // 応答メッセージを作成して送信
        const responseMessage = this.discordService.createResponseMessage(formattedContent, filename, relatedNotes);
        await this.discordService.reply(message, responseMessage);
        
        await this.discordService.reactSuccess(message);
        console.log(`Saved note: ${filename}`);
    }

    async processURLMessage(message, japanTime) {
        const url = message.content.trim();
        console.log(`DEBUG: Processing URL message: ${url}`);
        
        try {
            console.log(`DEBUG: Step 1 - Summarizing URL...`);
            // URL先のページ内容を取得・要約
            const urlSummary = await this.summarizeURL(url, japanTime);
            console.log(`DEBUG: Step 2 - URL summary generated (length: ${urlSummary.length})`);
            
            console.log(`DEBUG: Step 3 - Generating topic name...`);
            const topicName = await this.openaiService.generateURLTopicName(urlSummary);
            console.log(`DEBUG: Step 4 - Topic name generated: ${topicName}`);
            
            console.log(`DEBUG: Step 5 - Generating filename...`);
            const filename = FilenameUtils.generateFilename(topicName, japanTime);
            console.log(`DEBUG: Step 6 - Filename generated: ${filename}`);
            
            console.log(`DEBUG: Step 7 - Saving to Google Drive...`);
            await this.driveService.saveToGoogleDrive(urlSummary, filename, true);
            console.log(`DEBUG: Step 8 - File saved successfully`);
            
            const responseMessage = this.discordService.createURLResponseMessage(topicName, filename);
            await this.discordService.reply(message, responseMessage);
            await this.discordService.reactUrl(message);
            console.log(`✅ Saved URL summary: ${filename}`);
        } catch (error) {
            console.error('❌ Error processing URL:', error);
            console.error('❌ Error stack:', error.stack);
            const errorMessage = MessageFormatter.formatError('URL_PROCESSING', error.message);
            await this.discordService.reply(message, errorMessage);
            throw error;
        }
    }

    async summarizeURL(url, japanTime) {
        try {
            console.log(`DEBUG: Attempting to fetch URL content: ${url}`);
            
            // URL内容を取得
            const pageContent = await HttpService.fetchURLContent(url);
            console.log(`DEBUG: Page content fetched, length: ${pageContent.length}`);
            
            // 取得した内容を要約
            return await this.openaiService.summarizeURL(url, pageContent, japanTime);
        } catch (error) {
            console.error('Error summarizing URL:', error);
            console.log('DEBUG: Falling back to basic URL summary');
            // フォールバック：URL取得失敗時に基本的な要約を生成
            return await this.openaiService.createBasicURLSummary(url, japanTime);
        }
    }
}

// アプリケーション起動
const bot = new DiscordObsidianBot();
bot.start().catch(console.error);