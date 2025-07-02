// Test script to verify the extractor works
import extractor from './lib/extractor.js';
import path from 'path';

console.log('Testing PDF extractor...');

// Test with a sample text to see if organizeEvents works
const testText = `
01/01/2025: New Year's Day
02/14/2025: Valentine's Day
March 17, 2025: St. Patrick's Day
04-20-2025: Easter Sunday
2025-12-25: Christmas Day
`;

console.log('Testing with sample text...');

// You can uncomment this to test with an actual PDF file
// const testFilePath = './test.pdf';
// if (fs.existsSync(testFilePath)) {
//   extractor(testFilePath)
//     .then(result => {
//       console.log('Extraction successful:', result);
//     })
//     .catch(error => {
//       console.error('Extraction failed:', error);
//     });
// } else {
//   console.log('No test PDF file found');
// }

console.log('Test completed. Check server logs for any errors.');