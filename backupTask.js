// backupTask.js
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Configuration paths
const SOURCE_FILE = path.join(process.cwd(), 'data', 'all_locked_k9s.json');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

// Function to perform the backup
const performBackup = () => {
    try {
        // Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }

        if (fs.existsSync(SOURCE_FILE)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const destPath = path.join(BACKUP_DIR, `all_locked_k9s_backup_${timestamp}.json`);
            
            fs.copyFileSync(SOURCE_FILE, destPath);
            console.log(`[${new Date().toLocaleString()}] Backup successful: ${destPath}`);
        } else {
            console.warn(`[${new Date().toLocaleString()}] Source file not found, skipping backup.`);
        }
    } catch (error) {
        console.error(`[${new Date().toLocaleString()}] Backup failed:`, error);
    }
};

// Schedule the task to run every day at midnight (00:00)
// Syntax: 'minute hour day-of-month month day-of-week'
cron.schedule('0 0 * * *', () => {
    console.log('Running scheduled daily backup...');
    performBackup();
});

console.log('Backup scheduler initialized and running in background...');