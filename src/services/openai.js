const OpenAI = require('openai');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

class OpenAIService {
    constructor() {
        this.client = new OpenAI({
            apiKey: config.openaiApiKey,
        });
        
        this.prompts = this.loadPrompts();
    }

    loadPrompts() {
        const promptsDir = path.join(__dirname, '../../prompts');
        return {
            formatMessageSystem: fs.readFileSync(path.join(promptsDir, 'format_message_system.txt'), 'utf-8'),
            generateTopicNameSystem: fs.readFileSync(path.join(promptsDir, 'generate_topic_name_system.txt'), 'utf-8'),
            extractKeywordsSystem: fs.readFileSync(path.join(promptsDir, 'extract_keywords_system.txt'), 'utf-8'),
            summarizeUrlSystem: fs.readFileSync(path.join(promptsDir, 'summarize_url_system.txt'), 'utf-8'),
            summarizeUrlFallbackSystem: fs.readFileSync(path.join(promptsDir, 'summarize_url_fallback_system.txt'), 'utf-8'),
            generateUrlTopicNameSystem: fs.readFileSync(path.join(promptsDir, 'generate_url_topic_name_system.txt'), 'utf-8'),
        };
    }

    async formatMessageWithAI(content, japanTime, topicName) {
        const userMessage = [
            `現在の日本時間: ${this.formatJapanTime(japanTime)}`,
            `トピック名: ${topicName}`,
            '',
            `投稿内容: ${content}`
        ].join('\n');

        const response = await this.client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                {
                    role: "system",
                    content: this.prompts.formatMessageSystem,
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        });
        
        return response.choices[0].message.content;
    }

    async generateTopicName(content) {
        const response = await this.client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                {
                    role: "system",
                    content: this.prompts.generateTopicNameSystem,
                },
                {
                    role: "user",
                    content: content
                }
            ],
            max_tokens: 50,
            temperature: 0.3
        });
        
        return response.choices[0].message.content
            .replace(/[<>:"/\\|?*]/g, '')
            .trim();
    }

    async extractKeywords(content) {
        try {
            const response = await this.client.chat.completions.create({
                model: config.openaiModel,
                messages: [
                    {
                        role: "system",
                        content: this.prompts.extractKeywordsSystem,
                    },
                    {
                        role: "user",
                        content: content.substring(0, 1000)
                    }
                ],
                max_tokens: 100,
                temperature: 0.3
            });
            
            const keywordsText = response.choices[0].message.content.trim();
            return keywordsText.split(',').map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);
        } catch (error) {
            console.error('Error extracting keywords:', error);
            return [];
        }
    }

    async summarizeURL(url, pageContent, japanTime) {
        const userMessage = [
            `現在の日本時間: ${this.formatJapanTime(japanTime)}`,
            '',
            `URL: ${url}`,
            '',
            'ページ内容:',
            pageContent,
            '',
            '上記のページ内容を要約してください。'
        ].join('\n');

        const response = await this.client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                {
                    role: "system",
                    content: this.prompts.summarizeUrlSystem.replace('${url}', url),
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            max_tokens: 600,
            temperature: 0.5
        });
        
        return response.choices[0].message.content;
    }

    async createBasicURLSummary(url, japanTime) {
        const userMessage = [
            `現在の日本時間: ${this.formatJapanTime(japanTime)}`,
            '',
            `URL: ${url}`
        ].join('\n');

        const response = await this.client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                {
                    role: "system",
                    content: this.prompts.summarizeUrlFallbackSystem,
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            max_tokens: 300,
            temperature: 0.3
        });
        
        return response.choices[0].message.content;
    }

    async generateURLTopicName(urlSummary) {
        const response = await this.client.chat.completions.create({
            model: config.openaiModel,
            messages: [
                {
                    role: "system",
                    content: this.prompts.generateUrlTopicNameSystem,
                },
                {
                    role: "user",
                    content: urlSummary
                }
            ],
            max_tokens: 50,
            temperature: 0.3
        });
        
        return response.choices[0].message.content
            .replace(/[<>:"/\\|?*]/g, '')
            .trim();
    }

    formatJapanTime(japanTime) {
        return `${japanTime.getFullYear()}年${String(japanTime.getMonth() + 1).padStart(2, '0')}月${String(japanTime.getDate()).padStart(2, '0')}日${String(japanTime.getHours()).padStart(2, '0')}時${String(japanTime.getMinutes()).padStart(2, '0')}分`;
    }
}

module.exports = OpenAIService;