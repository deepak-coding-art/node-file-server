const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");

const app = express();
const port = 3010;

// Set up EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Set up file storage and upload limits
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit for file uploads
  },
});

// Get the appropriate IP address of the machine
const getIPAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    const addresses = interfaces[interfaceName];
    for (const address of addresses) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "localhost";
};

const ipAddress = getIPAddress();

// Render the upload page
app.get("/", (req, res) => {
  // Read the list of files in the uploads directory
  const uploadDir = path.join(__dirname, "uploads");
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error("Error reading upload directory:", err);
      res.status(500).send("Internal Server Error");
      return;
    }

    res.render("upload", { files: files });
  });
});

// Serve the uploaded files
app.use("/uploads", express.static("uploads"));

// Render the upload page
app.get("/", (req, res) => {
  res.render("upload");
});

// Endpoint for file upload
app.post("/upload", upload.single("file"), (req, res) => {
  // Respond with a success message
  res.json({ message: "File uploaded successfully" });
});

// Endpoint for downloading files
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename);
  res.download(filePath, filename, (err) => {
    if (err) {
      res.status(404).json({ message: "File not found" });
    }
  });
});

app.listen(port, () => {
  console.log(`Server is running on http://${ipAddress}:${port}`);
});
