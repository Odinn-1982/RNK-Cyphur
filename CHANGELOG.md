# Changelog

All notable changes to RNK Cyphur will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-12-22

### Changed
- **Deep Clean**: Removed all emojis from UI elements and source code for better compatibility.
- **Optimization**: Removed unused assets and sound files to reduce module size.
- **Code Cleanup**: Removed debug console logs and unused scripts.
- **Linting**: Codebase now passes strict linting rules.

## [1.0.0] - 2024-01-XX

### Added
- Initial release of RNK Cyphur
- **Core Features**
  - Real-time private messaging between users
  - Group chat functionality with GM-managed groups
  - Channel-based communications
  - Message delivery via Foundry VTT socket system

- **Message Features**
  - Message editing and deletion
  - Reply to messages with quote preview
  - Pin/unpin important messages
  - Emoji reactions on messages
  - Message search with result navigation
  - Typing indicators

- **User Interface**
  - Player Hub for conversation management
  - Individual chat windows with rich features
  - Favorites and mute functionality
  - Unread message badges
  - Online/offline status indicators

- **Themes**
  - 8 cyberpunk-inspired visual themes:
    - Neon (default cyan/blue)
    - Matrix (green hacker aesthetic)
    - Cyber (pink/purple synthwave)
    - Midnight (subtle professional blue)
    - Plasma (vibrant purple)
    - Hologram (translucent effects)
    - Quantum (soft pastel sci-fi)
    - Void (minimal dark mode)
  - Custom background image support

- **GM Tools**
  - Activity Monitor for viewing all communications
  - Group Manager for creating/editing groups
  - Moderation tools (clear chats, ban users)
  - Speaker selection for sending as NPCs
  - Data export functionality

- **Settings**
  - Sound effects with volume control
  - Desktop notification support
  - Compact mode option
  - Avatar visibility toggle
  - Enter-to-send configuration

- **Localization**
  - Full English language support
  - Localization framework for additional languages

### Technical
- Built on Foundry VTT v13 ApplicationV2 framework
- ES Modules architecture
- Socket-based real-time communication
- Handlebars templating system
- CSS custom properties for theming
