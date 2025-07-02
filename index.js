import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import connectDB from "./lib/db.js";

// route imports
import extractorRoutes from "./routes/extract.js";

dotenv.config();
// connectDB();

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const app = express();

// CORS configuration to handle file uploads
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

//   routes 
app.get("/", (req, res) => {
    res.send("Welcome to the Events Extractor API");
});

app.use("/api/extract", extractorRoutes);

const PORT = process.env.PORT|| 9090;

// server debug log
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
