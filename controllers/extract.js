import extractor from "../lib/enhancedExtractor.js";
import { saveEventsToJSON, saveEventsToCSV, saveRawTextToFile } from "../lib/fileSaver.js";

export const extractAllEvents = async (req, res) => {
  try {
    // Check if files were uploaded (using upload.any())
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Get the first uploaded file
    const uploadedFile = req.files[0];
    const filePath = uploadedFile.path;
    
    console.log("Processing file:", {
      originalName: uploadedFile.originalname,
      filePath: filePath,
      size: uploadedFile.size,
      mimetype: uploadedFile.mimetype,
      fieldname: uploadedFile.fieldname
    });

    // Extract events from the uploaded file
    const extractionResult = await extractor(filePath);
    
    // Save results to files (make them async and handle errors)
    let jsonSave, csvSave, textSave;
    
    try {
      jsonSave = await saveEventsToJSON(extractionResult.extractedEvents, uploadedFile.originalname);
    } catch (saveError) {
      console.error("Failed to save JSON:", saveError);
      jsonSave = { success: false, error: saveError.message };
    }
    
    try {
      csvSave = await saveEventsToCSV(extractionResult.extractedEvents, uploadedFile.originalname);
    } catch (saveError) {
      console.error("Failed to save CSV:", saveError);
      csvSave = { success: false, error: saveError.message };
    }
    
    try {
      textSave = await saveRawTextToFile(extractionResult.rawText, uploadedFile.originalname);
    } catch (saveError) {
      console.error("Failed to save raw text:", saveError);
      textSave = { success: false, error: saveError.message };
    }
    
    res.json({
      message: "Events extracted successfully",
      file: {
        originalName: uploadedFile.originalname,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        fieldname: uploadedFile.fieldname
      },
      extraction: {
        totalPages: extractionResult.totalPages,
        totalEvents: extractionResult.extractedEvents.length,
        events: extractionResult.extractedEvents,
        metadata: extractionResult.metadata
      },
      savedFiles: {
        json: jsonSave,
        csv: csvSave,
        rawText: textSave
      }
    });
    
  } catch (error) {
    console.error("Error extracting events:", error);
    res.status(500).json({ error: "Failed to extract events", details: error.message });
  }
};
