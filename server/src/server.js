const express = require("express");
const cors = require("cors");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

require("dotenv").config();

const port = process.env.PORT || 3000;

// Root endpoint
app.get("/", (req, res) => {
  res.send("Hello World! Server Live Reload leo! 🚀");
  console.log("Server endpoint hit - Live reload working!");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes for testing
app.get("/api/test", (req, res) => {
  res.json({
    message: "GET request successful",
    endpoint: "/api/test",
    method: "GET",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/test", (req, res) => {
  res.json({
    message: "POST request successful",
    endpoint: "/api/test",
    method: "POST",
    body: req.body,
    timestamp: new Date().toISOString(),
  });
});

app.put("/api/test/:id", (req, res) => {
  const { id } = req.params;
  res.json({
    message: "PUT request successful",
    endpoint: `/api/test/${id}`,
    method: "PUT",
    id: id,
    body: req.body,
    timestamp: new Date().toISOString(),
  });
});

app.delete("/api/test/:id", (req, res) => {
  const { id } = req.params;
  res.json({
    message: "DELETE request successful",
    endpoint: `/api/test/${id}`,
    method: "DELETE",
    id: id,
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
