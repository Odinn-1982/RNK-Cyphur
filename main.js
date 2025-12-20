/**
 * RNK Cyphur - Encrypted Communications for Foundry VTT
 * Main entry point - handles version compatibility for v11, v12, v13
 */

// Import all modules
import { MODULE_ID, SOCKET_NAME, THEMES, DEFAULTS, SOUNDS } from './src/Constants.js';
import { Utils } from './src/Utils.js';
import { DataManager } from './src/DataManager.js';
import { SocketHandler } from './src/SocketHandler.js';
import { UIManager } from './src/UIManager.js';
import { RNKCyphur } from './src/RNKCyphur.js';
import { CyphurWindow } from './src/CyphurWindow.js';
import { PlayerHubWindow } from './src/PlayerHubWindow.js';
import { GroupManagerWindow } from './src/GroupManagerWindow.js';
import { GMMonitorWindow } from './src/GMMonitorWindow.js';
import { SettingsWindow } from './src/SettingsWindow.js';
import { GMModWindow } from './src/GMModWindow.js';

// ════════════════════════════════════════════════════════════════════════════
// LAZY LOADING INITIALIZATION
// ════════════════════════════════════════════════════════════════════════════

let _cyphurInitialized = false;

async function initializeCyphurIfNeeded() {
    if (_cyphurInitialized) return;
    _cyphurInitialized = true;

    console.log('🚀 Lazy loading Cyphur...');

    // Preload templates
    const templates = [
        `modules/${MODULE_ID}/templates/chat-window.hbs`,
        `modules/${MODULE_ID}/templates/group-manager.hbs`,
        `modules/${MODULE_ID}/templates/player-hub.hbs`,
        `modules/${MODULE_ID}/templates/settings-window.hbs`,
        `modules/${MODULE_ID}/templates/gm-monitor.hbs`,
        `modules/${MODULE_ID}/templates/gm-mod.hbs`
    ];
    
    const loadTemplatesFunc = foundry.applications?.handlebars?.loadTemplates || loadTemplates;
    await loadTemplatesFunc(templates);

    // Initialize core system
    RNKCyphur.initialize();

    // Apply global theme
    const globalTheme = game.settings.get(MODULE_ID, 'globalTheme') || 'neon';
    if (globalTheme && globalTheme !== 'none') {
        UIManager.applyTheme(globalTheme);
    }

    // Load personal background
    const bg = game.settings.get(MODULE_ID, 'personalBackground');
    if (bg) {
        window.RNKCyphurPersonalBackground = bg;
    }

    // Register hotbar button
    registerCyphurHotbarButton();

    // Refresh scene controls
    setTimeout(() => {
        if (ui.controls) {
            ui.controls.initialize();
        }
    }, 100);

    console.log('✅ Cyphur lazy loading complete');
}

function registerCyphurHotbarButton() {
    createFloatingButton();
    Hooks.on('renderHotbar', () => setTimeout(createFloatingButton, 100));
}

function createFloatingButton() {
    const existing = document.getElementById('cyphur-floating-btn');
    if (existing) return;

    const btn = document.createElement('div');
    btn.id = 'cyphur-floating-btn';
    btn.className = 'cyphur-floating-button';
    btn.innerHTML = '<i class="fas fa-lock"></i>';
    btn.title = 'Open Cyphur Encrypted Communications';
    btn.onclick = () => UIManager.openPlayerHub();
    
    const styles = btn.style;
    styles.position = 'fixed';
    styles.bottom = '20px';
    styles.left = '20px';
    styles.width = '50px';
    styles.height = '50px';
    styles.borderRadius = '50%';
    styles.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    styles.border = '2px solid rgba(255, 255, 255, 0.3)';
    styles.cursor = 'pointer';
    styles.zIndex = '1000';
    styles.display = 'flex';
    styles.alignItems = 'center';
    styles.justifyContent = 'center';
    styles.fontSize = '20px';
    styles.color = 'white';
    styles.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    styles.transition = 'all 0.3s ease';

    document.body.appendChild(btn);
}

// ════════════════════════════════════════════════════════════════════════════
// CODEX REGISTRATION (Top-level)
// ════════════════════════════════════════════════════════════════════════════

if (!globalThis.RNK_MODULES) globalThis.RNK_MODULES = [];
globalThis.RNK_MODULES.push({
    id: 'cyphur',
    name: 'Cyphur',
    icon: 'fa-lock',
    description: 'Encrypted Communications',
    onClick: async () => {
        await initializeCyphurIfNeeded();
        UIManager.openPlayerHub();
    }
});

// ════════════════════════════════════════════════════════════════════════════
// INIT HOOK - Settings Registration Only
// ════════════════════════════════════════════════════════════════════════════

