const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = process.env.PORT || 3000;

const HISTORY_FILE = path.join(__dirname, 'chat_history.json');
const HISTORY_LIMIT = 15;

// Store connected users
const connectedUsers = new Map();

// Helper to read last N chat messages from history file
function getChatHistory(limit = HISTORY_LIMIT) {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(-limit) : [];
  } catch {
    return [];
  }
}

// Helper to append a chat message to history file
function appendChatHistory(messageObj) {
  let history = getChatHistory(HISTORY_LIMIT);
  history.push(messageObj);
  if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Failed to write chat history:', err.message);
  }
}

// Groq API translation function with context-aware translation
async function translateText(text, targetLanguage = 'en', sourceLanguage = 'auto') {
  try {
    const languageMap = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'pt': 'Portuguese',
      'ru': 'Russian'
    };

    const targetLangName = languageMap[targetLanguage] || targetLanguage;

    // Get last 10-15 chat messages for context
    const history = getChatHistory(10);
    let contextBlock = '';
    if (history.length) {
      contextBlock = history.map((msg, i) => {
        return `[${msg.username || 'User'}]: ${msg.originalMessage || msg.message || ''}`;
      }).join('\n');
    }

    // Strict translation engine prompt - mechanically faithful translation
    const systemPrompt = `You are a strict translation engine for a chat application.\nYour only job is to translate text from the source language to the target language without changing the meaning, style, tone, vibe, slang level, intention, or emotional intensity of the message in any way.\n\nYou must ignore all tendencies to "fix", "improve", "interpret", or "rephrase" messages.\n\n🔥 SECTION 1 — MEANING PRESERVATION (CRITICAL)\n\n- Translate ONLY the meaning the user wrote.\n- Never guess extra meaning.\n- Never add new meaning.\n- Never weaken or strengthen meaning.\n- If the user writes a casual question, the translation must be equally casual.\n- If the user writes slang, the translation must be slang — not formal.\n- If the message is rude or blunt, preserve the rudeness or bluntness.\n\n🔥 SECTION 2 — SLANG, INTERNET SPEAK & CASUAL LANGUAGE\n\n- Never normalize slang.\n- "wassup" ≠ "what's up"\n- "чё как?" ≠ "что нового?"\n- "wyd" ≠ "what are you doing?"\n- Translate slang to slang of similar intensity, not formal equivalents.\n- Preserve misspellings, abbreviations, and stretched letters:\n  - "broooo" → equivalent stretched form\n  - "plz" → "плз" (not "пожалуйста")\n  - "idk" → "я хз" not "я не знаю"\n- Preserve youth slang, meme slang, and TikTok slang.\n\n🔥 SECTION 3 — STRUCTURE, FORMAT, AND SYMBOLS\n\nYou must preserve:\n- punctuation\n- lowercase/uppercase usage\n- spacing\n- line breaks\n- emojis\n- formatting style\n- repeated letters\n- tone markers\n- deliberate ambiguity\n- chaotic writing style, if present\n\n🔥 SECTION 4 — NO AUTOCORRECTION RULE\n\n- Do NOT fix grammar.\n- Do NOT fix spelling.\n- Do NOT fix punctuation.\n- Do NOT expand shorthand.\n- Do NOT replace ambiguity with clarity.\n- Do NOT change short forms to long forms.\n- Do NOT rephrase to a more natural sentence.\n- If the user writes messy text, your translation must be equally messy.\n\n🔥 SECTION 5 — NO SELF-THINKING, NO INTERPRETING\n\n- Do NOT interpret intention.\n- Do NOT guess context.\n- Do NOT insert politeness ("hello", "sir", "please") unless the user wrote it.\n- Do NOT replace slang with "better" slang.\n- Do NOT make the message sound more natural.\n- Do NOT adjust for different culture unless required for meaning.\n- Your translation must be mechanically faithful, not "improved".\n\n🔥 SECTION 6 — EXAMPLES (MANDATORY BEHAVIOR)\n\nExample 1\nInput: wassup\nCorrect Output (Russian): чё как?\nIncorrect Output: что случилось? / привет / что нового? / what's up\n\nExample 2\nInput: чё как?\nCorrect Output (English): wassup\n(NOT "what's good", "what's up", "how are you", or "what's going on")\n\nExample 3\nInput: broooo u wild 😭\nCorrect Output: брооо ты жесть 😭\n\nExample 4\nInput: idk man feels weird\nCorrect Output: я хз бро как-то стрёмно\n\n🔥 SECTION 7 — OUTPUT RULES\n\n- You MUST output ONLY the translation\n- NO explanations\n- NO reasoning\n- NO alternative interpretations\n- NO corrected version\n- NO comments\n- Just the translation.\n\n✅ FINAL OUTPUT FORMAT\n\nReturn only the translated message, preserving meaning + tone + slang exactly.`;

    const userPrompt = `Previous chat context:\n${contextBlock}\n\nTranslate ONLY to ${targetLangName}:\n${text}`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 500,
        top_p: 0.8
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let result = response.data.choices[0].message.content.trim();
    
    // Remove all common explanation patterns
    result = result.replace(/\(No changes needed.*?\)/gi, '').trim();
    result = result.replace(/\(Already in .*?\)/gi, '').trim();
    result = result.replace(/\(.*?translated from.*?\)/gi, '').trim();
    result = result.replace(/Translation:?\s*/gi, '').trim();
    result = result.replace(/^["']|["']$/g, '').trim();
    
    // If result is empty after cleanup, return original
    return result || text;
  } catch (error) {
    console.error('Translation error:', error.message);
    return text; // Return original text if translation fails
  }
}

// Detect language function using Groq
async function detectLanguage(text) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'ONLY respond with a 2-letter language code. Nothing else. No explanation, no text, just the code like "en" or "ru".'
          },
          {
            role: 'user',
            content: `Detect language (respond ONLY with 2-letter code):\n${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 3
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let language = response.data.choices[0].message.content.trim().toLowerCase();
    language = language.replace(/[^a-z]/g, '').substring(0, 2);
    return language || 'en';
  } catch (error) {
    console.error('Language detection error:', error.message);
    return 'en';
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  
  let userId = null;
  let username = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      // Handle user join
      if (data.type === 'join') {
        userId = data.userId;
        username = data.username;
        connectedUsers.set(userId, {
          ws,
          username,
          userId
        });

        // Send user list to all clients
        broadcastUserList();

        // Notify all users that someone joined
        broadcastMessage({
          type: 'system',
          username: 'System',
          message: `${username} joined the chat`,
          timestamp: new Date().toISOString()
        });

        console.log(`${username} (${userId}) joined the chat`);
      }

      // Handle chat message
      if (data.type === 'chat') {
        const { message: originalMessage, outgoingLanguage, incomingLanguage } = data;
        let messageToSend = originalMessage;

        // If outgoing language is set and different from original, translate it
        if (outgoingLanguage && outgoingLanguage !== 'auto') {
          console.log(`Translating message to ${outgoingLanguage}: ${originalMessage}`);
          messageToSend = await translateText(originalMessage, outgoingLanguage, 'auto');
          console.log(`Translated result: ${messageToSend}`);
        }

        // Create message object
        const chatMessage = {
          type: 'chat',
          username,
          userId,
          originalMessage: messageToSend,
          outgoingLanguage: outgoingLanguage || 'auto',
          incomingLanguage: incomingLanguage || 'en',
          translations: {},
          timestamp: new Date().toISOString()
        };

        // Save to chat history for context
        appendChatHistory({ username, userId, originalMessage: messageToSend, timestamp: chatMessage.timestamp });

        // Translate for other users to their incoming language preference
        const targetLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'ru'];
        const uniqueLangs = [...new Set(targetLanguages)];

        for (const lang of uniqueLangs) {
          try {
            const translation = await translateText(messageToSend, lang, outgoingLanguage || 'auto');
            chatMessage.translations[lang] = translation;
          } catch (err) {
            console.error(`Failed to translate to ${lang}:`, err.message);
            chatMessage.translations[lang] = messageToSend;
          }
        }

        // Broadcast to all connected users
        broadcastMessage(chatMessage);

        console.log(`Message from ${username}: ${messageToSend}`);
      }

      // Handle translation request
      if (data.type === 'translate') {
        const { message: textToTranslate, targetLanguage } = data;
        const translation = await translateText(textToTranslate, targetLanguage);
        
        ws.send(JSON.stringify({
          type: 'translation-result',
          originalText: textToTranslate,
          translatedText: translation,
          targetLanguage
        }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (userId && username) {
      connectedUsers.delete(userId);
      broadcastUserList();
      broadcastMessage({
        type: 'system',
        username: 'System',
        message: `${username} left the chat`,
        timestamp: new Date().toISOString()
      });
      console.log(`${username} (${userId}) left the chat`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast message to all connected users
function broadcastMessage(message) {
  connectedUsers.forEach((user) => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify(message));
    }
  });
}

// Broadcast user list to all connected users
function broadcastUserList() {
  const userList = Array.from(connectedUsers.values()).map(user => ({
    userId: user.userId,
    username: user.username
  }));

  connectedUsers.forEach((user) => {
    if (user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(JSON.stringify({
        type: 'user-list',
        users: userList
      }));
    }
  });
}

// REST API endpoint to get online users
app.get('/api/users', (req, res) => {
  const users = Array.from(connectedUsers.values()).map(user => ({
    userId: user.userId,
    username: user.username
  }));
  res.json(users);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', connectedUsers: connectedUsers.size });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for connections`);
});
