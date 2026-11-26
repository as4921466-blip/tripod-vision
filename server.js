
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const connectDB = require("./db");
const Contact = require("./Contact");
const Portfolio = require("./Portfolio");
const Revenue = require("./Revenue");
const Visitor = require("./Visitor");

const app = express();
const PORT = 5000;

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ======================================
// SECURITY SETTINGS
// ======================================

app.use(helmet());

app.use(cors());

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({
  extended: true,
  limit: "20kb"
}));
app.use("/uploads", express.static(uploadDir));

// GENERAL API RATE LIMIT
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

app.use("/api", apiLimiter);

// ADMIN LOGIN RATE LIMIT
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later."
  }
});

// ======================================
// IMAGE UPLOAD SETTINGS
// ======================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, crypto.randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WEBP images are allowed."));
    }

    cb(null, true);
  }
});

// ======================================
// HOME
// ======================================

app.get("/", (req, res) => {
  res.send("TRIPOD VISION BACKEND IS RUNNING!");
});

// ======================================
// API TEST
// ======================================

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "API is working!"
  });
});

// ======================================
// CONTACT FORM
// ======================================

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !message.trim()
    ) {
      return res.status(400).json({
        message: "Name, email and message are required."
      });
    }

    await new Contact({
      name: name.trim(),
      email: email.trim(),
      phone: typeof phone === "string" ? phone.trim() : "",
      message: message.trim()
    }).save();

    res.status(201).json({
      success: true,
      message: "Your message has been received!"
    });

  } catch (error) {
    console.error("Contact error:", error);

    res.status(500).json({
      message: "Could not save message."
    });
  }
});

// ======================================
// ADMIN TOKEN
// ======================================

function createToken(timestamp) {
  return crypto
    .createHmac("sha256", process.env.ADMIN_TOKEN_SECRET)
    .update(timestamp)
    .digest("hex");
}

// ======================================
// ADMIN LOGIN
// ======================================

app.post("/api/admin/login", loginLimiter, (req, res) => {
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_TOKEN_SECRET) {
    return res.status(500).json({
      message: "Admin credentials not configured."
    });
  }

  if (req.body.password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      message: "Incorrect password."
    });
  }

  const timestamp = Date.now().toString();

  res.json({
    success: true,
    token: timestamp + "." + createToken(timestamp)
  });
});

// ======================================
// VERIFY ADMIN
// ======================================

function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      message: "Admin login required."
    });
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return res.status(401).json({
      message: "Invalid token."
    });
  }

  const [timestamp, signature] = parts;
  const age = Date.now() - Number(timestamp);

  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > 8 * 60 * 60 * 1000
  ) {
    return res.status(401).json({
      message: "Session expired."
    });
  }

  const expected = createToken(timestamp);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return res.status(401).json({
      message: "Invalid token."
    });
  }

  next();
}

// ======================================
// MONTHLY MESSAGE ANALYTICS
// ======================================

app.get("/api/admin/analytics/monthly", verifyAdmin, async (req, res) => {
  try {
    const timezone = "Asia/Karachi";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit"
    }).formatToParts(new Date());

    const year = Number(parts.find(p => p.type === "year").value);
    const month = Number(parts.find(p => p.type === "month").value);

    const startDate = new Date(
      Date.UTC(year, month - 12, 1) - 5 * 60 * 60 * 1000
    );

    const results = await Contact.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const countMap = {};

    results.forEach(item => {
      countMap[item._id] = item.count;
    });

    const monthlyData = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(Date.UTC(year, month - 1 - i, 1));
      const key = date.toISOString().slice(0, 7);

      const label = new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC"
      }).format(date);

      monthlyData.push({
        month: key,
        label,
        count: countMap[key] || 0
      });
    }

    res.json({
      success: true,
      monthlyData
    });

  } catch (error) {
    console.error("Monthly analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load monthly analytics."
    });
  }
});

