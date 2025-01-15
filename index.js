const express = require("express");
const multer = require("multer");
const path = require("path");
const os = require("os");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = 3010;

// Set up SQLite database
const db = new sqlite3.Database("filedata.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err);
  } else {
    console.log("Connected to SQLite database.");
    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        generated_name TEXT NOT NULL,
        upload_date TEXT NOT NULL,
        downloads INTEGER DEFAULT 0
      )
    `);
  }
});

// Set up EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, "public")));

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
  // Read files and metadata from the database, sorted by date (newest first)
  db.all("SELECT * FROM files ORDER BY upload_date DESC", (err, files) => {
    if (err) {
      console.error("Error reading database:", err);
      res.status(500).send("Internal Server Error");
      return;
    }
    res.render("upload", { files: files });
  });
});

// Serve the uploaded files
app.use("/uploads", express.static("uploads"));

// Endpoint for file upload
app.post("/upload", upload.single("file"), (req, res) => {
  const { originalname } = req.file;
  const generatedName = req.file.filename;
  const uploadDate = new Date().toISOString();

  db.run(
    `INSERT INTO files (original_name, generated_name, upload_date, downloads) VALUES (?, ?, ?, 0)`,
    [originalname, generatedName, uploadDate],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      res.json({ message: "File uploaded successfully" });
    }
  );
});

// Endpoint for downloading files
app.get("/download/:id", (req, res) => {
  const id = req.params.id;

  db.get(
    `SELECT original_name, generated_name, downloads FROM files WHERE id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (!row) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(__dirname, "uploads", row.generated_name);
      fs.access(filePath, fs.constants.F_OK, (fsErr) => {
        if (fsErr) {
          return res.status(404).json({ message: "File not found" });
        }

        db.run(
          `UPDATE files SET downloads = ? WHERE id = ?`,
          [row.downloads + 1, id],
          (updateErr) => {
            if (updateErr) console.error(updateErr);
          }
        );

        res.download(filePath, row.original_name);
      });
    }
  );
});

// Delete file endpoint
app.delete("/delete/:id", (req, res) => {
  const id = req.params.id;

  db.get(`SELECT generated_name FROM files WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    if (!row) {
      return res.status(404).json({ message: "File not found" });
    }

    const filePath = path.join(__dirname, "uploads", row.generated_name);

    fs.unlink(filePath, (fsErr) => {
      if (fsErr) {
        console.error(fsErr);
        return res.status(500).json({ message: "Error deleting file" });
      }

      db.run(`DELETE FROM files WHERE id = ?`, [id], (dbErr) => {
        if (dbErr) {
          console.error(dbErr);
          return res.status(500).json({ message: "Database error" });
        }

        res.json({ message: "File deleted successfully" });
      });
    });
  });
});

// System

// Function to delete files not in the database
const deleteUnreferencedFiles = () => {
  fs.readdir("uploads", (err, files) => {
    if (err) {
      console.error("Error reading uploads folder:", err);
      return;
    }

    db.all("SELECT generated_name FROM files", (dbErr, rows) => {
      if (dbErr) {
        console.error("Error reading database:", dbErr);
        return;
      }

      const dbFiles = rows.map((row) => row.generated_name);

      // Delete files that are in the uploads folder but not in the database
      files.forEach((file) => {
        if (!dbFiles.includes(file)) {
          const filePath = path.join("uploads", file);
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
              console.error("Error deleting file:", unlinkErr);
            } else {
              // console.log(`Deleted unreferenced file: ${file}`);
            }
          });
        }
      });
    });
  });
};

// Schedules
deleteUnreferencedFiles(); // also run on startup
setInterval(deleteUnreferencedFiles, 1000 * 60 * 60 * 24); // Run every day

app.listen(port, () => {
  console.log(`Server is running on http://${ipAddress}:${port}`);
});
