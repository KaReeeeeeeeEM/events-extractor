// Alternative PDF extractor using pdf2pic and tesseract (OCR-based)
// This is a fallback if pdf-parse continues to have issues

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export const extractPDFWithFallback = async (filePath) => {
  try {
    // First try to use pdftotext (part of poppler-utils)
    const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
    
    if (stdout && stdout.trim().length > 0) {
      console.log('PDF text extracted using pdftotext');
      return {
        totalPages: 1, // We can't easily get page count with this method
        rawText: stdout,
        extractedEvents: organizeEvents(stdout),
        metadata: { extractionMethod: 'pdftotext' }
      };
    }
  } catch (error) {
    console.log('pdftotext not available, falling back to basic text extraction');
  }

  // If pdftotext fails, return a basic response
  return {
    totalPages: 1,
    rawText: 'Unable to extract text from PDF. Please ensure the PDF contains selectable text.',
    extractedEvents: [],
    metadata: { extractionMethod: 'fallback', error: 'No suitable PDF parser available' }
  };
};

// Simple text-based event organizer (same as before)
function organizeEvents(text) {
  const events = [];
  
  if (!text || typeof text !== 'string') {
    console.warn('No valid text provided for event organization');
    return events;
  }
  
  // Multiple regex patterns to catch different date formats
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4}):\s*(.+)/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(.+)/g,
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}):\s*(.+)/gi,
    /(\d{1,2}-\d{1,2}-\d{4}):\s*(.+)/g,
    /(\d{4}-\d{1,2}-\d{1,2}):\s*(.+)/g
  ];
  
  datePatterns.forEach((pattern, index) => {
    try {
      let match;
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(text)) !== null) {
        const event = {
          date: match[1].trim(),
          description: match[2].trim(),
          rawMatch: match[0],
          patternUsed: index + 1
        };
        
        const isDuplicate = events.some(existingEvent => 
          existingEvent.date === event.date && 
          existingEvent.description === event.description
        );
        
        if (!isDuplicate && event.description.length > 0) {
          events.push(event);
        }
      }
    } catch (error) {
      console.warn(`Error with pattern ${index + 1}:`, error.message);
    }
  });
  
  events.sort((a, b) => {
    try {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA - dateB;
    } catch (error) {
      return 0;
    }
  });
  
  console.log(`Extracted ${events.length} events from text`);
  return events;
}