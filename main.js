import readline from 'readline';
import { downloadYouTubeVideo } from './youtubeDownloader.js';
import { analyzeVideoForApproval, processAllVideos } from './gemini.js';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function analyzeSingleVideo(videoPath) {
  try {
    console.log(`\n--- Analyzing single video: ${videoPath} ---`);
    const result = await analyzeVideoForApproval(videoPath);
    
    console.log('\n=== ANALYSIS RESULT ===');
    console.log(`Summary: ${result.summary || 'N/A'}`);
    console.log('\nChecks:');
    console.log(`- Vertical Format: ${result.checks?.vertical_format ? '✓' : '✗'}`);
    console.log(`- No Watermarks: ${result.checks?.no_watermarks ? '✓' : '✗'}`);
    console.log(`- No Subtitles: ${result.checks?.no_subtitles ? '✓' : '✗'}`);
    console.log(`- Single Shot: ${result.checks?.single_shot ? '✓' : '✗'}`);
    console.log(`- No Talking: ${result.checks?.no_talking ? '✓' : '✗'}`);
    console.log(`- Instrumental Music Only: ${result.checks?.instrumental_music_only ? '✓' : '✗'}`);
    console.log(`- Has Background Sound: ${result.checks?.has_background_sound ? '✓' : '✗'}`);
    console.log(`- Min 8 Seconds: ${result.checks?.min_8_seconds ? '✓' : '✗'}`);
    console.log(`\nFinal Verdict: ${result.approved ? 'APPROVED ✓' : 'REJECTED ✗'}`);
    if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error analyzing video:', error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('🎬 Video Analysis Tool');
  console.log('=====================\n');
  
  console.log('Choose an option:');
  console.log('1. Process all available videos in the videos folder (generates CSV)');
  console.log('2. Download and analyze a single YouTube video');
  console.log('3. Exit\n');
  
  const choice = await askQuestion('Enter your choice (1, 2, or 3): ');
  
  switch (choice.trim()) {
    case '1':
      console.log('\n📁 Processing all videos in the videos folder...');
      await processAllVideos();
      break;
      
    case '2':
      console.log('\n📺 YouTube Video Download and Analysis');
      const youtubeUrl = await askQuestion('Enter YouTube video URL: ');
      
      if (!youtubeUrl.trim()) {
        console.log('❌ No URL provided. Exiting...');
        rl.close();
        return;
      }
      
      try {
        console.log('\n⬇️  Downloading video...');
        const downloadResult = await downloadYouTubeVideo(youtubeUrl);
        
        if (downloadResult.success) {
          console.log(`\n✅ Download successful: ${downloadResult.title}`);
          console.log(`📁 Saved to: ${downloadResult.filePath}`);
          
          // Analyze the downloaded video
          await analyzeSingleVideo(downloadResult.filePath);
        }
      } catch (error) {
        console.error('❌ Download failed:', error.message);
        console.log('\nTroubleshooting tips:');
        console.log('1. Make sure the YouTube URL is valid');
        console.log('2. Check if the video is available in your region');
        console.log('3. Try updating @distube/ytdl-core: npm update @distube/ytdl-core');
      }
      break;
      
    case '3':
      console.log('👋 Goodbye!');
      break;
      
    default:
      console.log('❌ Invalid choice. Please enter 1, 2, or 3.');
      break;
  }
  
  rl.close();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Process interrupted. Goodbye!');
  rl.close();
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  rl.close();
  process.exit(1);
}); 