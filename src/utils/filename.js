class FilenameUtils {
    static generateFilename(topicName, japanTime) {
        const year = japanTime.getFullYear();
        const month = String(japanTime.getMonth() + 1).padStart(2, '0');
        const day = String(japanTime.getDate()).padStart(2, '0');
        const hour = String(japanTime.getHours()).padStart(2, '0');
        const minute = String(japanTime.getMinutes()).padStart(2, '0');
        
        const timestamp = `${year}_${month}-${day}_${hour}-${minute}`;
        
        return `${timestamp}_${topicName}.md`;
    }

    static addRelatedLinks(content, relatedNotes) {
        if (relatedNotes.length === 0) {
            return content;
        }
        
        let linkSection = '\n\n';
        relatedNotes.forEach(note => {
            linkSection += `[[${note.filename}]]\n`;
        });
        
        return content + linkSection;
    }

    static getJapanTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    }
}

module.exports = FilenameUtils;