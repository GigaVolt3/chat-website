# Global Chat Website

A real-time chat application with AI-powered message translation using Groq API. Users from around the world can chat together, and all messages are automatically translated to multiple languages.

## Features

✨ **Real-time Chat**
- WebSocket-based communication for instant messaging
- Multiple users can chat simultaneously
- See all online users in the sidebar

🌐 **Automatic Translation**
- Messages automatically translated to 5 languages (English, Spanish, French, German, Chinese)
- Powered by Groq AI (Mixtral model)
- Click on messages to view all available translations

💾 **Persistent Username**
- Usernames are saved in browser localStorage
- No need to enter username every time you visit
- Quick reconnection for returning users

👥 **User Management**
- Real-time online user list
- User count indicator
- Join/Leave notifications

📱 **Responsive Design**
- Beautiful gradient UI with smooth animations
- Works on desktop, tablet, and mobile devices
- Real-time connection status indicator

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Groq API Key (included in `.env`)

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory with:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   PORT=3000
   ```
   - Get your Groq API key from [https://console.groq.com](https://console.groq.com)

3. **Start the server**
   ```bash
   npm start
   ```

4. **Access the application**
   Open your browser and go to `http://localhost:3000`

## How to Use

### Creating a Username
1. Enter your desired username (2-20 characters)
2. Select your preferred language
3. Click "Join Chat"
4. Your username will be saved automatically

### Sending Messages
1. Type your message in the input field at the bottom
2. Press Enter or click the Send button
3. Your message will be automatically translated to all users

### Viewing Translations
1. Click on any message to see all available translations
2. A modal will pop up showing translations in:
   - English
   - Spanish
   - French
   - German
   - Chinese

### Managing Your Presence
- Your username appears in the online users list
- You'll see when users join or leave
- Click "Leave Chat" to disconnect

## Technical Stack

**Backend**
- Express.js - Web server
- WebSocket (ws) - Real-time communication
- Axios - HTTP client
- dotenv - Environment variables

**Frontend**
- Vanilla JavaScript (no frameworks)
- HTML5
- CSS3 with animations
- WebSocket API

**AI & Translation**
- Groq API - AI-powered translation
- Mixtral-8x7b-32768 model

## API Endpoints

### WebSocket Messages

**Join Chat**
```json
{
  "type": "join",
  "userId": "unique_id",
  "username": "username"
}
```

**Send Message**
```json
{
  "type": "chat",
  "message": "Your message here",
  "language": "en"
}
```

**Receive Message**
```json
{
  "type": "chat",
  "username": "sender",
  "userId": "sender_id",
  "originalMessage": "Original text",
  "translations": {
    "en": "English translation",
    "es": "Spanish translation",
    "fr": "French translation",
    "de": "German translation",
    "zh": "Chinese translation"
  },
  "timestamp": "ISO8601 timestamp"
}
```

### REST Endpoints

- `GET /api/users` - Get list of online users
- `GET /health` - Server health check

## Project Structure

```
chat website/
├── server.js              # Express/WebSocket server
├── package.json           # Dependencies
├── .env                   # Environment variables
└── public/
    ├── index.html         # Main HTML file
    ├── styles.css         # Styling
    └── client.js          # Client-side JavaScript
```

## Features Explained

### Real-time Communication
- Uses WebSocket for bidirectional communication
- Messages are instantly delivered to all connected users
- Connection status indicator shows if you're connected

### Automatic Translation
- Every message is translated to 5 languages using Groq AI
- Language detection to identify the original message language
- Users can view all translations by clicking on a message

### Persistent Storage
- Username is saved in browser's localStorage
- Automatically loads on next visit
- No account creation needed

### User-Friendly UI
- Clean, modern interface with gradient colors
- Smooth animations and transitions
- Responsive design for all devices
- Easy-to-use user list and message history

## Security Notes

- Messages are not stored on the server permanently
- User IDs are generated locally
- Input is sanitized to prevent XSS attacks
- HTTPS recommended for production use

## Future Enhancements

- [ ] User authentication system
- [ ] Message history/persistence
- [ ] Private messages
- [ ] User profiles with avatars
- [ ] Emoji support
- [ ] File sharing
- [ ] Voice messages
- [ ] Dark mode
- [ ] Message reactions/emojis
- [ ] User blocking/moderation

## Troubleshooting

**Connection issues?**
- Check if server is running on port 3000
- Ensure WebSocket connection is allowed
- Check browser console for error messages

**Translation not working?**
- Verify Groq API key in `.env` is correct
- Check if API quota is exceeded
- Wait a moment as translations can take time

**Username not saving?**
- Check if localStorage is enabled
- Clear browser cache and try again
- Check browser console for errors

## License

MIT License - Feel free to use and modify

## Support

For issues and questions, check the server logs and browser console for error messages.
