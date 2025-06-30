const https = require('https');
const http = require('http');
const config = require('../config');

class HttpService {
    static async fetchURLContent(url) {
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
                    timeout: config.httpTimeout
                };
                
                const req = client.request(options, (res) => {
                    let data = '';
                    
                    // リダイレクト処理
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        return HttpService.fetchURLContent(res.headers.location).then(resolve).catch(reject);
                    }
                    
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    }
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        try {
                            const textContent = HttpService.extractTextFromHTML(data);
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

    static extractTextFromHTML(html) {
        // HTMLから主要なテキスト内容を抽出
        let textContent = html
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
        
        // 長すぎる場合は制限
        if (textContent.length > config.maxContentLength) {
            textContent = textContent.substring(0, config.maxContentLength) + '...';
        }
        
        return textContent;
    }
}

module.exports = HttpService;