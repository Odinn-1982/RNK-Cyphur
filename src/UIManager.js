/**
 * RNK Cyphur - UI Manager
 * Manages all UI windows and visual state
 */

import { DataManager } from './DataManager.js';
import { THEMES } from './Constants.js';

export class UIManager {
    // Window tracking
    static openPrivateChatWindows = new Map();
    static openGroupChatWindows = new Map();
    static gmMonitorWindow = null;
    static settingsWindow = null;
    static groupManagerWindow = null;
    static playerHubWindow = null;

    // ════════════════════════════════════════════════════════════════════════════
    // WINDOW OPENERS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Open the Player Hub window
     */
    static async openPlayerHub() {
        const { PlayerHubWindow } = await import('./PlayerHubWindow.js');
        const id = 'cyphur-player-hub';
        
        const existing = Object.values(ui.windows).find(w => w.id === id || w.appId === id);
        if (existing) {
            if (typeof existing.bringToTop === 'function') existing.bringToTop();
            return existing.render(true);
        }
        
        this.playerHubWindow = new PlayerHubWindow();
        return this.playerHubWindow.render(true);
    }

    /**
     * Open a private chat window
     * @param {string} userId - Other user's ID
     */
    static async openChatFor(userId) {
        const existingWindow = this.openPrivateChatWindows.get(userId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const chatKey = DataManager.getPrivateChatKey(game.user.id, userId);
        if (!DataManager.privateChats.has(chatKey)) {
            DataManager.privateChats.set(chatKey, {
                users: [game.user.id, userId],
                history: []
            });
        }

        const { CyphurWindow } = await import('./CyphurWindow.js');
        const window = new CyphurWindow({ otherUserId: userId });
        this.openPrivateChatWindows.set(userId, window);
        return window.render(true);
    }

    /**
     * Open a group chat window
     * @param {string} groupId - Group ID
     */
    static async openGroupChat(groupId) {
        const group = DataManager.groupChats.get(groupId);
        if (!group) return;
        
        // Allow GMs to view any group
        const isMember = group.members.includes(game.user.id);
        if (!isMember && !game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.NotMember'));
        }
        
        const existingWindow = this.openGroupChatWindows.get(groupId);
        if (existingWindow?.rendered) return existingWindow.render(true);

        const { CyphurWindow } = await import('./CyphurWindow.js');
        const window = new CyphurWindow({ groupId: groupId });
        this.openGroupChatWindows.set(groupId, window);
        return window.render(true);
    }

    /**
     * Open the Group Manager window (GM only)
     */
    static async openGroupManager() {
        if (!game.user.isGM) {
            return ui.notifications.error(game.i18n.localize('CYPHUR.GMOnlyTool'));
        }
        
        const { GroupManagerWindow } = await import('./GroupManagerWindow.js');
        const id = 'cyphur-group-manager';
        
        if (Object.values(ui.windows).find(w => w.id === id)) return;
        
        this.groupManagerWindow = new GroupManagerWindow();
        return this.groupManagerWindow.render(true);
    }

    /**
     * Open the GM Monitor window
     */
    static async openGMMonitor() {
        if (!game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.NoPermission'));
        }
        
        if (this.gmMonitorWindow?.rendered) {
            return this.gmMonitorWindow.bringToTop();
        }

        const { GMMonitorWindow } = await import('./GMMonitorWindow.js');
        this.gmMonitorWindow = new GMMonitorWindow();
        return this.gmMonitorWindow.render(true);
    }

    /**
     * Open the Settings window
     */
    static async openSettingsWindow() {
        const { SettingsWindow } = await import('./SettingsWindow.js');
        const id = 'cyphur-settings-window';
        
        const existing = Object.values(ui.windows).find(w => w.id === id);
        if (existing) return existing.bringToTop();
        
        this.settingsWindow = new SettingsWindow();
        return this.settingsWindow.render(true);
    }

    /**
     * Open the GM Moderation window
     */
    static async openGMModWindow() {
        if (!game.user.isGM) {
            return ui.notifications.warn(game.i18n.localize('CYPHUR.OnlyGMsAccessModeration'));
        }
        
        const { GMModWindow } = await import('./GMModWindow.js');
        const id = 'cyphur-gm-mod-window';
        
        const existing = Object.values(ui.windows).find(w => w.id === id);
        if (existing) return existing.bringToTop();
        
        new GMModWindow().render(true);
    }

    /**
     * Open GM Panel (alias for openGMMonitor for API compatibility)
     */
    static async openGMPanel() {
        return this.openGMMonitor();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // WINDOW UPDATES
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Update a chat window (only if already open)
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static updateChatWindow(id, type) {
        if (type === 'private') {
            const existingWindow = this.openPrivateChatWindows.get(id);
            if (existingWindow?.rendered) {
                // Ensure new messages scroll to bottom
                existingWindow._shouldScrollToBottom = true;
                existingWindow.render(false);
            }
        } else {
            const existingWindow = this.openGroupChatWindows.get(id);
            if (existingWindow?.rendered) {
                // Ensure new messages scroll to bottom
                existingWindow._shouldScrollToBottom = true;
                existingWindow.render(false);
            }
        }
    }

    /**
     * Update typing indicator in a window
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static updateTypingIndicator(id, type) {
        const window = type === 'private'
            ? this.openPrivateChatWindows.get(id)
            : this.openGroupChatWindows.get(id);
            
        if (window?.rendered && typeof window.updateTypingIndicator === 'function') {
            window.updateTypingIndicator();
        }
    }

    /**
     * Open chat window for new message (auto-open on incoming)
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static openChatWindowForNewMessage(id, type) {
        if (type === 'private') {
            this.openChatFor(id);
        } else {
            this.openGroupChat(id);
        }
    }

    /**
     * Close a chat window
     * @param {string} id - User ID or Group ID
     * @param {string} type - 'private' or 'group'
     */
    static closeChatWindow(id, type) {
        const window = type === 'private'
            ? this.openPrivateChatWindows.get(id)
            : this.openGroupChatWindows.get(id);
            
        if (window) {
            window.close();
            if (type === 'private') {
                this.openPrivateChatWindows.delete(id);
            } else {
                this.openGroupChatWindows.delete(id);
            }
        }
    }

    /**
     * Update the Player Hub window
     */
    static updatePlayerHub() {
        const playerHub = Object.values(ui.windows).find(w => w.id === 'cyphur-player-hub');
        if (playerHub?.rendered) playerHub.render(true);
    }

    /**
     * Update the Group Manager window
     */
    static updateGroupManager() {
        const groupManager = Object.values(ui.windows).find(w => w.id === 'cyphur-group-manager');
        if (groupManager?.rendered) groupManager.render(true);
    }

    /**
     * Update the GM Monitor window
     */
    static updateGMMonitor() {
        if (this.gmMonitorWindow?.rendered) {
            console.debug('Cyphur | Updating GM Monitor');
            this.gmMonitorWindow.render(true);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // THEMING
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Apply a theme to the document
     * @param {string} theme - Theme key
     */
    static applyTheme(theme) {
        // Remove existing cyphur theme classes
        const classes = Array.from(document.documentElement.classList)
            .filter(c => c.startsWith('cyphur-theme-'));
        classes.forEach(c => document.documentElement.classList.remove(c));
        
        // Add new theme class
        if (theme && theme !== 'none' && THEMES[theme]) {
            document.documentElement.classList.add(THEMES[theme].class);
        }
    }

    /**
     * Get available themes
     * @returns {object}
     */
    static getThemes() {
        return THEMES;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BACKGROUNDS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Update background for a user across all relevant windows
     * @param {string} userId - User ID
     * @param {string} path - Background image path
     */
    static updateBackgroundForUser(userId, path) {
        if (!userId) return;
        
        if (path) {
            DataManager.setSharedBackground(userId, path);
        } else {
            DataManager.setSharedBackground(userId, null);
        }

        // Apply to private chat windows with this user
        for (const [user, win] of this.openPrivateChatWindows.entries()) {
            if (win?.rendered && user === userId) {
                this.applyBackgroundToWindow(win, path);
            }
        }

        // Apply to group windows where this user is a member
        for (const [groupId, win] of this.openGroupChatWindows.entries()) {
            const group = DataManager.groupChats.get(groupId);
            if (group?.members?.includes(userId)) {
                this.applyBackgroundToWindow(win, path);
            }
        }

        // Apply to player hub
        const playerHub = Object.values(ui.windows).find(w => w.id === 'cyphur-player-hub');
        if (playerHub?.rendered) {
            try { this.applyBackgroundToWindow(playerHub, path); } catch (e) { /* ignore */ }
        }

        // Refresh GM Monitor
        if (this.gmMonitorWindow?.rendered) {
            try { this.gmMonitorWindow.render(false); } catch (e) { /* ignore */ }
        }
    }

    /**
     * Apply a background image to a window
     * @param {object} win - Window instance
     * @param {string} path - Background image path
     */
    static applyBackgroundToWindow(win, path) {
        if (!win?.element) return;
        
        const container = win.element.querySelector('.cyphur-chat-container, .cyphur-hub-container');
        if (!container) return;
        
        if (path) {
            const overlay = 'linear-gradient(rgba(0, 10, 20, 0.75), rgba(0, 10, 20, 0.85))';
            container.style.backgroundImage = `${overlay}, url('${path}')`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundRepeat = 'no-repeat';
            container.style.backgroundPosition = 'center';
        } else {
            container.style.backgroundImage = '';
            container.style.removeProperty('background-size');
            container.style.removeProperty('background-repeat');
            container.style.removeProperty('background-position');
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // NOTIFICATIONS UI
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Update the hotbar notification badge
     */
    static updateHotbarBadge() {
        const total = DataManager.getTotalUnread();
        const badge = document.querySelector('.cyphur-hotbar-badge');
        
        if (badge) {
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'info', 'warn', 'error'
     */
    static showToast(message, type = 'info') {
        ui.notifications[type](message);
    }
}
