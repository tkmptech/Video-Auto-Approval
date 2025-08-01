import {
    GoogleGenAI,
    createUserContent,
    createPartFromUri,
  } from "@google/genai";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY
});

// Video analysis prompt for approval evaluation
const VIDEO_ANALYSIS_PROMPT = `You are an intelligent video analysis assistant.
You will be given a TikTok-style video. Your task is to watch and understand the video, then evaluate whether it qualifies as "approved" based on strict criteria listed below.

Follow these steps:

1. Video Summary
Describe the main essence or core content of the video in 1–2 sentences.
Identify what's visually and audibly happening.

2. Auto-Approval Checklist
Check the video against each of the following rules. Return a "yes" or "no" for each. If "no", explain why:

✅ Approval Criteria:
Vertical Format — Is the video in ~9:16 portrait aspect ratio?

No Watermarks — Does the video avoid showing logos, usernames, or platform watermarks?

No Subtitles/Text — Are there no captions or on-screen text of any kind?

Single Continuous Shot — Is it one uncut clip (not a montage or compilation)?

No Talking — Is there no spoken dialogue (either from the speaker or voiceover)?

Music Rules — If music is present, is it instrumental only (no lyrics)?

Background Sound Required — Does the video have some background sound (not completely silent)?

Minimum Length — Is the video at least 8 seconds long?

3. Final Verdict
Based on the above checks, return:

{
  "approved": true or false,
  "reason": "Brief explanation if not approved"
}

Output Format:
Return your full response in the following structured JSON format ONLY (no markdown, no code blocks, just pure JSON):

{
  "summary": "Short summary of the video",
  "checks": {
    "vertical_format": true,
    "no_watermarks": true,
    "no_subtitles": true,
    "single_shot": true,
    "no_talking": true,
    "instrumental_music_only": true,
    "has_background_sound": true,
    "min_8_seconds": true
  },
  "approved": true,
  "reason": ""
}

If any check fails, set "approved": false and explain why in "reason".

Be strict. If even one check fails, the video must be rejected.
IMPORTANT: Return ONLY the JSON object, no markdown formatting, no code blocks, no additional text.`;

async function analyzeVideoForApproval(videoFilePath) {
  try {
    // Upload the video file
    const myfile = await ai.files.upload({
      file: videoFilePath,
      config: { mimeType: "video/mp4" },
    });

    console.log(`File uploaded: ${path.basename(videoFilePath)}, waiting for processing...`);
    
    // Wait for the file to be processed (check status)
    let fileStatus = await ai.files.get({ name: myfile.name });
    while (fileStatus.state !== "ACTIVE") {
      console.log(`File state: ${fileStatus.state}, waiting...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      fileStatus = await ai.files.get({ name: myfile.name });
    }
    
    console.log(`File is now ACTIVE, analyzing video: ${path.basename(videoFilePath)}`);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: createUserContent([
        createPartFromUri(myfile.uri, myfile.mimeType),
        VIDEO_ANALYSIS_PROMPT,
      ]),
    });
    
    console.log(`Video Analysis Result for ${path.basename(videoFilePath)}:`);
    console.log(response.text);
    
    // Try to parse the JSON response
    try {
      let jsonText = response.text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      const result = JSON.parse(jsonText);
      return result;
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      return { error: "Failed to parse response", rawResponse: response.text };
    }
    
  } catch (error) {
    console.error("Error:", error.message);
    return { error: error.message };
  }
}

// Function to get all video files from the videos directory
function getVideoFiles(videosDir) {
  try {
    const files = fs.readdirSync(videosDir);
    return files.filter(file => 
      file.toLowerCase().endsWith('.mp4') || 
      file.toLowerCase().endsWith('.avi') || 
      file.toLowerCase().endsWith('.mov') ||
      file.toLowerCase().endsWith('.mkv')
    );
  } catch (error) {
    console.error(`Error reading videos directory: ${error.message}`);
    return [];
  }
}

// Function to convert results to CSV format with separate sections
function convertToCSV(results) {
  const headers = [
    'Filename',
    'Summary',
    'Vertical Format',
    'No Watermarks',
    'No Subtitles',
    'Single Shot',
    'No Talking',
    'Instrumental Music Only',
    'Has Background Sound',
    'Min 8 Seconds',
    'Approved',
    'Reason'
  ];

  const csvRows = [];
  
  // Separate approved and rejected videos
  const approvedVideos = results.filter(result => result.approved);
  const rejectedVideos = results.filter(result => !result.approved);

  // Add GOOD VIDEOS section
  csvRows.push('GOOD VIDEOS (APPROVED)');
  csvRows.push('='.repeat(50));
  csvRows.push(headers.join(','));
  
  approvedVideos.forEach(result => {
    const row = [
      `"${result.filename}"`,
      `"${(result.summary || '').replace(/"/g, '""')}"`,
      result.checks?.vertical_format ? 'Yes' : 'No',
      result.checks?.no_watermarks ? 'Yes' : 'No',
      result.checks?.no_subtitles ? 'Yes' : 'No',
      result.checks?.single_shot ? 'Yes' : 'No',
      result.checks?.no_talking ? 'Yes' : 'No',
      result.checks?.instrumental_music_only ? 'Yes' : 'No',
      result.checks?.has_background_sound ? 'Yes' : 'No',
      result.checks?.min_8_seconds ? 'Yes' : 'No',
      result.approved ? 'Yes' : 'No',
      `"${(result.reason || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  // Add empty line between sections
  csvRows.push('');
  csvRows.push('');

  // Add BAD VIDEOS section
  csvRows.push('BAD VIDEOS (REJECTED)');
  csvRows.push('='.repeat(50));
  csvRows.push(headers.join(','));
  
  rejectedVideos.forEach(result => {
    const row = [
      `"${result.filename}"`,
      `"${(result.summary || '').replace(/"/g, '""')}"`,
      result.checks?.vertical_format ? 'Yes' : 'No',
      result.checks?.no_watermarks ? 'Yes' : 'No',
      result.checks?.no_subtitles ? 'Yes' : 'No',
      result.checks?.single_shot ? 'Yes' : 'No',
      result.checks?.no_talking ? 'Yes' : 'No',
      result.checks?.instrumental_music_only ? 'Yes' : 'No',
      result.checks?.has_background_sound ? 'Yes' : 'No',
      result.checks?.min_8_seconds ? 'Yes' : 'No',
      result.approved ? 'Yes' : 'No',
      `"${(result.reason || '').replace(/"/g, '""')}"`
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

