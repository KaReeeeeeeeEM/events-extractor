import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create extracted-events directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'extracted-events');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

export const saveEventsToJSON = async (events, originalFileName) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${path.parse(originalFileName).name}_events_${timestamp}.json`;
    const filePath = path.join(outputDir, fileName);
    
    const eventData = {
      extractedAt: new Date().toISOString(),
      sourceFile: originalFileName,
      totalEvents: events.length,
      events: events
    };
    
    await fs.promises.writeFile(filePath, JSON.stringify(eventData, null, 2));
    console.log(`Events saved to: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName
    };
  } catch (error) {
    console.error('Error saving events to JSON:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const saveEventsToCSV = async (events, originalFileName) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${path.parse(originalFileName).name}_events_${timestamp}.csv`;
    const filePath = path.join(outputDir, fileName);
    
    // CSV headers
    let csvContent = 'Date,Description,Raw Match\n';
    
    // Add events data
    events.forEach(event => {
      const escapedDescription = `"${event.description.replace(/"/g, '""')}"`;
      const escapedRawMatch = `"${(event.rawMatch || '').replace(/"/g, '""')}"`;
      csvContent += `${event.date},${escapedDescription},${escapedRawMatch}\n`;
    });
    
    await fs.promises.writeFile(filePath, csvContent);
    console.log(`Events saved to: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName
    };
  } catch (error) {
    console.error('Error saving events to CSV:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export const saveRawTextToFile = async (rawText, originalFileName) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${path.parse(originalFileName).name}_raw_text_${timestamp}.txt`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.promises.writeFile(filePath, rawText || 'No text extracted');
    console.log(`Raw text saved to: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName
    };
  } catch (error) {
    console.error('Error saving raw text:', error);
    return {
      success: false,
      error: error.message
    };
  }
};