Hooks.once('init', () => {
    console.log('Cyphur | Registering settings...');
    
    // Expose API
    window.RNKCyphur = RNKCyphur;
    window.RNKCyphurUIManager = UIManager;
    
    game.RNKCyphur = {
        open: async () => {
            await initializeCyphurIfNeeded();
            UIManager.openPlayerHub();
        },
        openGMPanel: async () => {
            await initializeCyphurIfNeeded();
            UIManager.openGMPanel();
        },
        RNKCyphur: RNKCyphur,
        UIManager: UIManager,
        DataManager: import('./DataManager.js').then(m => m.DataManager)
    };

    const module = game.modules.get(MODULE_ID);
    if (module) module.api = game.RNKCyphur;

    // ════════════════════════════════════════════════════════════════════════
    // WORLD SETTINGS (GM only can modify)
    // ════════════════════════════════════════════════════════════════════════

    game.settings.register(MODULE_ID, 'privateChats', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'groupChats', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'sharedBackgrounds', {
        name: 'Shared Backgrounds',
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'globalTheme', {
        name: 'CYPHUR.SettingGlobalTheme',
        hint: 'CYPHUR.SettingGlobalThemeHint',
        scope: 'world',
        config: true,
        type: String,
        choices: Object.fromEntries(
            [['none', 'None'], ...Object.entries(THEMES).map(([k, v]) => [k, v.name])]
        ),
        default: 'neon'
    });

    game.settings.register(MODULE_ID, 'gmOverrideEnabled', {
        name: 'CYPHUR.SettingGMOverride',
        hint: 'CYPHUR.SettingGMOverrideHint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, 'gmOverrideSoundPath', {
        name: 'CYPHUR.SettingGMOverrideSound',
        hint: 'CYPHUR.SettingGMOverrideSoundHint',
        scope: 'world',
        config: true,
        type: String,
        filePicker: 'audio',
        default: DEFAULTS.NOTIFICATION_SOUND
    });

    // ════════════════════════════════════════════════════════════════════════
    // CLIENT SETTINGS (Per user)
    // ════════════════════════════════════════════════════════════════════════

    game.settings.register(MODULE_ID, 'unreadData', {
        scope: 'client',
        config: false,
        type: Object,
        default: { counts: {}, lastRead: {} }
    });

    game.settings.register(MODULE_ID, 'favorites', {
        scope: 'client',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, 'mutedConversations', {
        scope: 'client',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, 'pinnedMessages', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'enableDesktopNotifications', {
        name: 'CYPHUR.SettingDesktopNotifications',
        hint: 'CYPHUR.SettingDesktopNotificationsHint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, 'enableSound', {
        name: 'CYPHUR.SettingEnableSound',
        hint: 'CYPHUR.SettingEnableSoundHint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'notificationSound', {
        name: 'CYPHUR.SettingNotificationSound',
        hint: 'CYPHUR.SettingNotificationSoundHint',
        scope: 'client',
        config: true,
        type: String,
        filePicker: 'audio',
        default: DEFAULTS.NOTIFICATION_SOUND
    });

    game.settings.register(MODULE_ID, 'notificationVolume', {
        name: 'CYPHUR.SettingNotificationVolume',
        hint: 'CYPHUR.SettingNotificationVolumeHint',
        scope: 'client',
        config: true,
        type: Number,
        range: { min: 0, max: 1, step: 0.1 },
        default: DEFAULTS.NOTIFICATION_VOLUME
    });

    game.settings.register(MODULE_ID, 'personalBackground', {
        name: 'CYPHUR.SettingPersonalBackground',
        hint: 'CYPHUR.SettingPersonalBackgroundHint',
        scope: 'client',
        config: true,
        type: String,
        filePicker: 'image',
        default: ''
    });

    game.settings.register(MODULE_ID, 'shareBackground', {
        name: 'CYPHUR.SettingShareBackground',
        hint: 'CYPHUR.SettingShareBackgroundHint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, 'theme', {
        name: 'CYPHUR.SettingTheme',
        hint: 'CYPHUR.SettingThemeHint',
        scope: 'client',
        config: true,
        type: String,
        choices: Object.fromEntries(
            [['none', 'None'], ...Object.entries(THEMES).map(([k, v]) => [k, v.name])]
        ),
        default: 'neon'
    });

    game.settings.register(MODULE_ID, 'chatBackgrounds', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'gmBackgrounds', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'playerSettings', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'gmSettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    // Register hooks for reactive settings
    Hooks.on('updateSetting', (setting) => {
        if (setting.key === `${MODULE_ID}.globalTheme` && _cyphurInitialized) {
            UIManager.applyTheme(setting.value);
        }
    });

    Hooks.on('getSceneControlButtons', (controls) => {
        if (!_cyphurInitialized) return;
        
        const cyphurControl = {
            name: 'cyphur',
            title: 'Cyphur Communications',
            icon: 'fas fa-lock',
            button: true,
            onClick: () => UIManager.openPlayerHub()
        };
        controls.push(cyphurControl);
    });

    Hooks.on('renderChatMessage', (message, html, data) => {
        if (!_cyphurInitialized) return;
        // Add any chat message processing here
    });
});

// ════════════════════════════════════════════════════════════════════════════
// VERSION DETECTION & COMPATIBILITY HELPERS (Exported for external use)
// ════════════════════════════════════════════════════════════════════════════
