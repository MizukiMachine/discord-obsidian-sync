// テスト環境のセットアップ

// 環境変数のモック設定
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test_discord_token';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.DISCORD_CHANNEL_ID = 'test_channel_id';
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: "service_account",
  project_id: "test_project",
  private_key_id: "test_key_id",
  private_key: "-----BEGIN PRIVATE KEY-----\ntest_private_key\n-----END PRIVATE KEY-----\n",
  client_email: "test@test.iam.gserviceaccount.com",
  client_id: "test_client_id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token"
});
process.env.GOOGLE_DRIVE_FOLDER_ID = 'test_folder_id';
process.env.GOOGLE_DRIVE_URL_FOLDER_ID = 'test_url_folder_id';

// コンソールログを制御（テスト実行時のノイズを減らす）
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};