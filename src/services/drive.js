const { google } = require('googleapis');
const config = require('../config');

class DriveService {
    constructor() {
        this.auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(config.googleServiceAccountKey),
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });
        
        this.drive = google.drive({ version: 'v3', auth: this.auth });
    }

    async saveToGoogleDrive(content, filename, isUrl = false) {
        try {
            const folderId = isUrl ? config.googleDriveUrlFolderId : config.googleDriveFolderId;
            
            if (!folderId) {
                const folderType = isUrl ? 'GOOGLE_DRIVE_URL_FOLDER_ID' : 'GOOGLE_DRIVE_FOLDER_ID';
                throw new Error(`${folderType} is not set in environment variables`);
            }
            
            const fileMetadata = {
                name: filename,
                parents: [folderId],
            };
            
            const media = {
                mimeType: 'text/markdown',
                body: content,
            };
            
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
            });
            
            console.log(`File saved to Google Drive: ${filename} (ID: ${response.data.id})`);
            return response.data;
        } catch (error) {
            console.error('Error saving to Google Drive:', error);
            throw error;
        }
    }

    async getAllFiles() {
        try {
            let allFiles = [];
            let pageToken = null;
            let pageCount = 0;
            
            do {
                pageCount++;
                console.log(`Fetching page ${pageCount} of files...`);
                
                const folderId = config.googleDriveFolderId;
                if (!folderId) {
                    throw new Error('GOOGLE_DRIVE_FOLDER_ID is not set in environment variables');
                }
                
                const response = await this.drive.files.list({
                    q: `'${folderId}' in parents and name contains '.md'`,
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

    async findRelatedNotes(content, extractKeywords) {
        try {
            // 1. 新メモからキーワード抽出
            const keywords = await extractKeywords(content);
            if (keywords.length === 0) return [];
            
            console.log('Extracted keywords:', keywords);
            
            // 2. 既存ファイル一覧を取得
            const files = await this.getAllFiles();
            
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
                    const similarity = matchCount / keywords.length;
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
}

module.exports = DriveService;