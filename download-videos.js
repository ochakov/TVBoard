#!/usr/bin/env node

/**
 * Script to download video files from external URLs to local files/videos/ directory
 * This solves the CORS issue by hosting videos locally
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Video URLs from config.js
const videoUrls = [
    'https://devisrael.z39.web.core.windows.net/files/mp4/CalmHeb1.mp4',
    'https://devisrael.z39.web.core.windows.net/files/mp4/Shlomo1.mp4',
    'https://devisrael.z39.web.core.windows.net/files/mp4/Arik1.mp4',
    'https://devisrael.z39.web.core.windows.net/files/mp4/Golan1.mp4',
    'https://devisrael.z39.web.core.windows.net/files/mp4/LoveHeb1.mp4',
    'https://devisrael.z39.web.core.windows.net/files/mp4/LoveHeb2.mp4'
];

// Create videos directory if it doesn't exist
const videosDir = path.join(__dirname, 'files', 'videos');
if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
    console.log('Created videos directory:', videosDir);
}

/**
 * Download a file from URL to local path
 */
function downloadFile(url, localPath) {
    return new Promise((resolve, reject) => {
        const fileName = path.basename(localPath);
        
        // Check if file already exists
        if (fs.existsSync(localPath)) {
            console.log(`✅ ${fileName} already exists, skipping...`);
            resolve();
            return;
        }
        
        console.log(`📥 Downloading ${fileName}...`);
        
        const file = fs.createWriteStream(localPath);
        
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize) {
                    const percent = Math.round((downloadedSize / totalSize) * 100);
                    process.stdout.write(`\r   Progress: ${percent}% (${Math.round(downloadedSize / 1024 / 1024)}MB)`);
                }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log(`\n✅ ${fileName} downloaded successfully!`);
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(localPath, () => {}); // Delete partial file
                reject(err);
            });
            
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Download all videos
 */
async function downloadAllVideos() {
    console.log('🎥 Starting video download...\n');
    
    for (const url of videoUrls) {
        const fileName = path.basename(url);
        const localPath = path.join(videosDir, fileName);
        
        try {
            await downloadFile(url, localPath);
        } catch (error) {
            console.error(`❌ Failed to download ${fileName}:`, error.message);
        }
    }
    
    console.log('\n🎉 Video download process completed!');
    console.log('\nNext steps:');
    console.log('1. Update config.js to use local video paths');
    console.log('2. Deploy to Firebase: firebase deploy');
    console.log('3. Test video caching on the live site');
}

/**
 * Update config.js to use local video paths
 */
function updateConfig() {
    const configPath = path.join(__dirname, 'config.js');
    
    if (!fs.existsSync(configPath)) {
        console.log('❌ config.js not found');
        return;
    }
    
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Replace external URLs with local paths
    const localUrls = videoUrls.map(url => `'files/videos/${path.basename(url)}'`);
    
    // Find and replace the videoUrls array
    const videoUrlsRegex = /videoUrls:\s*\[([\s\S]*?)\]/;
    const newVideoUrls = `videoUrls: [\n                    ${localUrls.join(',\n                    ')}\n                ]`;
    
    if (videoUrlsRegex.test(configContent)) {
        configContent = configContent.replace(videoUrlsRegex, newVideoUrls);
        fs.writeFileSync(configPath, configContent);
        console.log('✅ Updated config.js with local video paths');
    } else {
        console.log('❌ Could not find videoUrls in config.js');
    }
}

// Main execution
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--update-config')) {
        updateConfig();
    } else {
        downloadAllVideos().then(() => {
            console.log('\n📝 To update config.js automatically, run:');
            console.log('node download-videos.js --update-config');
        });
    }
}

module.exports = { downloadAllVideos, updateConfig };
