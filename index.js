require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs-extra');
const path = require('path');
const { google } = require('googleapis');
const https = require('https');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});


// Google Drive API設定
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

// 環境変数は関数内で直接取得するように変更（Railway.appの遅延注入対応）
const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// 処理済みメッセージIDを管理するSet
const processedMessages = new Set();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log(`DEBUG: Environment variables check:`);
    console.log(`- GOOGLE_DRIVE_FOLDER_ID: ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'SET' : 'NOT SET'}`);
    console.log(`- GOOGLE_DRIVE_URL_FOLDER_ID: ${process.env.GOOGLE_DRIVE_URL_FOLDER_ID ? 'SET' : 'NOT SET'}`);
    console.log(`- DISCORD_CHANNEL_ID: ${process.env.DISCORD_CHANNEL_ID ? 'SET' : 'NOT SET'}`);
});

// URL判定関数
function isURLOnly(content) {
    const trimmed = content.trim();
    const urlRegex = /^https?:\/\/[^\s]+$/;
    return urlRegex.test(trimmed);
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (TARGET_CHANNEL_ID && message.channel.id !== TARGET_CHANNEL_ID) return;
    
    // 重複処理防止 - メッセージIDで管理
    if (processedMessages.has(message.id)) {
        console.log(`Already processed message: ${message.id}`);
        return;
    }
    processedMessages.add(message.id);
    
    // Setのサイズを制限（メモリリーク防止）
    if (processedMessages.size > 1000) {
        const firstEntry = processedMessages.values().next().value;
        processedMessages.delete(firstEntry);
    }
    
    try {
        console.log(`Processing message: ${message.content.substring(0, 100)}...`);
        
        // 日本時間を先に生成
        const japanTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
        
        // URLのみの投稿かチェック
        if (isURLOnly(message.content)) {
            console.log('Detected URL-only message, processing as URL summary...');
            await processURLMessage(message, japanTime);
        } else {
            // 通常のメッセージ処理
            await processNormalMessage(message, japanTime);
        }
    } catch (error) {
        console.error('Error processing message:', error);
        await message.react('❌');
        // エラー時はSetからIDを削除（再試行可能にする）
        processedMessages.delete(message.id);
    }
});

// 通常メッセージ処理
async function processNormalMessage(message, japanTime) {
    // まずトピック名を生成
    const topicName = await generateTopicName(message.content);
    // ファイル名を生成
    const filename = generateFilename(topicName, japanTime);
    // フォーマット済みコンテンツを生成（トピック名とタイムスタンプを渡す）
    const formattedContent = await formatMessageWithAI(message.content, japanTime, topicName);
    const relatedNotes = await findRelatedNotes(formattedContent);
    const finalContent = addRelatedLinks(formattedContent, relatedNotes);
    
    await saveToGoogleDrive(finalContent, filename);
    
    // 詳細な応答メッセージを送信
    const responseMessage = createResponseMessage(formattedContent, filename, relatedNotes);
    await message.reply(responseMessage);
    
    await message.react('✅');
    console.log(`Saved note: ${filename}`);
}

// URL メッセージ処理
async function processURLMessage(message, japanTime) {
    const url = message.content.trim();
    console.log(`DEBUG: Processing URL message: ${url}`);
    
    try {
        console.log(`DEBUG: Step 1 - Summarizing URL...`);
        // URL先のページ内容を取得・要約
        const urlSummary = await summarizeURL(url, japanTime);
        console.log(`DEBUG: Step 2 - URL summary generated (length: ${urlSummary.length})`);
        
        console.log(`DEBUG: Step 3 - Generating topic name...`);
        const topicName = await generateURLTopicName(urlSummary);
        console.log(`DEBUG: Step 4 - Topic name generated: ${topicName}`);
        
        console.log(`DEBUG: Step 5 - Generating filename...`);
        const filename = generateFilename(topicName, japanTime);
        console.log(`DEBUG: Step 6 - Filename generated: ${filename}`);
        
        console.log(`DEBUG: Step 7 - Saving to Google Drive...`);
        await saveURLToGoogleDrive(urlSummary, filename);
        console.log(`DEBUG: Step 8 - File saved successfully`);
        
        await message.reply(`**URL要約完了！**\n* **タイトル**: ${topicName}\n* **保存完了**: \`${filename}\``);
        await message.react('🔗');
        console.log(`✅ Saved URL summary: ${filename}`);
    } catch (error) {
        console.error('❌ Error processing URL:', error);
        console.error('❌ Error stack:', error.stack);
        await message.reply(`URL処理中にエラーが発生しました: ${error.message}`);
        throw error;
    }
}

