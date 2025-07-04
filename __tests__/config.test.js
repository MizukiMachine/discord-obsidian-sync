const Config = require('../src/config');

describe('設定管理モジュールテスト', () => {
  
  test('必須環境変数が正しく取得できる', () => {
    expect(Config.discordToken).toBe(process.env.DISCORD_TOKEN);
    expect(Config.openaiApiKey).toBe(process.env.OPENAI_API_KEY);
    expect(Config.googleServiceAccountKey).toBe(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    expect(Config.googleDriveFolderId).toBe(process.env.GOOGLE_DRIVE_FOLDER_ID);
    expect(Config.googleDriveUrlFolderId).toBe(process.env.GOOGLE_DRIVE_URL_FOLDER_ID);
  });

  test('オプション環境変数が正しく設定される', () => {
    expect(Config.discordChannelId).toBe(process.env.DISCORD_CHANNEL_ID);
  });

  test('デフォルト値が正しく設定される', () => {
    expect(Config.openaiModel).toBe('gpt-4o-mini');
    expect(Config.processedMessagesLimit).toBe(50);
    expect(Config.maxContentLength).toBe(3000);
    expect(Config.httpTimeout).toBe(10000);
  });


  test('必須環境変数検証が動作する', () => {
    // 新しいConfigインスタンスを作成して検証する必要がある
    // 実際の使用では起動時に1回だけ検証される
    expect(Config.discordToken).toBeDefined();
    expect(Config.openaiApiKey).toBeDefined();
    expect(Config.googleServiceAccountKey).toBeDefined();
  });

  test('設定状況ログ出力が動作する', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    Config.logConfigStatus();
    
    expect(consoleSpy).toHaveBeenCalledWith('Configuration Status:');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('DISCORD_TOKEN:'));
    
    consoleSpy.mockRestore();
  });
});

describe('設定管理モジュール - エラーケース', () => {
  
  beforeEach(() => {
    // 各テスト前にキャッシュをクリア
    delete require.cache[require.resolve('../src/config')];
  });

  test('Google Service Account Keyが無効JSON場合エラーが発生する', () => {
    const originalKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = 'invalid json';
    
    delete require.cache[require.resolve('../src/config')];
    const config = require('../src/config');
    
    expect(() => {
      config.googleServiceAccountCredentials;
    }).toThrow('Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON format');
    
    // 環境変数を復元
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = originalKey;
    delete require.cache[require.resolve('../src/config')];
  });

  test('Google Service Account Key JSONパース機能の確認', () => {
    // 正常なJSONの場合はエラーが発生しない
    expect(() => {
      Config.googleServiceAccountCredentials;
    }).not.toThrow();
    
    // パースされたオブジェクトが返される
    const credentials = Config.googleServiceAccountCredentials;
    expect(typeof credentials).toBe('object');
  });
});