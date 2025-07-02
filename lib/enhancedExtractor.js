import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Extract all text from a PDF file using pdfjs-dist
async function extractTextWithPdfjs(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDocument = await loadingTask.promise;
  let text = '';
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return { text, totalPages: pdfDocument.numPages };
}

// Enhanced PDF text extractor with better event detection for UDSM Almanac
const extractPDF = async (filePath) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      throw new Error(`File not found: ${filePath}`);
    }

    let rawText = '';
    let totalPages = 1;
    
    try {
      // Read PDF using pdfjs-dist
      const { text, totalPages: pages } = await extractTextWithPdfjs(filePath);
      rawText = text;
      totalPages = pages;
      console.log(`PDF extracted successfully. Pages: ${totalPages}, Text length: ${rawText.length}`);
    } catch (pdfError) {
      console.error('PDF parsing failed:', pdfError);
      // Fallback: try reading the file buffer to look for readable text
      try {
        const buffer = fs.readFileSync(filePath);
        rawText = extractTextFromBuffer(buffer);
      } catch (bufferError) {
        console.error('Fallback buffer extraction failed:', bufferError);
        throw bufferError;
      }
    }
    
    if (!rawText || rawText.length < 100) {
      console.error('No meaningful text could be extracted from the PDF');
      throw new Error('No meaningful text could be extracted from the PDF');
    }
    
    // Enhanced event organization specifically for UDSM Almanac
    const events = organizeUDSMEvents(rawText);
    
    return {
      totalPages: totalPages,
      rawText: rawText,
      extractedEvents: events,
      metadata: { 
        extractionMethod: 'pdfjs-dist',
        fileSize: fs.statSync(filePath).size,
        fileName: filePath,
        eventsFound: events.length,
        textLength: rawText.length
      }
    };
    
  } catch (error) {
    console.error('Error extracting content:', error);
    if (error && error.stack) {
      console.error(error.stack);
    }
    throw new Error(`Failed to extract content: ${error.message}`);
  }
};

// Extract readable text from binary buffer (basic implementation)
function extractTextFromBuffer(buffer) {
  // Convert buffer to string and filter out non-printable characters
  let text = '';
  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i];
    // Include printable ASCII characters and common extended characters
    if ((char >= 32 && char <= 126) || char === 10 || char === 13 || char === 9) {
      text += String.fromCharCode(char);
    } else if (char >= 160 && char <= 255) {
      // Extended ASCII for accented characters
      text += String.fromCharCode(char);
    }
  }
  
  // Clean up the extracted text
  text = text
    .replace(/\0/g, '') // Remove null characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/(.)\1{10,}/g, '$1') // Remove excessive repetition
    .trim();
    
  console.log('Extracted text from binary buffer, length:', text.length);
  return text;
}

// Specialized event organization for UDSM Almanac
function organizeUDSMEvents(text) {
  const events = [];
  if (!text || typeof text !== 'string') {
    console.warn('No valid text provided for event organization');
    return events;
  }
  console.log('Starting UDSM event extraction...');

  // Split text into lines and also by date patterns to catch stacked events
  const eventLines = text.split(/(?=\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}))/i);

  // Regex to match date and event description
  const dateEventRegex = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2}(?:st|nd|rd|th)?\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s*[-–—:]?\s*(.*)/i;

  eventLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Try to match date and event
    let match = trimmed.match(dateEventRegex);
    if (match) {
      // Compose date string
      let day = match[2] ? match[2].replace(/(st|nd|rd|th)/, '').trim() : '1';
      let month = match[3];
      let year = match[4];
      let dateStr = `${day} ${month} ${year}`;
      let parsedDate = parseUDSMDate(dateStr);
      let eventDesc = match[5] ? match[5].trim() : '';
      if (parsedDate && eventDesc.length > 3) {
        events.push({
          title: cleanEventTitle(eventDesc),
          date: parsedDate,
          description: eventDesc,
          originalDate: dateStr,
          type: 'event',
          confidence: 0.8
        });
      }
    } else {
      // Fallback: look for lines with 'Begins:', 'Ends:', 'Release:', etc.
      const fallbackRegex = /(Begins|Ends|Release|Start Working|Complete Working|Lecture Sessions End|Results Release|Marking|Compilation|Report|Registration|Ceremony|Holiday|Break|Assessment|Examinations|Vacation|Practice|Training|Meeting|Board|Committee|Week|Session|Conference|Festival|Competition|Game|Campaign|Deadline|Admission|Appeals|Approval|Processing|Opening|Closing|Launch|Fair|Event|Day|Address|Appointment|Graduation|Orientation|Ball|Test|Presentation|Empowerment|Moderation|Innovation|Practical|Field Work|Project|Job Fair|Selection|Process|Public Holiday|Semester|Year|Week|Month|Date|Time|Period|Release|Result|Results|Release Date|Release of|Release:|Release Date:|Release of:|Release:)\s*[:-]?\s*(.*)/i;
      let fallbackMatch = trimmed.match(fallbackRegex);
      if (fallbackMatch && fallbackMatch[2]) {
        // Try to extract date from the line
        let dateInLine = extractDateFromLine(trimmed);
        let parsedDate = parseUDSMDate(dateInLine);
        if (parsedDate) {
          events.push({
            title: cleanEventTitle(fallbackMatch[1]),
            date: parsedDate,
            description: fallbackMatch[2].trim(),
            originalDate: dateInLine,
            type: 'event',
            confidence: 0.7
          });
        }
      }
    }
  });

  // Remove duplicates by date and title
  const uniqueEvents = [];
  const seen = new Set();
  for (const ev of events) {
    const key = `${ev.date}|${ev.title.toLowerCase()}`;
    if (!seen.has(key)) {
      uniqueEvents.push(ev);
      seen.add(key);
    }
  }

  // Sort by date
  uniqueEvents.sort((a, b) => (a.date < b.date ? -1 : 1));
  console.log(`Extracted ${uniqueEvents.length} UDSM events from document`);
  return uniqueEvents;
}