async function formatMessageWithAI(content, japanTime, topicName) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `あなたはDiscordメッセージを整理して構造化されたObsidianメモに変換するアシスタントです。

整理・整形することが目的です。

以下の形式で厳密にメモを作成してください：

1. タイトル（# で始める、トピック名のみ使用）
2. 空行
3. 作成日時（現在の日本時間を正確に記載）
4. 空行
5. 本文（箇条書き形式、自然な日本語、元の情報をすべて保持）
6. 空行
7. タグ（#タグ1 #タグ2 #タグ3 #タグ4 の形式で4つ前後）

本文の作成ルール：
- 箇条書きに変換
- 情報の削除や省略はあまり行わない
- 自然な日本語に整形（体言止めを積極活用）
- 機械的な「である」付与は避け、読みやすさを重視
- 文脈に応じて「だ・である調」を自然に使用
- 誤字脱字の修正は行う
- 明らかな重複表現は削除
- 文章の意味や詳細をできるだけ保持

サンプル形式：
# トピック名

YYYY年MM月DD日HH時MM分作成

- [自然な日本語での内容1]
- [自然な日本語での内容2]
- [自然な日本語での内容3]
- [自然な日本語での内容4]
- [自然な日本語での内容5]
- [自然な日本語での内容6]
- [自然な日本語での内容7]

#タグ1 #タグ2 #タグ3 #タグ4`
            },
            {
                role: "user",
                content: `現在の日本時間: ${japanTime.getFullYear()}年${String(japanTime.getMonth() + 1).padStart(2, '0')}月${String(japanTime.getDate()).padStart(2, '0')}日${String(japanTime.getHours()).padStart(2, '0')}時${String(japanTime.getMinutes()).padStart(2, '0')}分
トピック名: ${topicName}
                
投稿内容: ${content}`
            }
        ],
        max_tokens: 800,
        temperature: 0.7
    });
    
    return response.choices[0].message.content;
}

async function generateTopicName(content) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "以下の内容から簡潔で分かりやすいトピック名を生成してください。日本語で25文字以内にしてください。ファイル名に使えない文字（<>:\"/\\|?*）は使わないでください。"
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

function generateFilename(topicName, japanTime) {
    // 渡された日本時間を使用
    const year = japanTime.getFullYear();
    const month = String(japanTime.getMonth() + 1).padStart(2, '0');
    const day = String(japanTime.getDate()).padStart(2, '0');
    const hour = String(japanTime.getHours()).padStart(2, '0');
    const minute = String(japanTime.getMinutes()).padStart(2, '0');
    
    const timestamp = `${year}_${month}-${day}_${hour}-${minute}`;
    
    return `${timestamp}_${topicName}.md`;
}

// 全ファイル取得関数（ページネーション対応）
async function getAllFiles() {
    try {
        let allFiles = [];
        let pageToken = null;
        let pageCount = 0;
        
        do {
            pageCount++;
            console.log(`Fetching page ${pageCount} of files...`);
            
            const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
            if (!FOLDER_ID) {
                throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set in environment variables');
            }
            
            const response = await drive.files.list({
                q: `'${FOLDER_ID}' in parents and name contains '.md'`,
                orderBy: 'name desc',
                pageSize: 1000,
                pageToken: pageToken
            });
            
            const pageFiles = response.data.files || [];
            allFiles.push(...pageFiles);
            pageToken = response.data.nextPageToken;
            
            console.log(`Page ${pageCount}: ${pageFiles.length} files, Total: ${allFiles.length}`);
            
        } while (pageToken);
        
        console.log(`Retrieved ${allFiles.length} total files in ${pageCount} pages`);
        return allFiles;
        
    } catch (error) {
        console.error('Error fetching all files:', error);
        return [];
    }
}