// Main function to process all videos and save to CSV
async function processAllVideos() {
  const videosDir = './videos';
  const videoFiles = getVideoFiles(videosDir);
  
  if (videoFiles.length === 0) {
    console.log('No video files found in the videos directory.');
    return;
  }

  console.log(`Found ${videoFiles.length} video files to process:`);
  videoFiles.forEach(file => console.log(`- ${file}`));

  const results = [];
  
  for (let i = 0; i < videoFiles.length; i++) {
    const videoFile = videoFiles[i];
    const videoPath = path.join(videosDir, videoFile);
    
    console.log(`\n--- Processing video ${i + 1}/${videoFiles.length}: ${videoFile} ---`);
    
    try {
      const result = await analyzeVideoForApproval(videoPath);
      
      // Add filename to the result
      result.filename = videoFile;
      
      results.push(result);
      
      console.log(`✓ Completed analysis for: ${videoFile}`);
      
      // Add a small delay between processing to avoid rate limits
      if (i < videoFiles.length - 1) {
        console.log('Waiting 3 seconds before next video...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (error) {
      console.error(`✗ Error processing ${videoFile}:`, error.message);
      results.push({
        filename: videoFile,
        error: error.message,
        summary: 'Error occurred during processing',
        checks: {},
        approved: false,
        reason: error.message
      });
    }
  }

  // Create output directory if it doesn't exist
  const outputDir = './output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Save results to CSV file in output folder
  const csvContent = convertToCSV(results);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvFilename = path.join(outputDir, `video_analysis_results_${timestamp}.csv`);
  
  try {
    fs.writeFileSync(csvFilename, csvContent, 'utf8');
    console.log(`\n✓ Results saved to: ${csvFilename}`);
    console.log(`✓ Processed ${results.length} videos successfully`);
    
    // Print summary
    const approvedCount = results.filter(r => r.approved).length;
    console.log(`\nSummary:`);
    console.log(`- Total videos: ${results.length}`);
    console.log(`- Approved: ${approvedCount}`);
    console.log(`- Rejected: ${results.length - approvedCount}`);
    
  } catch (error) {
    console.error(`✗ Error saving CSV file: ${error.message}`);
  }
}

// Export functions for use in other modules
export { analyzeVideoForApproval, processAllVideos, getVideoFiles, convertToCSV };

// Run the main function if this file is executed directly
if (process.argv[1] && process.argv[1].endsWith('gemini.js')) {
  await processAllVideos();
}