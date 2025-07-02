const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

class UDSMEventExtractor {
    constructor() {
        this.eventPatterns = {
            // Date patterns for various formats
            datePatterns: [
                /(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/gi,
                /(\d{1,2}\/\d{1,2}\/\d{4})/g,
                /(\d{4}-\d{2}-\d{2})/g,
                /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi
            ],
            
            // Academic event keywords
            academicKeywords: [
                'semester', 'registration', 'orientation', 'examination', 'graduation',
                'commencement', 'convocation', 'deadline', 'begins', 'ends',
                'holiday', 'break', 'vacation', 'teaching', 'classes',
                'assessment', 'project', 'thesis', 'dissertation', 'defense'
            ],
            
            // Event type patterns
            eventTypes: {
                'Registration': /registration|enroll/gi,
                'Examination': /exam|test|assessment/gi,
                'Academic': /semester|teaching|classes|academic/gi,
                'Holiday': /holiday|break|vacation/gi,
                'Graduation': /graduation|commencement|convocation/gi,
                'Deadline': /deadline|due|submit/gi,
                'Orientation': /orientation|induction/gi
            }
        };
    }

    async extractEventsFromPDF(pdfPath) {
        try {
            const dataBuffer = fs.readFileSync(pdfPath);
            const pdfData = await pdf(dataBuffer);
            
            console.log(`Processing PDF with ${pdfData.numpages} pages...`);
            
            const events = this.parseTextForEvents(pdfData.text);
            return this.cleanAndStructureEvents(events);
            
        } catch (error) {
            console.error('Error extracting events from PDF:', error);
            throw error;
        }
    }

    parseTextForEvents(text) {
        const events = [];
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let currentSection = '';
        let currentDate = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Detect section headers (usually in caps or specific formatting)
            if (this.isSectionHeader(line)) {
                currentSection = line;
                continue;
            }
            
            // Look for dates in the line
            const dateMatch = this.extractDateFromLine(line);
            if (dateMatch) {
                currentDate = dateMatch;
            }
            
            // Check if line contains event information
            if (this.isEventLine(line)) {
                const event = this.createEventFromLine(line, currentDate, currentSection, i, lines);
                if (event) {
                    events.push(event);
                }
            }
        }
        
        return events;
    }

    isSectionHeader(line) {
        // Common section headers in academic calendars
        const sectionPatterns = [
            /ACADEMIC\s+CALENDAR/i,
            /SEMESTER\s+\d+/i,
            /FIRST\s+SEMESTER/i,
            /SECOND\s+SEMESTER/i,
            /THIRD\s+SEMESTER/i,
            /EXAMINATION\s+PERIOD/i,
            /VACATION/i,
            /HOLIDAY/i,
            /REGISTRATION/i
        ];
        
        return sectionPatterns.some(pattern => pattern.test(line)) || 
               (line.length < 50 && line === line.toUpperCase() && line.split(' ').length <= 5);
    }

    extractDateFromLine(line) {
        for (const pattern of this.eventPatterns.datePatterns) {
            const match = line.match(pattern);
            if (match) {
                return this.parseDate(match[0]);
            }
        }
        return null;
    }

    parseDate(dateString) {
        try {
            // Handle various date formats
            const cleanDate = dateString.replace(/(\d+)(st|nd|rd|th)/g, '$1');
            const date = new Date(cleanDate);
            
            if (isNaN(date.getTime())) {
                // Try alternative parsing
                return this.parseAlternativeDate(dateString);
            }
            
            return date.toISOString().split('T')[0];
        } catch (error) {
            console.warn(`Could not parse date: ${dateString}`);
            return dateString; // Return original if parsing fails
        }
    }

    parseAlternativeDate(dateString) {
        // Handle formats like "1st September 2024"
        const months = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
        };
        
        const match = dateString.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
        if (match) {
            const day = match[1].padStart(2, '0');
            const month = months[match[2].toLowerCase()];
            const year = match[3];
            
            if (month) {
                return `${year}-${month}-${day}`;
            }
        }
        
