require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const OpenAI = require('openai');
const fs = require('fs-extra');
const path = require('path');
const { Octokit } = require('@octokit/rest');

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

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

const TARGET_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const OBSIDIAN_FOLDER = '04_fromdicord_memo';

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (TARGET_CHANNEL_ID && message.channel.id !== TARGET_CHANNEL_ID) return;
    if (message.content.length < 50) return;
    
    try {
        console.log(`Processing message: ${message.content.substring(0, 100)}...`);
        
        const formattedContent = await formatMessageWithAI(message.content);
        const filename = await generateFilename(formattedContent);
        const relatedNotes = await findRelatedNotes(formattedContent);
        const finalContent = addRelatedLinks(formattedContent, relatedNotes);
        
        await saveToGitHub(finalContent, filename);
        
        await message.react('✅');
        console.log(`Saved note: ${filename}`);
    } catch (error) {
        console.error('Error processing message:', error);
        await message.react('❌');
    }
});

async function formatMessageWithAI(content) {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "system",
                content: `あなたはDiscordメッセージを整理して構造化されたObsidianメモに変換するアシスタントです。

以下の形式で厳密にメモを作成してください：

1. タイトル（# で始める、ファイル名と同じ形式）
2. 空行
3. 作成日時（YYYY年MM月DD日HH時MM分作成）
4. 空行
5. 本文（要約された内容、1段落、200-300文字程度）
6. 空行
7. タグ（#タグ1 #タグ2 #タグ3 #タグ4 の形式で4つ前後）

サンプル形式：
# YYYYMMDD_HHMMSS_トピック名

YYYY年MM月DD日HH時MM分作成

[要約された本文内容をここに記載...]

#タグ1 #タグ2 #タグ3 #タグ4`
            },
            {
                role: "user",
                content: content
            }
        ],
        max_tokens: 800,
        temperature: 0.7
    });
    
    return response.choices[0].message.content;
}

async function generateFilename(content) {
    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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
    
    const topic = response.choices[0].message.content
        .replace(/[<>:"/\\|?*]/g, '')
        .trim();
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}_${hour}${minute}${second}`;
    
    return `${timestamp}_${topic}.md`;
}

async function findRelatedNotes(content) {
    try {
        const { data: files } = await octokit.rest.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: OBSIDIAN_FOLDER,
        });
        
        const relatedNotes = [];
        const recentFiles = files
            .filter(file => file.name.endsWith('.md'))
            .sort((a, b) => b.name.localeCompare(a.name))
            .slice(0, 10);
        
        for (const file of recentFiles) {
            try {
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner: GITHUB_OWNER,
                    repo: GITHUB_REPO,
                    path: file.path,
                });
                
                const fileContent = Buffer.from(fileData.content, 'base64').toString('utf8');
                const similarity = await checkSimilarity(content, fileContent);
                
                if (similarity > 0.3) {
                    relatedNotes.push({
                        filename: file.name.replace('.md', ''),
                        similarity: similarity
                    });
                }
            } catch (error) {
                console.log(`Could not read file ${file.name}:`, error.message);
            }
        }
        
        return relatedNotes.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
    } catch (error) {
        console.log('No existing files found or error accessing repository:', error.message);
        return [];
    }
}

async function checkSimilarity(content1, content2) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "以下の2つのテキストの内容的関連性を0.0から1.0の数値で評価してください。数値のみを返してください。"
                },
                {
                    role: "user",
                    content: `テキスト1: ${content1.substring(0, 500)}\n\nテキスト2: ${content2.substring(0, 500)}`
                }
            ],
            max_tokens: 10,
            temperature: 0.1
        });
        
        const similarity = parseFloat(response.choices[0].message.content.trim());
        return isNaN(similarity) ? 0 : similarity;
    } catch (error) {
        console.error('Error checking similarity:', error);
        return 0;
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

async function saveToGitHub(content, filename) {
    const filePath = `${OBSIDIAN_FOLDER}/${filename}`;
    
    try {
        await octokit.rest.repos.createOrUpdateFileContents({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: filePath,
            message: `Add Discord memo: ${filename}`,
            content: Buffer.from(content, 'utf8').toString('base64'),
        });
        
        console.log(`File saved to GitHub: ${filePath}`);
    } catch (error) {
        console.error('Error saving to GitHub:', error);
        throw error;
    }
}

client.login(process.env.DISCORD_TOKEN);