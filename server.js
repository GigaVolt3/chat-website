const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const axios = require('axios');
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

// Store connected users
const connectedUsers = new Map();

// Groq API translation function with auto-correct and context improvement
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

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the text accurately to the target language. Apply auto-correct for grammar and spelling. Only provide the translation, nothing else. Do not add any explanations or notes.'
          },
          {
            role: 'user',
            content: `Translate this text to ${targetLangName} (${targetLanguage}). Fix any grammar/spelling issues. Only output the translation, no explanations:\n\n${text}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let result = response.data.choices[0].message.content.trim();
    
    // Remove common explanation patterns that Groq might add
    result = result.replace(/\(No changes needed.*?\)/gi, '').trim();
    result = result.replace(/\(Already in .*?\)/gi, '').trim();
    result = result.replace(/Translation:?\s*/gi, '').trim();
    
    return result;
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
            content: 'You are a language detection expert. Respond with ONLY the 2-letter language code (e.g., en, es, fr, de, zh, ja, pt, ru). Nothing else.'
          },
          {
            role: 'user',
            content: `What language is this text in? Respond with only the code:\n\n${text}`
          }
        ],
        temperature: 0.1,
        max_tokens: 5
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
