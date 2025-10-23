const fs = require('fs');
const path = require('path');
const https = require('https');

const modelDir = path.join(__dirname, '../models');
const baseUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

const models = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

// Create models directory if it doesn't exist
if (!fs.existsSync(modelDir)) {
  fs.mkdirSync(modelDir, { recursive: true });
  console.log('📁 Created models directory');
}

// Download function
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Download all models
async function downloadModels() {
  console.log('📥 Downloading face-api.js models...\n');
  
  for (const modelFile of models) {
    const url = `${baseUrl}/${modelFile}`;
    const dest = path.join(modelDir, modelFile);
    
    // Skip if already exists
    if (fs.existsSync(dest)) {
      console.log(`✅ ${modelFile} (already exists)`);
      continue;
    }
    
    try {
      process.stdout.write(`⏳ Downloading ${modelFile}...`);
      await downloadFile(url, dest);
      console.log(' ✅ Done');
    } catch (error) {
      console.log(` ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n✅ All models downloaded successfully!');
  console.log('📂 Models location:', modelDir);
}

downloadModels().catch(console.error);