// Parse UDSM-specific date formats
function parseUDSMDate(dateStr) {
  if (!dateStr) return null;
  
  try {
    // Common UDSM date formats
    const datePatterns = [
      // "15th September 2024" or "15 September 2024"
      /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      // "September 15, 2024"
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
      // "15/09/2024" or "09/15/2024"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // "2024-09-15"
      /(\d{4})-(\d{1,2})-(\d{1,2})/
    ];
    
    const monthMap = {
      'january': 1, 'february': 2, 'march': 3, 'april': 4,
      'may': 5, 'june': 6, 'july': 7, 'august': 8,
      'september': 9, 'october': 10, 'november': 11, 'december': 12
    };
    
    for (const pattern of datePatterns) {
      const match = dateStr.match(pattern);
      if (match) {
        let year, month, day;
        
        if (pattern.source.includes('January|February')) { // Month name patterns
          if (match[1].length === 4) { // Year first
            [, year, month, day] = match;
          } else if (isNaN(match[1])) { // Month first
            [, month, day, year] = match;
            month = monthMap[month.toLowerCase()];
          } else { // Day first
            [, day, month, year] = match;
            month = monthMap[month.toLowerCase()];
          }
        } else { // Numeric patterns
          if (match[1].length === 4) { // YYYY-MM-DD
            [, year, month, day] = match;
          } else { // DD/MM/YYYY (assuming day/month/year for UDSM)
            [, day, month, year] = match;
          }
        }
        
        // Validate and format date
        const dateObj = new Date(year, month - 1, day);
        if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() == year) {
          return dateObj.toISOString().split('T')[0];
        }
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`Error parsing UDSM date "${dateStr}":`, error.message);
    return null;
  }
}

// Extract calendar-style entries (date followed by event)
function extractCalendarEntries(text) {
  const events = [];
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Look for lines starting with dates
    const dateMatch = line.match(/^(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const eventDesc = line.substring(dateMatch[0].length).trim();
      
      if (eventDesc.length > 5) {
        const parsedDate = parseUDSMDate(dateStr);
        if (parsedDate) {
          events.push({
            title: cleanEventTitle(eventDesc),
            date: parsedDate,
            originalDate: dateStr,
            description: eventDesc,
            type: 'calendar_entry',
            rawMatch: line,
            patternUsed: 'calendar',
            confidence: 0.7
          });
        }
      }
    }
  }
  
  return events;
}

// Clean event titles for better readability
function cleanEventTitle(title) {
  if (!title) return '';
  
  // Remove common prefixes and clean up
  title = title
    .replace(/^(date|time|event):\s*/i, '')
    .replace(/\s*(date|time|event)$/i, '')
    .replace(/^[-:\s]+|[-:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitalize first letter if not already
  if (title && title[0] === title[0].toLowerCase()) {
    title = title[0].toUpperCase() + title.slice(1);
  }
  
  return title;
}

// Calculate confidence score specifically for UDSM events
function calculateUDSMConfidence(description, dateStr, eventType) {
  let confidence = 0.5; // Base confidence
  
  // Higher confidence for well-formed dates
  if (/\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i.test(dateStr)) {
    confidence += 0.3;
  }
  
  // Higher confidence for academic event types
  const academicTypes = ['registration', 'examination', 'graduation', 'orientation', 'semester'];
  if (academicTypes.includes(eventType)) {
    confidence += 0.2;
  }
  
  // Higher confidence for UDSM-specific terms
  const udsmTerms = ['udsm', 'university', 'students', 'academic', 'semester', 'examination'];
  if (udsmTerms.some(term => description.toLowerCase().includes(term))) {
    confidence += 0.1;
  }
  
  // Lower confidence for very short or very long descriptions
  if (description.length < 10) confidence -= 0.2;
  if (description.length > 100) confidence -= 0.1;
  
  return Math.min(1.0, Math.max(0.0, confidence));
}

// Helper function to calculate confidence score
function calculateConfidence(dateStr, description) {
  let confidence = 0.5; // Base confidence
  
  // Higher confidence for well-formed dates
  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateStr)) confidence += 0.3;
  if (/\d{4}-\d{1,2}-\d{1,2}/.test(dateStr)) confidence += 0.3;
  if (/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}/.test(dateStr)) confidence += 0.4;
  
  // Higher confidence for event-like descriptions
  const eventWords = ['meeting', 'event', 'conference', 'deadline', 'appointment', 'party', 'celebration'];
  if (eventWords.some(word => description.toLowerCase().includes(word))) confidence += 0.2;
  
  // Lower confidence for very short or very long descriptions
  if (description.length < 10) confidence -= 0.2;
  if (description.length > 150) confidence -= 0.1;
  
  // Higher confidence for descriptions with time
  if (/\d{1,2}:\d{2}/.test(description)) confidence += 0.1;
  
  return Math.min(1.0, Math.max(0.0, confidence));
}

// Helper function to extract dates from lines
function extractDateFromLine(line) {
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4})/i,
    /(\d{1,2}-\d{1,2}-\d{4})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})/i
  ];
  
  for (const pattern of datePatterns) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export default extractPDF;