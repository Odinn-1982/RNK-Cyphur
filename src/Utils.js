/**
 * RNK Cyphur - Utility Functions
 * Helper methods for common operations throughout the module
 */

import { MODULE_ID } from './Constants.js';

export class Utils {
    
    /**
     * Format timestamp as relative time (e.g., "5m ago", "2h ago", "Yesterday")
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted relative time
     */
    static formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return game.i18n.localize('CYPHUR.TimeJustNow');
        if (minutes < 60) return game.i18n.format('CYPHUR.TimeMinutesAgo', { count: minutes });
        if (hours < 24) return game.i18n.format('CYPHUR.TimeHoursAgo', { count: hours });
        if (days === 1) return game.i18n.localize('CYPHUR.TimeYesterday');
        if (days < 7) return game.i18n.format('CYPHUR.TimeDaysAgo', { count: days });
        
        // For older messages, show the date
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    }

    /**
     * Format timestamp as full date and time
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted date and time
     */
    static formatFullTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    /**
     * Get user initials for avatar fallback
     * @param {string} name - User name
     * @returns {string} User initials (max 2 characters)
     */
    static getUserInitials(name) {
        if (!name) return '?';
        const words = name.trim().split(/\s+/);
        if (words.length === 1) {
            return words[0].substring(0, 2).toUpperCase();
        }
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    /**
     * Parse mentions in message content (@username)
     * @param {string} content - Message content
     * @returns {Array} Array of mentioned user IDs
     */
    static parseMentions(content) {
        if (!content) return [];
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(content)) !== null) {
            const username = match[1];
            const user = game.users.find(u => u.name.toLowerCase() === username.toLowerCase());
            if (user) mentions.push(user.id);
        }
        
        return [...new Set(mentions)];
    }

    /**
     * Highlight mentions in message content
     * @param {string} content - Message content
     * @returns {string} HTML with highlighted mentions
     */
    static highlightMentions(content) {
        if (!content) return content;
        
        const mentionRegex = /@(\w+)/g;
        return content.replace(mentionRegex, (match, username) => {
            const user = game.users.find(u => u.name.toLowerCase() === username.toLowerCase());
            if (user) {
                const isCurrentUser = user.id === game.user.id;
                const className = isCurrentUser ? 'cyphur-mention cyphur-mention-me' : 'cyphur-mention';
                const safeName = this.sanitizeHTML(user.name || '');
                return `<span class="${className}" data-user-id="${user.id}">@${safeName}</span>`;
            }
            return match;
        });
    }

    /**
     * Check if a message was sent by the current user
     * @param {string} senderId - Message sender ID
     * @returns {boolean}
     */
    static isOwnMessage(senderId) {
        return senderId === game.user.id;
    }

    /**
     * Get user avatar URL or generate initials object
     * @param {string} userId - User ID
     * @returns {object} {type: 'image'|'initials', value: string}
     */
    static getUserAvatar(userId) {
        const user = game.users.get(userId);
        if (!user) return { type: 'initials', value: '?' };
        
        if (user.avatar && user.avatar !== 'icons/svg/mystery-man.svg') {
            return { type: 'image', value: user.avatar };
        }
        
        return { type: 'initials', value: this.getUserInitials(user.name) };
    }

    /**
     * Sanitize HTML to prevent XSS
     * @param {string} html - Raw HTML string
     * @returns {string} Sanitized HTML
     */
    static sanitizeHTML(html) {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }

    /**
     * Check if user is online
     * @param {string} userId - User ID
     * @returns {boolean}
     */
    static isUserOnline(userId) {
        const user = game.users.get(userId);
        return user ? user.active : false;
    }

    /**
     * Parse rich content in messages (URLs, dice rolls, etc.)
     * @param {string} content - Raw message content
     * @returns {string} Enriched HTML content
     */
    static parseRichContent(content) {
        if (!content) return content;
        
        // First sanitize
        let enriched = this.sanitizeHTML(content);
        
        // Parse URLs into clickable links
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        enriched = enriched.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener" class="cyphur-link">$1</a>');
        
        // Parse dice notation [[1d20]] style
        const diceRegex = /\[\[([^\]]+)\]\]/g;
        enriched = enriched.replace(diceRegex, '<span class="cyphur-dice-roll" data-formula="$1">🎲 $1</span>');
        
        // Parse item links @Item[name]
        const itemLinkRegex = /@Item\[([^\]]+)\]/g;
        enriched = enriched.replace(itemLinkRegex, '<span class="cyphur-item-link" data-name="$1">📦 $1</span>');
        
        // Parse actor links @Actor[name]
        const actorLinkRegex = /@Actor\[([^\]]+)\]/g;
        enriched = enriched.replace(actorLinkRegex, '<span class="cyphur-actor-link" data-name="$1">👤 $1</span>');
        
        // Parse line breaks
        enriched = enriched.replace(/\n/g, '<br>');
        
        return enriched;
    }

    /**
     * Format reply preview text
     * @param {object} message - The message being replied to
     * @returns {object} { senderName, preview }
     */
    static formatReplyQuote(message) {
        if (!message) return null;
        
        const senderUser = game.users.get(message.senderId);
        const senderName = message.senderName || senderUser?.name || 'Unknown';
        
        // Truncate preview to reasonable length
        let preview = (message.messageContent || '').replace(/<[^>]*>/g, '').substring(0, 80);
        if (message.messageContent && message.messageContent.length > 80) {
            preview += '...';
        }
        
        return { senderName, preview, messageId: message.id };
    }

    /**
     * Show desktop notification if enabled
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {string} icon - Icon URL
     */
    static showDesktopNotification(title, body, icon) {
        try {
            if (!game.settings.get(MODULE_ID, 'enableDesktopNotifications')) return;
            if (document.hasFocus()) return;
            
            if (Notification.permission === 'granted') {
                new Notification(title, { body, icon, tag: MODULE_ID });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, { body, icon, tag: MODULE_ID });
                    }
                });
            }
        } catch (e) {
            console.debug('Cyphur | Desktop notifications not supported');
        }
    }

    /**
     * Create a debounced function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function}
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Create a throttled function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in ms
     * @returns {Function}
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Generate a unique color for a user based on their ID (for visual identification)
     * @param {string} userId - User ID
     * @returns {string} HSL color string
     */
    static getUserColor(userId) {
        if (!userId) return 'hsl(0, 70%, 60%)';
        
        // Generate a hash from the user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        // Use the hash to generate a hue (0-360)
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    /**
     * Play notification sound
     * @param {string} soundPath - Path to sound file
     * @param {number} volume - Volume level (0-1)
     */
    static playSound(soundPath, volume = 0.8) {
        try {
            foundry.audio.AudioHelper.play({
                src: soundPath,
                volume: volume,
                autoplay: true,
                loop: false
            }, false);
        } catch (e) {
            console.warn('Cyphur | Failed to play sound:', e);
        }
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>}
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            console.warn('Cyphur | Failed to copy to clipboard:', e);
            return false;
        }
    }

    /**
     * Export messages to a text file
     * @param {Array} messages - Array of message objects
     * @param {string} filename - Name for the exported file
     */
    static exportMessages(messages, filename = 'cyphur-export.txt') {
        if (!messages || messages.length === 0) {
            ui.notifications.warn(game.i18n.localize('CYPHUR.ExportNoMessages'));
            return;
        }

        const lines = messages.map(msg => {
            const time = this.formatFullTimestamp(msg.timestamp);
            const sender = msg.senderName || 'Unknown';
            const content = (msg.messageContent || '').replace(/<[^>]*>/g, '');
            return `[${time}] ${sender}: ${content}`;
        });

        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        
        ui.notifications.info(game.i18n.localize('CYPHUR.ExportSuccess'));
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size string
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
