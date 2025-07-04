require('dotenv').config();

class Config {
    constructor() {
        this.validateRequiredEnvVars();
    }

    get discordToken() {
        return process.env.DISCORD_TOKEN;
    }

    get discordChannelId() {
        return process.env.DISCORD_CHANNEL_ID;
    }

    get openaiApiKey() {
        return process.env.OPENAI_API_KEY;
    }

    get openaiModel() {
        return process.env.OPENAI_MODEL || 'gpt-4o-mini';
    }

    get googleServiceAccountKey() {
        return process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    }

    get googleServiceAccountCredentials() {
        // これだけパースするからハンドリング
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

    get processedMessagesLimit() {
        return 50; // 処理済みメッセージIDの記録上限。通信エラーとかで重複ならないように。
    }

    get maxContentLength() {
        return 3000;
    }

    get httpTimeout() {
        return 10000;
    }


    // 環境変数の存在チェック
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
        console.log(`- OPENAI_MODEL: ${this.openaiModel}`);
        console.log(`- GOOGLE_DRIVE_FOLDER_ID: ${this.googleDriveFolderId ? 'SET' : 'NOT SET'}`);
        console.log(`- GOOGLE_DRIVE_URL_FOLDER_ID: ${this.googleDriveUrlFolderId ? 'SET' : 'NOT SET'}`);
        console.log(`- Environment: ${process.env.NODE_ENV || 'undefined'}`);
    }
}

module.exports = new Config();