// ======================================
// GET CUSTOMER MESSAGES
// ======================================

app.get("/api/admin/contacts", verifyAdmin, async (req, res) => {
  try {
    const contacts = await Contact.find().sort({
      createdAt: -1
    });

    res.json({
      success: true,
      contacts
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load messages."
    });
  }
});

// ======================================
// READ / UNREAD
// ======================================

app.patch("/api/admin/contacts/:id/read", verifyAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { read: Boolean(req.body.read) },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({
        message: "Not found."
      });
    }

    res.json({
      success: true,
      contact
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Update failed."
    });
  }
});

// ======================================
// DELETE MESSAGE
// ======================================

app.delete("/api/admin/contacts/:id", verifyAdmin, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        message: "Not found."
      });
    }

    res.json({
      success: true,
      message: "Deleted."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Delete failed."
    });
  }
});

// ======================================
// MONTHLY REVENUE ANALYTICS
// ======================================

app.get("/api/admin/analytics/revenue", verifyAdmin, async (req, res) => {
  try {
    const timezone = "Asia/Karachi";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit"
    }).formatToParts(new Date());

    const year = Number(parts.find(p => p.type === "year").value);
    const month = Number(parts.find(p => p.type === "month").value);

    const startDate = new Date(
      Date.UTC(year, month - 12, 1) - 5 * 60 * 60 * 1000
    );

    const results = await Revenue.aggregate([
      {
        $match: {
          paymentDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$paymentDate",
              timezone
            }
          },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const revenueMap = {};

    results.forEach(item => {
      revenueMap[item._id] = item.total;
    });

    const monthlyData = [];

    for (let i = 11; i >= 0; i--) {
      const date = new Date(Date.UTC(year, month - 1 - i, 1));
      const key = date.toISOString().slice(0, 7);

      const label = new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC"
      }).format(date);

      monthlyData.push({
        month: key,
        label,
        total: revenueMap[key] || 0
      });
    }

    res.json({
      success: true,
      monthlyData
    });

  } catch (error) {
    console.error("Revenue Analytics Error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load monthly revenue analytics."
    });
  }
});

// ======================================
// REVENUE MANAGEMENT
// ======================================

app.post("/api/admin/revenue", verifyAdmin, async (req, res) => {
  try {
    const { projectName, amount, paymentDate, description } = req.body;

    if (
      typeof projectName !== "string" ||
      !projectName.trim() ||
      amount === undefined ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Project name and valid amount are required."
      });
    }

    const revenue = await Revenue.create({
      projectName: projectName.trim(),
      amount: Number(amount),
      paymentDate: paymentDate || new Date(),
      description: typeof description === "string" ? description.trim() : ""
    });

    res.status(201).json({
      success: true,
      message: "Revenue saved successfully!",
      revenue
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to save revenue."
    });
  }
});

app.get("/api/admin/revenue", verifyAdmin, async (req, res) => {
  try {
    const records = await Revenue.find().sort({
      paymentDate: -1
    });

    res.json({
      success: true,
      records
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load revenue."
    });
  }
});

app.delete("/api/admin/revenue/:id", verifyAdmin, async (req, res) => {
  try {
    const deleted = await Revenue.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Revenue record not found."
      });
    }

    res.json({
      success: true,
      message: "Revenue deleted successfully."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to delete revenue."
    });
  }
});

// ======================================
// WEBSITE VISITOR TRACKING
// ======================================

app.post("/api/visitor", async (req, res) => {
  try {
    const { visitorId } = req.body;

    if (
      typeof visitorId !== "string" ||
      visitorId.length < 10 ||
      visitorId.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid visitor ID."
      });
    }

    await Visitor.create({ visitorId });

    res.status(201).json({
      success: true,
      message: "Visitor recorded."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Could not record visitor."
    });
  }
});

// ======================================
// ADMIN VISITOR ANALYTICS
// ======================================

