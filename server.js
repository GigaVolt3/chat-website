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
            content: `Context-Aware, Iterative, Style-Locked, Meaning-Preserved Translator

You are a translation engine for a chat application.
Your task is to translate messages while preserving:
- meaning
- tone
- slang level
- formality
- emotional temperature
- context of casual conversation
- the "vibe" of the message
- the user's intention

You must NOT normalize or rewrite messages.

Before producing a translation, you MUST internally run a self-iteration step to identify:
- The style (casual, formal, meme, rude, joking, ironic, depressing, excited, bored, chaotic)
- The social temperature (friendly, close friend vibe, stranger vibe, playful, annoyed)
- The conversational intention (greeting, teasing, checking in, complaining, flirting, joking)
- The language register (slang, internet speak, shorthand, abbreviations, incorrect spelling)
- The correct equivalent tone in the target language

After this internal understanding, you must translate the message without changing its meaning or style.

RULES:
1. Meaning must stay EXACT. Tone must stay EXACT. Slang must stay EXACT.
2. If the user writes "bored", DO NOT translate to "boredom". If "wassup", DO NOT translate to "what's up". Match intensity, slang level, youth tone, and emotional energy.
3. Do NOT: add politeness, fix grammar, fix spelling, rewrite slang, expand shorthand, make text more formal, make text more natural, improve the meaning.
4. Only output the translation. No explanations, no alternative versions, no reasoning, no notes.

Always perform the internal style-meaning iteration loop to understand the text's intention and tone BEFORE translating.`
          },
          {
            role: 'user',
            content: `Translate this text to ${targetLangName} (${targetLanguage}). Only output the translation, no explanations:\n\n${text}`
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
    
    // Remove thinking tags and content (for models that use extended thinking)
    result = result.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').trim();
    
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
        // store user's preferred incoming language if provided (what they want to RECEIVE in)
        const userLang = data.myLanguage || 'en';
        connectedUsers.set(userId, {
          ws,
          username,
          userId,
          myLanguage: userLang
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

        // Translate only to the languages that connected users actually want to receive in.
        // Build a set of unique target languages from connected users' preferences.
        const languagesNeeded = new Set();
        connectedUsers.forEach(u => {
          if (u && u.myLanguage) languagesNeeded.add(u.myLanguage);
        });

        // If incomingLanguage was provided by sender (as a preference), include as fallback
        if (chatMessage.incomingLanguage && chatMessage.incomingLanguage !== 'auto') {
          languagesNeeded.add(chatMessage.incomingLanguage);
        }

        const uniqueLangs = [...languagesNeeded];

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

      // Handle settings updates from client (e.g., preferred incoming language)
      if (data.type === 'update-settings') {
        const { myLanguage: newLang } = data;
        if (userId && connectedUsers.has(userId)) {
          const user = connectedUsers.get(userId);
          user.myLanguage = newLang || user.myLanguage || 'en';
          connectedUsers.set(userId, user);
          // Optionally broadcast updated user list
          broadcastUserList();
        }
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