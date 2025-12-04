# RNK Cyphur

> **Encrypted Communications for Foundry VTT**

A next-generation private messaging and chat management module for Foundry Virtual Tabletop. Cyphur provides secure, real-time communication channels with a sleek cyberpunk aesthetic.

![Foundry VTT](https://img.shields.io/badge/Foundry-v13-informational)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### 💬 Private Messaging
- Real-time private conversations between any two users
- Typing indicators show when others are composing messages
- Message editing and deletion
- Reply to specific messages with quote preview
- Pin important messages for easy reference

### 👥 Group Chats
- Create custom groups with any combination of players
- GM-managed group creation and membership
- Group-specific notification settings
- All members see messages in real-time

### 📢 Channels
- Public channels visible to all users (or GM-only)
- Organized topic-based discussions
- Persistent message history

### 🎨 Cyberpunk Themes
Choose from 8 stunning visual themes:
- **Neon** - Classic cyan/blue cyberpunk
- **Matrix** - Green-on-black hacker aesthetic
- **Cyber** - Hot pink and purple synthwave
- **Midnight** - Subtle blue professional look
- **Plasma** - Vibrant purple energy
- **Hologram** - Translucent holographic display
- **Quantum** - Soft pastel sci-fi
- **Void** - Minimal ultra-dark mode

### 🔍 Advanced Features
- **Message Search** - Find messages with navigation between results
- **Reactions** - Add emoji reactions to messages
- **Favorites** - Star important conversations for quick access
- **Mute** - Silence notifications from specific chats
- **Custom Backgrounds** - Set your own chat background images
- **Desktop Notifications** - Get browser alerts for new messages
- **Quantum Portal** - Pop out windows to separate browser windows for multi-monitor setups

### 🛡️ GM Tools
- **Activity Monitor** - View all player communications in real-time
- **Group Manager** - Create and manage chat groups
- **Moderation Tools** - Clear chats, manage banned users, export data
- **Speaker Selection** - Send messages as NPCs/characters

## Installation

### Method 1: Manifest URL
1. Open Foundry VTT and navigate to **Add-on Modules**
2. Click **Install Module**
3. Paste the manifest URL:
   ```
   https://github.com/yourusername/rnk-cyphur/releases/latest/download/module.json
   ```
4. Click **Install**

### Method 2: Manual Installation
1. Download the latest release from GitHub
2. Extract to your `Data/modules/` folder
3. The folder should be named `rnk-cyphur`
4. Restart Foundry VTT

## Setup

1. **Enable the Module**
   - Go to **Game Settings** → **Manage Modules**
   - Check **RNK Cyphur**
   - Click **Save Module Settings**

2. **Access the Hub**
   - Click the **Cyphur** button in the hotbar/controls
   - Or use the configurable hotkey

3. **Configure Settings**
   - Open Settings from the Hub
   - Choose your theme
   - Configure notification preferences
   - Adjust sound settings

## Usage Guide

### Starting a Conversation
1. Open the Cyphur Hub
2. Click **New Chat** or click on a user in the Players section
3. Type your message and press Enter (or click Send)

### Creating a Group (GM Only)
1. Open the Group Manager from the GM Tools
2. Click **Create New Group**
3. Enter a name and select members
4. Click **Create Group**

### Searching Messages
1. Open any chat window
2. Click the search icon in the header
3. Type your search query
4. Use Previous/Next buttons to navigate results

### Using Reactions
1. Hover over any message
2. Click the reaction button (emoji icon)
3. Select an emoji to react
4. Click again to remove your reaction

### GM Monitoring
1. Click the Monitor icon in GM Tools
2. View real-time feed of all communications
3. Filter by type (private/group/channel)
4. Filter by specific users
5. Export logs for record-keeping

## Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| Theme | Visual theme selection | Neon |
| Enable Sounds | Play notification sounds | Enabled |
| Sound Volume | Volume level (0-100) | 50 |
| Desktop Notifications | Browser notifications | Enabled |
| Enter to Send | Send on Enter key | Enabled |
| Show Avatars | Display user avatars | Enabled |
| Compact Mode | Condensed message layout | Disabled |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Send message |
| Shift + Enter | New line |
| Escape | Close window |
| Ctrl + F | Toggle search |

## API Reference

### Hooks

```javascript
// Fired when a message is received
Hooks.on('cyphurMessageReceived', (message) => {
    console.log('New message:', message);
});

// Fired when a message is sent
Hooks.on('cyphurMessageSent', (message) => {
    console.log('Message sent:', message);
});
```

### Global Access

```javascript
// Access the main module instance
const cyphur = game.modules.get('rnk-cyphur')?.api;

// Send a private message programmatically
cyphur?.sendMessage(targetUserId, 'Hello!');

// Open the hub
cyphur?.ui?.openHub();
```

## Compatibility

- **Foundry VTT Version:** v13+ (minimum v13.0)
- **System Compatibility:** All systems
- **Module Conflicts:** None known

## Localization

RNK Cyphur supports multiple languages. Currently available:
- English (en)

Want to help translate? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Credits

- **Author:** RNK Development Team
- **Inspired by:** RNK Runar

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/rnk-cyphur/issues)
- **Discord:** [Join our server](#)

## License

This module is licensed under the [MIT License](LICENSE).

---

## Changelog

### v1.0.0 (Initial Release)
- Private messaging with real-time delivery
- Group chat functionality
- 8 cyberpunk themes
- Message search, reactions, and pinning
- GM monitoring and moderation tools
- Desktop notifications
- Custom backgrounds
- Comprehensive settings panel

---

*"In the shadows of the digital realm, your messages travel encrypted and unseen."*