app.get("/api/admin/analytics/visitors", verifyAdmin, async (req, res) => {
  try {
    const timezone = "Asia/Karachi";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const getPart = type => parts.find(p => p.type === type).value;

    const todayKey =
      `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

    const currentMonth =
      `${getPart("year")}-${getPart("month")}`;

    const totalVisitors = (
      await Visitor.distinct("visitorId")
    ).length;

    const todayResult = await Visitor.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$visitDate",
                  timezone
                }
              },
              todayKey
            ]
          }
        }
      },
      { $group: { _id: "$visitorId" } },
      { $count: "count" }
    ]);

    const monthlyResult = await Visitor.aggregate([
      {
        $match: {
          $expr: {
            $eq: [
              {
                $dateToString: {
                  format: "%Y-%m",
                  date: "$visitDate",
                  timezone
                }
              },
              currentMonth
            ]
          }
        }
      },
      { $group: { _id: "$visitorId" } },
      { $count: "count" }
    ]);

    const monthlyGroups = await Visitor.aggregate([
      {
        $group: {
          _id: {
            month: {
              $dateToString: {
                format: "%Y-%m",
                date: "$visitDate",
                timezone
              }
            },
            visitorId: "$visitorId"
          }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};

    monthlyGroups.forEach(item => {
      countMap[item._id] = item.count;
    });

    const monthlyData = [];

    const year = Number(getPart("year"));
    const month = Number(getPart("month"));

    for (let i = 11; i >= 0; i--) {
      const date = new Date(Date.UTC(year, month - 1 - i, 1));
      const key = date.toISOString().slice(0, 7);

      const label = new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC"
      }).format(date);

      monthlyData.push({
        month: key,
        label,
        count: countMap[key] || 0
      });
    }

    res.json({
      success: true,
      totalVisitors,
      todayVisitors: todayResult[0]?.count || 0,
      monthlyVisitors: monthlyResult[0]?.count || 0,
      monthlyData
    });

  } catch (error) {
    console.error("Visitor Analytics Error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load visitor analytics."
    });
  }
});

// ======================================
// GET PORTFOLIO
// ======================================

app.get("/api/portfolio", async (req, res) => {
  try {
    const projects = await Portfolio.find().sort({
      createdAt: -1
    });

    res.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not load portfolio."
    });
  }
});

// ======================================
// ADD PORTFOLIO PROJECT
// ======================================

app.post(
  "/api/admin/portfolio",
  verifyAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, category, description } = req.body;

      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        !req.file
      ) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          message: "Title, category and image are required."
        });
      }

      const project = await Portfolio.create({
        title: title.trim(),
        category: category.trim(),
        description: typeof description === "string" ? description.trim() : "",
        image: "/uploads/" + req.file.filename
      });

      res.status(201).json({
        success: true,
        project
      });

    } catch (error) {
      console.error(error);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        message: "Could not add project."
      });
    }
  }
);

// ======================================
// DELETE PORTFOLIO PROJECT
// ======================================

app.delete("/api/admin/portfolio/:id", verifyAdmin, async (req, res) => {
  try {
    const project = await Portfolio.findByIdAndDelete(req.params.id);

    if (!project) {
      return res.status(404).json({
        message: "Project not found."
      });
    }

    if (project.image && project.image.startsWith("/uploads/")) {
      const imagePath = path.join(
        uploadDir,
        path.basename(project.image)
      );

      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    res.json({
      success: true,
      message: "Project deleted."
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Could not delete project."
    });
  }
});

// ======================================
// UPLOAD ERROR HANDLER
// ======================================

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  const status = error instanceof multer.MulterError ? 400 : 400;

  res.status(status).json({
    success: false,
    message: error.message || "Upload failed."
  });
});

// ======================================
// START SERVER
// ======================================

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Tripod Vision running at http://localhost:${PORT}`
      );
    });
  })
  .catch(error => {
    console.error("Database connection failed:", error);
  });
