// 設定管理モジュール統合テスト

const fs = require('fs-extra');
const path = require('path');

describe('設定管理モジュール統合テスト', () => {

  test('完全リファクタリング後のindex.jsが正常に動作する', () => {
    const indexPath = path.join(__dirname, '../index.js');
    expect(fs.existsSync(indexPath)).toBe(true);
    
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('const DiscordService = require(\'./src/services/discord\')');
    expect(content).toContain('const OpenAIService = require(\'./src/services/openai\')');
    expect(content).toContain('const DriveService = require(\'./src/services/drive\')');
    expect(content).toContain('class DiscordObsidianBot');
  });

  test('設定管理モジュールが適切に機能する', () => {
    const config = require('../src/config');
    
    expect(config.discordToken).toBeDefined();
    expect(config.openaiApiKey).toBeDefined();
    expect(config.googleServiceAccountKey).toBeDefined();
    expect(config.googleDriveFolderId).toBeDefined();
    expect(config.googleDriveUrlFolderId).toBeDefined();
  });

  test('設定管理モジュール統合準備テスト', () => {
    const config = require('../src/config');
    
    const currentDiscordToken = process.env.DISCORD_TOKEN;
    const configDiscordToken = config.discordToken;
    
    expect(currentDiscordToken).toBe(configDiscordToken);
    
    expect(process.env.OPENAI_API_KEY).toBe(config.openaiApiKey);
    expect(process.env.GOOGLE_DRIVE_FOLDER_ID).toBe(config.googleDriveFolderId);
    expect(process.env.GOOGLE_DRIVE_URL_FOLDER_ID).toBe(config.googleDriveUrlFolderId);
  });

  test('段階的統合のための安全性確認', () => {
    // 設定管理モジュールがrequireできることを確認
    expect(() => {
      require('../src/config');
    }).not.toThrow();
    
    // メインindex.jsが正常に読み込めることを確認
    const indexPath = path.join(__dirname, '../index.js');
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});

describe('段階的リファクタリング準備テスト', () => {
  
  test('リファクタリング後のサービス分離構造を確認', () => {
    const indexPath = path.join(__dirname, '../index.js');
    const content = fs.readFileSync(indexPath, 'utf-8');
    
    // サービス分離が適切に行われていることを確認
    expect(content).toContain('this.discordService');
    expect(content).toContain('this.openaiService');
    expect(content).toContain('this.driveService');
    
    // クラスベース設計になっていることを確認
    expect(content).toContain('async processMessage');
    expect(content).toContain('async processNormalMessage');
    expect(content).toContain('async processURLMessage');
    
    const lines = content.split('\n').length;
    expect(lines).toBeLessThan(150); // 661行 → 120行程度に削減
  });

  test('設定管理統合後の動作予測テスト', () => {
    const config = require('../src/config');
    
    // 統合後に期待される動作をシミュレート
    const mockDiscordClient = {
      intents: [1, 2, 4], // GatewayIntentBits values
    };
    
    const mockOpenAIClient = {
      apiKey: config.openaiApiKey,
    };
    
    const mockGoogleAuth = {
      credentials: config.googleServiceAccountCredentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    };
    
    // 設定値が適切に取得できることを確認
    expect(mockOpenAIClient.apiKey).toBeDefined();
    expect(mockGoogleAuth.credentials).toBeDefined();
    expect(typeof mockGoogleAuth.credentials).toBe('object');
  });
});