        return dateString;
    }

    isEventLine(line) {
        // Check if line contains academic keywords or date patterns
        const hasKeyword = this.eventPatterns.academicKeywords.some(keyword => 
            line.toLowerCase().includes(keyword)
        );
        
        const hasDate = this.eventPatterns.datePatterns.some(pattern => 
            pattern.test(line)
        );
        
        // Also check for lines that describe activities or deadlines
        const activityPatterns = [
            /begins?|starts?|commences?/i,
            /ends?|concludes?|finishes?/i,
            /due|deadline|submit/i,
            /from|to|until/i
        ];
        
        const hasActivity = activityPatterns.some(pattern => pattern.test(line));
        
        return hasKeyword || hasDate || hasActivity;
    }

    createEventFromLine(line, currentDate, currentSection, lineIndex, allLines) {
        // Extract event details
        const eventType = this.determineEventType(line);
        const description = this.cleanDescription(line);
        const dateInfo = this.extractDateFromLine(line) || currentDate;
        
        // Look for additional context in surrounding lines
        const context = this.getContextLines(lineIndex, allLines);
        
        return {
            id: `event_${Date.now()}_${lineIndex}`,
            title: this.generateEventTitle(description, eventType),
            description: description,
            date: dateInfo,
            type: eventType,
            section: currentSection,
            context: context,
            originalLine: line,
            lineNumber: lineIndex + 1
        };
    }

    determineEventType(line) {
        for (const [type, pattern] of Object.entries(this.eventPatterns.eventTypes)) {
            if (pattern.test(line)) {
                return type;
            }
        }
        return 'General';
    }

    cleanDescription(line) {
        // Remove excessive whitespace and clean up the description
        return line.replace(/\s+/g, ' ').trim();
    }

    generateEventTitle(description, eventType) {
        // Generate a concise title from the description
        const words = description.split(' ');
        if (words.length <= 6) {
            return description;
        }
        
        // Extract key terms for title
        const keyTerms = words.filter(word => 
            this.eventPatterns.academicKeywords.some(keyword => 
                word.toLowerCase().includes(keyword.toLowerCase())
            )
        );
        
        if (keyTerms.length > 0) {
            return keyTerms.slice(0, 4).join(' ');
        }
        
        return words.slice(0, 6).join(' ') + '...';
    }

    getContextLines(lineIndex, allLines) {
        // Get surrounding lines for context
        const start = Math.max(0, lineIndex - 2);
        const end = Math.min(allLines.length, lineIndex + 3);
        return allLines.slice(start, end).join(' | ');
    }

    cleanAndStructureEvents(events) {
        // Remove duplicates and sort events
        const uniqueEvents = this.removeDuplicates(events);
        const sortedEvents = this.sortEventsByDate(uniqueEvents);
        
        return {
            totalEvents: sortedEvents.length,
            events: sortedEvents,
            eventTypes: this.groupEventsByType(sortedEvents),
            extractionDate: new Date().toISOString()
        };
    }

    removeDuplicates(events) {
        const seen = new Set();
        return events.filter(event => {
            const key = `${event.date}_${event.description}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    sortEventsByDate(events) {
        return events.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            
            return dateA - dateB;
        });
    }

    groupEventsByType(events) {
        const grouped = {};
        events.forEach(event => {
            if (!grouped[event.type]) {
                grouped[event.type] = [];
            }
            grouped[event.type].push(event);
        });
        return grouped;
    }

    async saveEventsToFile(events, outputPath) {
        try {
            const jsonOutput = JSON.stringify(events, null, 2);
            fs.writeFileSync(outputPath, jsonOutput);
            console.log(`Events saved to: ${outputPath}`);
            
            // Also save a CSV version for easy viewing
            const csvPath = outputPath.replace('.json', '.csv');
            this.saveEventsToCSV(events.events, csvPath);
            
        } catch (error) {
            console.error('Error saving events:', error);
            throw error;
        }
    }

    saveEventsToCSV(events, csvPath) {
        const headers = ['Date', 'Title', 'Type', 'Description', 'Section'];
        const csvContent = [
            headers.join(','),
            ...events.map(event => [
                event.date,
                `"${event.title}"`,
                event.type,
                `"${event.description.replace(/"/g, '""')}"`,
                `"${event.section}"`
            ].join(','))
        ].join('\n');
        
        fs.writeFileSync(csvPath, csvContent);
        console.log(`CSV saved to: ${csvPath}`);
    }
}

// Usage example and main execution
async function main() {
    const extractor = new UDSMEventExtractor();
    const pdfPath = path.join(__dirname, 'UDSM_ALMANAC_2025.pdf');
    const outputPath = path.join(__dirname, 'extracted_events.json');
    
    try {
        console.log('Starting event extraction from UDSM Almanac 2025...');
        const events = await extractor.extractEventsFromPDF(pdfPath);
        
        console.log(`\nExtraction completed!`);
        console.log(`Total events found: ${events.totalEvents}`);
        console.log(`Event types: ${Object.keys(events.eventTypes).join(', ')}`);
        
        await extractor.saveEventsToFile(events, outputPath);
        
        // Display sample events
        console.log('\nSample events:');
        events.events.slice(0, 5).forEach((event, index) => {
            console.log(`${index + 1}. ${event.title} (${event.date}) - ${event.type}`);
        });
        
    } catch (error) {
        console.error('Extraction failed:', error);
    }
}

// Export for use as module
module.exports = UDSMEventExtractor;

// Run if called directly
if (require.main === module) {
    main();
}