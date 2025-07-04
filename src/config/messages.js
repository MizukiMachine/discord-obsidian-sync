// Discord応答メッセージテンプレート
const MESSAGE_TEMPLATES = {
    // 通常メッセージ処理完了
    PROCESS_COMPLETE: {
        title: '**Bot処理完了！**',
        fields: {
            title: '**タイトル**',
            content: '**コンテンツ**',
            tags: '**タグ**',
            relatedNotes: '**関連メモ**',
            saved: '**保存完了**'
        },
        savedMessage: 'テキストmemoを `{filename}` として保存しました！（Obsidian連携フォルダ）'
    },

    // URL要約処理完了
    URL_COMPLETE: {
        title: '**URL要約完了！**',
        fields: {
            title: '**タイトル**',
            saved: '**保存完了**'
        },
        savedMessage: '`{filename}`'
    },

    // エラー用メッセージ
    ERRORS: {
        URL_PROCESSING: 'URL処理中にエラーが発生しました: {error}'
    }
};

class MessageFormatter {
    /**
     * 通常メッセージ処理完了の応答を生成
     */
    static formatProcessComplete(data) {
        const { title, content, tags, relatedNotes, filename } = data;
        const template = MESSAGE_TEMPLATES.PROCESS_COMPLETE;
        
        let parts = [
            template.title,
            '',
            `* ${template.fields.title}: ${title}`,
            `* ${template.fields.content}: ${content}`,
            `* ${template.fields.tags}: ${tags}`
        ];

        // 関連メモがある場合は追加
        if (relatedNotes && relatedNotes.length > 0) {
            const relatedTitles = relatedNotes.map(note => note.filename).join(', ');
            parts.push(`* ${template.fields.relatedNotes}: ${relatedTitles}`);
        }

        // 保存完了メッセージを追加
        const savedMessage = template.savedMessage.replace('{filename}', filename);
        parts.push(`* ${template.fields.saved}: ${savedMessage}`);

        return parts.join('\n');
    }

    /**
     * URL要約完了の応答を生成
     */
    static formatURLComplete(topicName, filename) {
        const template = MESSAGE_TEMPLATES.URL_COMPLETE;
        const savedMessage = template.savedMessage.replace('{filename}', filename);
        
        return [
            template.title,
            `* ${template.fields.title}: ${topicName}`,
            `* ${template.fields.saved}: ${savedMessage}`
        ].join('\n');
    }

    /**
     * エラーメッセージを生成
     */
    static formatError(type, error) {
        const template = MESSAGE_TEMPLATES.ERRORS[type];
        if (!template) {
            return `エラーが発生しました: ${error}`;
        }
        return template.replace('{error}', error);
    }
}

module.exports = {
    MESSAGE_TEMPLATES,
    MessageFormatter
};