// キーワード抽出関数
async function extractKeywords(content) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "以下のテキストから重要なキーワードを5-8個抽出してください。カンマ区切りで出力してください。検索に使いやすい単語を優先してください。"
                },
                {
                    role: "user",
                    content: content.substring(0, 1000) // 最初の1000文字
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

// キーワードベース関連性検索
async function findRelatedNotes(content) {
    try {
        // 1. 新メモからキーワード抽出
        const keywords = await extractKeywords(content);
        if (keywords.length === 0) return [];
        
        console.log('Extracted keywords:', keywords);
        
        // 2. 既存ファイル一覧を取得（全ファイル、ページネーション対応）
        const files = await getAllFiles();
        
        console.log(`Checking ${files.length} existing files for keyword matches`);
        const relatedNotes = [];
        
        // 3. ファイル名とメタデータでキーワードマッチング
        for (const file of files) {
            let matchCount = 0;
            const fileName = file.name.toLowerCase();
            
            // ファイル名でキーワードマッチング
            for (const keyword of keywords) {
                if (fileName.includes(keyword.toLowerCase())) {
                    matchCount++;
                }
            }
            
            // マッチしたキーワードがあれば関連メモとして追加
            if (matchCount > 0) {
                const similarity = matchCount / keywords.length; // 単純な類似度計算
                relatedNotes.push({
                    filename: file.name.replace('.md', ''),
                    similarity: similarity,
                    matchedKeywords: matchCount
                });
            }
        }
        
        // 4. 類似度でソートして上位3件を返す
        return relatedNotes
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3);
            
    } catch (error) {
        console.error('Error finding related notes:', error);
        return [];
    }
}

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

async function saveToGoogleDrive(content, filename) {
    try {
        // Railway.app対応: 環境変数を関数内で直接取得
        const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
        
        if (!FOLDER_ID) {
            throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set in environment variables');
        }
        
        const fileMetadata = {
            name: filename,
            parents: [FOLDER_ID],
        };
        
        const media = {
            mimeType: 'text/markdown',
            body: content,
        };
        
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
        });
        
        console.log(`File saved to Google Drive: ${filename} (ID: ${response.data.id})`);
    } catch (error) {
        console.error('Error saving to Google Drive:', error);
        throw error;
    }
}

