const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Cache for available models
let cachedModels = null;

// Get list of available models
async function getAvailableModels(apiKey) {
  if (cachedModels) return cachedModels;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.models && Array.isArray(data.models)) {
      cachedModels = data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      
      console.log('Available models:', cachedModels);
      return cachedModels;
    }
  } catch (err) {
    console.error('Error fetching models:', err.message);
  }
  
  // Fallback to known models
  return ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
}

// Call Gemini API with automatic model detection
async function callGeminiAPI(message, apiKey) {
  const models = await getAvailableModels(apiKey);
  
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      console.log(`🔄 Trying model: ${model}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }],
        }),
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.log(`❌ Model ${model} failed: ${response.status}`);
        continue;
      }

      const data = JSON.parse(responseText);
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        console.log(`✅ Success with model: ${model}`);
        return data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      console.log(`❌ Model ${model} error:`, err.message);
      continue;
    }
  }
  
  return null;
}

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured.' });
    }

    console.log('📨 Chat request received');
    const aiResponse = await callGeminiAPI(message, GEMINI_API_KEY);
    
    if (!aiResponse) {
      console.error('❌ No response from any model');
      return res.status(500).json({ 
        error: 'Unable to reach Gemini API with any available model. Please check your API key and try again.' 
      });
    }

    res.json({ response: aiResponse });

  } catch (err) {
    console.error('❌ Chat route error:', err);
    res.status(500).json({ error: 'AI error: ' + (err.message || 'Unknown error') });
  }
});

module.exports = router;
