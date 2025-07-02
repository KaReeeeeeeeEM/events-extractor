import express from 'express';
import multer from 'multer';
import path from 'path';
import { extractAllEvents } from '../controllers/extract.js';

const router = express.Router();

// Configure multer for this route
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

// Route to extract events from uploaded file - accepts any field name
router.post('/', upload.any(), extractAllEvents);

// Test endpoint to check if the route is working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Extract route is working',
    timestamp: new Date().toISOString()
  });
});

export default router;