function createResponseMessage(formattedContent, filename, relatedNotes) {
    console.log('DEBUG - formattedContent:', formattedContent); // デバッグ用
    
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
            title = line.substring(2); // "# " を除去
            isContentSection = false;
        } else if (line.includes('年') && line.includes('月') && line.includes('日') && line.includes('作成')) {
            // 日付行の後からコンテンツ開始
            isContentSection = true;
            continue;
        } else if (line.startsWith('#') && line.includes(' #')) {
            // タグ行
            tags = line;
            isContentSection = false;
        } else if (line.startsWith('[[') && line.endsWith(']]')) {
            // 関連リンク行、コンテンツ終了
            isContentSection = false;
        } else if (isContentSection && line.length > 0) {
            // コンテンツ行（箇条書きを含む）
            contentLines.push(line);
        }
    }
    
    // コンテンツを結合（箇条書き形式を保持、情報を削らない）
    if (contentLines.length > 0) {
        // 箇条書きの場合は改行を保持、全ての項目を表示
        if (contentLines[0].startsWith('-')) {
            content = contentLines.join('\n'); // 全ての箇条書き項目を表示
        } else {
            content = contentLines.join(' '); // 通常の文章は全て表示
        }
        
        // Discord表示用に長すぎる場合のみ制限
        if (content.length > 300) {
            if (contentLines[0].startsWith('-')) {
                // 箇条書きの場合は最初の7項目まで表示
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

// URL内容取得関数
async function fetchURLContent(url) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                timeout: 10000
            };
            
            const req = client.request(options, (res) => {
                let data = '';
                
                // リダイレクト処理
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchURLContent(res.headers.location).then(resolve).catch(reject);
                }
                
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        // HTMLから主要なテキスト内容を抽出
                        let textContent = data
                            // HTMLタグを除去
                            .replace(/<script[^>]*>.*?<\/script>/gis, '')
                            .replace(/<style[^>]*>.*?<\/style>/gis, '')
                            .replace(/<[^>]*>/g, ' ')
                            // HTML エンティティをデコード
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            // 余分な空白を整理
                            .replace(/\s+/g, ' ')
                            .trim();
                        
                        // 長すぎる場合は最初の3000文字に制限
                        if (textContent.length > 3000) {
                            textContent = textContent.substring(0, 3000) + '...';
                        }
                        
                        resolve(textContent);
                    } catch (parseError) {
                        reject(parseError);
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

// URL要約機能 - WebFetch機能を実際に使用
async function summarizeURL(url, japanTime) {
    try {
        console.log(`DEBUG: Attempting to fetch URL content: ${url}`);
        
        // WebFetch toolを使ってURL内容を取得
        const pageContent = await fetchURLContent(url);
        console.log(`DEBUG: Page content fetched, length: ${pageContent.length}`);
        
        // 取得した内容を要約
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `あなたはWebページの内容を要約するアシスタントです。提供されたページ内容を以下の形式で要約してください：

以下の形式で厳密にメモを作成してください：

1. タイトル（# で始める、ページの概要）
2. 空行
3. 作成日時（現在の日本時間を正確に記載）
4. 空行
5. 要約内容（箇条書き形式、簡潔で分かりやすく）
6. 空行
7. URL（元のURL）
8. 空行
9. タグ（#タグ1 #タグ2 #タグ3 の形式で3つ前後、内容に基づいて生成）

要約ルール：
- ページの主要な内容を3-5行の箇条書きで要約
- 重要なポイントを漏らさず簡潔に
- 読みやすい自然な日本語で記述

サンプル形式：
# ページの概要タイトル

YYYY年MM月DD日HH時MM分作成

- ページの主要内容1
- ページの主要内容2
- ページの主要内容3

URL: ${url}

#タグ1 #タグ2 #タグ3`
                },
                {
                    role: "user",
                    content: `現在の日本時間: ${japanTime.getFullYear()}年${String(japanTime.getMonth() + 1).padStart(2, '0')}月${String(japanTime.getDate()).padStart(2, '0')}日${String(japanTime.getHours()).padStart(2, '0')}時${String(japanTime.getMinutes()).padStart(2, '0')}分

URL: ${url}

ページ内容:
${pageContent}

上記のページ内容を要約してください。`
                }
            ],
            max_tokens: 600,
            temperature: 0.5
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error summarizing URL:', error);
        console.log('DEBUG: Falling back to basic URL summary');
        // フォールバック：URL取得失敗時に基本的な要約を生成
        return await createBasicURLSummary(url, japanTime);
    }
}

// WebFetch失敗時のフォールバック
async function createBasicURLSummary(url, japanTime) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `URLから推測して基本的な要約を作成してください。実際のページ内容は取得できませんが、URLから分かる情報で簡潔な要約を作成してください。

形式：
# URL先ページ

YYYY年MM月DD日HH時MM分作成

- URLから推測される内容

URL: [元URL]

#URL #ウェブ #保存`
            },
            {
                role: "user",
                content: `現在の日本時間: ${japanTime.getFullYear()}年${String(japanTime.getMonth() + 1).padStart(2, '0')}月${String(japanTime.getDate()).padStart(2, '0')}日${String(japanTime.getHours()).padStart(2, '0')}時${String(japanTime.getMinutes()).padStart(2, '0')}分

URL: ${url}`
            }
        ],
        max_tokens: 300,
        temperature: 0.3
    });
    
    return response.choices[0].message.content;
}

// URL用トピック名生成
async function generateURLTopicName(urlSummary) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "以下のURL要約内容から簡潔で分かりやすいトピック名を生成してください。日本語で25文字以内にしてください。ファイル名に使えない文字（<>:\"/\\|?*）は使わないでください。"
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

// URL用Google Drive保存
async function saveURLToGoogleDrive(content, filename) {
    try {
        // Railway.app対応: 環境変数を関数内で直接取得
        const URL_FOLDER_ID = process.env.GOOGLE_DRIVE_URL_FOLDER_ID;
        
        console.log(`DEBUG: Saving URL file to folder ID: ${URL_FOLDER_ID}`);
        console.log(`DEBUG: Filename: ${filename}`);
        console.log(`DEBUG: Content length: ${content.length}`);
        
        if (!URL_FOLDER_ID) {
            throw new Error('GOOGLE_DRIVE_URL_FOLDER_ID is not set in environment variables');
        }
        
        const fileMetadata = {
            name: filename,
            parents: [URL_FOLDER_ID],
        };
        
        const media = {
            mimeType: 'text/markdown',
            body: content,
        };
        
        console.log(`DEBUG: Calling Google Drive API to create file...`);
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
        });
        
        console.log(`✅ URL file saved to Google Drive: ${filename} (ID: ${response.data.id})`);
    } catch (error) {
        console.error('❌ Error saving URL to Google Drive:', error);
        console.error('Error details:', error.message);
        throw error;
    }
}

client.login(process.env.DISCORD_TOKEN);