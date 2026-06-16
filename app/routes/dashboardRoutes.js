const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { pool } = require("../config/db");

const router = express.Router();

// Get dashboard info and user's saved ideas
router.get("/dashboard", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Fetch user's saved ideas
    const ideasResult = await pool.query(
      "SELECT id, title, description, target_audience, analysis, created_at FROM ideas WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    const ideas = ideasResult.rows;
    return res.json({
      message: "Welcome to your protected dashboard.",
      user: req.user,
      stats: {
        ideasAnalyzed: ideas.length,
        savedIdeas: ideas.length,
        accountStatus: "Active",
      },
      ideas,
      nextSteps: [
        "Run your startup idea analysis",
        "Review competitor insights",
        "Your saved ideas are now listed below!",
      ],
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    return res.status(500).json({ error: "Failed to load dashboard." });
  }
});

// Save a new analyzed idea for the logged-in user
router.post("/ideas", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, targetAudience, analysis } = req.body;

    if (!title || !description || !targetAudience || !analysis) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Yahan hum ensure kar rahe hain ke ye ek valid JSON string ho
    let analysisJson;
    try {
        // Agar analysis already object hai, to use stringify kar do
        // Agar string hai, to check karo ke kya ye valid JSON hai
        analysisJson = (typeof analysis === 'object') ? JSON.stringify(analysis) : analysis;
        
        // Agar ye phir bhi invalid JSON string hai, to use JSON object mein wrap kar do
        JSON.parse(analysisJson); 
    } catch (e) {
        // Agar JSON.parse fail hua, to iska matlab data plain text hai, 
        // ise ek JSON object mein daal kar stringify kar do taake format theek ho jaye
        analysisJson = JSON.stringify({ content: analysis });
    }

    const result = await pool.query(
      `INSERT INTO ideas (user_id, title, description, target_audience, analysis)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, target_audience, analysis, created_at`,
      [userId, title, description, targetAudience, analysisJson]
    );

    return res.status(201).json({ message: "Idea saved!", idea: result.rows[0] });
  } catch (error) {
    console.error("Save idea error:", error);
    return res.status(500).json({ error: "Failed to save idea." });
  }
});

// Get all ideas for the logged-in user
router.get("/ideas", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const ideasResult = await pool.query(
      "SELECT id, title, description, target_audience, analysis, created_at FROM ideas WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return res.json({ ideas: ideasResult.rows });
  } catch (error) {
    console.error("Fetch ideas error:", error);
    return res.status(500).json({ error: "Failed to fetch ideas." });
  }
});

module.exports = router;