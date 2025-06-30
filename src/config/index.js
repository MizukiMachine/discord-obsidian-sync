require('dotenv').config();

class Config {
    constructor() {
        this.validateRequiredEnvVars();
    }

    // Discord設定
    get discordToken() {
        return process.env.DISCORD_TOKEN;
    }

    get discordChannelId() {
        return process.env.DISCORD_CHANNEL_ID;
    }

    // OpenAI設定
    get openaiApiKey() {
        return process.env.OPENAI_API_KEY;
    }

    get openaiModel() {
        return 'gpt-4o-mini';
    }

    // Google Drive設定
    get googleServiceAccountKey() {
        return process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    }

    get googleServiceAccountCredentials() {
        try {
            return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        } catch (error) {
            throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON format');
        }
    }

    get googleDriveFolderId() {
        return process.env.GOOGLE_DRIVE_FOLDER_ID;
    }

    get googleDriveUrlFolderId() {
        return process.env.GOOGLE_DRIVE_URL_FOLDER_ID;
    }

    // アプリケーション設定
    get processedMessagesLimit() {
        return 1000;
    }

    get maxContentLength() {
        return 3000;
    }

    get httpTimeout() {
        return 10000;
    }

    // 開発環境判定
    get isDevelopment() {
        return process.env.NODE_ENV === 'development';
    }

    get isProduction() {
        return process.env.NODE_ENV === 'production';
    }

    // 必須環境変数の検証
    validateRequiredEnvVars() {
        const required = [
            'DISCORD_TOKEN',
            'OPENAI_API_KEY',
            'GOOGLE_SERVICE_ACCOUNT_KEY',
            'GOOGLE_DRIVE_FOLDER_ID',
            'GOOGLE_DRIVE_URL_FOLDER_ID'
        ];

        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    // 設定状況のデバッグ出力
    logConfigStatus() {
        console.log('Configuration Status:');
        console.log(`- DISCORD_TOKEN: ${this.discordToken ? 'SET' : 'NOT SET'}`);
        console.log(`- DISCORD_CHANNEL_ID: ${this.discordChannelId ? 'SET' : 'NOT SET'}`);
        console.log(`- OPENAI_API_KEY: ${this.openaiApiKey ? 'SET' : 'NOT SET'}`);
        console.log(`- GOOGLE_DRIVE_FOLDER_ID: ${this.googleDriveFolderId ? 'SET' : 'NOT SET'}`);
        console.log(`- GOOGLE_DRIVE_URL_FOLDER_ID: ${this.googleDriveUrlFolderId ? 'SET' : 'NOT SET'}`);
        console.log(`- Environment: ${process.env.NODE_ENV || 'undefined'}`);
    }
}

module.exports = new Config();