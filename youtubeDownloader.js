import fs from 'fs';
import path from 'path';
import ytdl from '@distube/ytdl-core';

async function downloadYouTubeVideo(url, outputPath = null) {
  try {
    if (!ytdl.validateURL(url)) {
      throw new Error('Invalid YouTube URL');
    }

    console.log('Validating URL and getting video info...');
    
    // Get video info first
    const info = await ytdl.getInfo(url);
    console.log(`Video title: ${info.videoDetails.title}`);
    console.log(`Duration: ${info.videoDetails.lengthSeconds} seconds`);

    // Generate filename from video title if not provided
    if (!outputPath) {
      const safeTitle = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      outputPath = path.join('./videos', `${safeTitle}.mp4`);
    }

    // Ensure videos directory exists
    const videosDir = path.dirname(outputPath);
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Download with better options
    const stream = ytdl(url, {
      quality: 'highest',
      filter: 'audioandvideo',
    });

    const writeStream = fs.createWriteStream(outputPath);
    
    stream.pipe(writeStream);

    return new Promise((resolve, reject) => {
      let progressInterval;
      
      stream.on('progress', (chunkLength, downloaded, total) => {
        const percent = downloaded / total * 100;
        console.log(`Downloaded: ${percent.toFixed(2)}%`);
      });

      writeStream.on('finish', () => {
        console.log(`Download completed: ${outputPath}`);
        clearInterval(progressInterval);
        resolve({
          success: true,
          filePath: outputPath,
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds
        });
      });

      writeStream.on('error', (error) => {
        console.error('Write stream error:', error);
        clearInterval(progressInterval);
        reject(error);
      });

      stream.on('error', (error) => {
        console.error('Download error:', error.message);
        clearInterval(progressInterval);
        reject(error);
      });
    });

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

export { downloadYouTubeVideo }; 