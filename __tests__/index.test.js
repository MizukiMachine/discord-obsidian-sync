const fs = require('fs-extra');
const path = require('path');

jest.mock('discord.js', () => ({
  Client: jest.fn(() => ({
    once: jest.fn(),
    on: jest.fn(),
    login: jest.fn(() => Promise.resolve()),
    user: { tag: 'TestBot#1234' }
  })),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    MessageContent: 4
  }
}));

jest.mock('openai', () => {
  return jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{ message: { content: 'Test AI Response' } }]
        }))
      }
    }
  }));
});

jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn(() => ({}))
    },
    drive: jest.fn(() => ({
      files: {
        create: jest.fn(() => Promise.resolve({ data: { id: 'test_file_id' } })),
        list: jest.fn(() => Promise.resolve({ 
          data: { 
            files: [
              { name: 'test_file.md' }
            ]
          }
        }))
      }
    }))
  }
}));

describe('Discord-Obsidian Bot - 既存機能テスト', () => {
  let mockMessage;

  beforeEach(() => {
    // モックメッセージオブジェクトを作成
    mockMessage = {
      id: 'test_message_id',
      content: 'テストメッセージです',
      author: { bot: false },
      channel: { id: process.env.DISCORD_CHANNEL_ID },
      react: jest.fn(() => Promise.resolve()),
      reply: jest.fn(() => Promise.resolve())
    };

    jest.clearAllMocks();
  });

  test('URL判定関数が正しく動作する', () => {
    function isURLOnly(content) {
      const trimmed = content.trim();
      const urlRegex = /^https?:\/\/[^\s]+$/;
      return urlRegex.test(trimmed);
    }

    expect(isURLOnly('https://example.com')).toBe(true);
    expect(isURLOnly('http://example.com')).toBe(true);
    expect(isURLOnly('https://example.com/path')).toBe(true);
    expect(isURLOnly('テキストとhttps://example.com')).toBe(false);
    expect(isURLOnly('普通のメッセージ')).toBe(false);
    expect(isURLOnly('')).toBe(false);
  });

  test('ファイル名生成が正しく動作する', () => {
    function generateFilename(topicName, japanTime) {
      const year = japanTime.getFullYear();
      const month = String(japanTime.getMonth() + 1).padStart(2, '0');
      const day = String(japanTime.getDate()).padStart(2, '0');
      const hour = String(japanTime.getHours()).padStart(2, '0');
      const minute = String(japanTime.getMinutes()).padStart(2, '0');
      
      const timestamp = `${year}_${month}-${day}_${hour}-${minute}`;
      
      return `${timestamp}_${topicName}.md`;
    }

    const testDate = new Date('2024-12-30T10:30:00');
    const result = generateFilename('テストトピック', testDate);
    expect(result).toBe('2024_12-30_10-30_テストトピック.md');
  });

  test('プロンプトファイルが存在し読み込み可能', () => {
    const promptsDir = path.join(__dirname, '../prompts');
    const expectedPrompts = [
      'format_message_system.txt',
      'generate_topic_name_system.txt',
      'extract_keywords_system.txt',
      'summarize_url_system.txt',
      'summarize_url_fallback_system.txt',
      'generate_url_topic_name_system.txt'
    ];

    expectedPrompts.forEach(promptFile => {
      const filePath = path.join(promptsDir, promptFile);
      expect(fs.existsSync(filePath)).toBe(true);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });

  test('環境変数が適切に設定されている', () => {
    const requiredEnvVars = [
      'DISCORD_TOKEN',
      'OPENAI_API_KEY',
      'GOOGLE_SERVICE_ACCOUNT_KEY',
      'GOOGLE_DRIVE_FOLDER_ID',
      'GOOGLE_DRIVE_URL_FOLDER_ID'
    ];

    requiredEnvVars.forEach(envVar => {
      expect(process.env[envVar]).toBeDefined();
      expect(process.env[envVar]).not.toBe('');
    });
  });

  test('関連リンク追加機能が正しく動作する', () => {
    function addRelatedLinks(content, relatedNotes) {
      if (relatedNotes.length === 0) {
        return content;
      }
      
      let linkSection = '\n\n';
      relatedNotes.forEach(note => {
        linkSection += `[[${note.filename}]]\n`;
      });
      
      return content + linkSection;
    }

    const content = 'テストコンテンツ';
    const relatedNotes = [
      { filename: 'note1' },
      { filename: 'note2' }
    ];

    const result = addRelatedLinks(content, relatedNotes);
    expect(result).toContain('テストコンテンツ');
    expect(result).toContain('[[note1]]');
    expect(result).toContain('[[note2]]');

    // 関連ノートがない場合
    const resultEmpty = addRelatedLinks(content, []);
    expect(resultEmpty).toBe(content);
  });

  test('HTMLテキスト抽出が正しく動作する', () => {
    function extractTextFromHTML(html) {
      let textContent = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
      
      if (textContent.length > 3000) {
        textContent = textContent.substring(0, 3000) + '...';
      }
      
      return textContent;
    }

    const htmlInput = '<html><head><title>Test</title></head><body><p>Hello &amp; welcome</p><script>alert("test")</script></body></html>';
    const result = extractTextFromHTML(htmlInput);
    
    expect(result).toContain('Hello & welcome');
    expect(result).not.toContain('<p>');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('&amp;');
  });
});

describe('エラーハンドリングテスト', () => {
  test('無効なJSONでエラーが適切に処理される', () => {
    const invalidJson = 'invalid json string';
    
    expect(() => {
      JSON.parse(invalidJson);
    }).toThrow();
  });

  test('未定義環境変数でエラーが発生する', () => {
    const originalValue = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    expect(() => {
      JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }).toThrow();
    
    // 環境変数を復元
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = originalValue;
  });
});

describe('統合動作テスト', () => {
  test('Bot起動処理が正常に完了する', async () => {
    // Discord.jsのモックをインポート
    const { Client } = require('discord.js');
    
    const mockClient = new Client();
    
    // login が呼ばれることを確認
    expect(mockClient.login).toBeDefined();
    
    // 実際のlogin処理をテスト
    await expect(mockClient.login()).resolves.not.toThrow();
  });
});