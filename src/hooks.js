/**
 * RNK Cyphur - Hooks System
 * Foundry VTT hook registrations and initialization
 */

import { RNKCyphur } from './RNKCyphur.js';
import { UIManager } from './UIManager.js';
import { MODULE_ID, DEFAULTS, THEMES } from './Constants.js';

// ════════════════════════════════════════════════════════════════════════════
// INIT HOOK - Register settings and preload templates
// ════════════════════════════════════════════════════════════════════════════

Hooks.once('init', () => {
    console.log('Cyphur | Initializing encrypted communications module...');
    
    // Expose API
    window.RNKCyphur = RNKCyphur;
    window.RNKCyphurUIManager = UIManager;
    
    // Simplified API
    game.RNKCyphur = {
        open: () => UIManager.openPlayerHub(),
        openGMPanel: () => UIManager.openGMPanel(),
        RNKCyphur: RNKCyphur,
        UIManager: UIManager
    };

    // Preload templates
    const templates = [
        `modules/${MODULE_ID}/templates/chat-window.hbs`,
        `modules/${MODULE_ID}/templates/group-manager.hbs`,
        `modules/${MODULE_ID}/templates/player-hub.hbs`,
        `modules/${MODULE_ID}/templates/settings-window.hbs`,
        `modules/${MODULE_ID}/templates/gm-monitor.hbs`,
        `modules/${MODULE_ID}/templates/gm-mod.hbs`
    ];
    
    // Version-compatible template loading
    const loadTemplatesFunc = foundry.applications?.handlebars?.loadTemplates || loadTemplates;
    loadTemplatesFunc(templates)
        .then(() => console.debug('Cyphur | Templates preloaded'))
        .catch(err => console.warn('Cyphur | Error preloading templates', err));

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

    // ════════════════════════════════════════════════════════════════════════
    // ADDITIONAL CLIENT SETTINGS (Hidden - managed through Hub)
    // ════════════════════════════════════════════════════════════════════════

    game.settings.register(MODULE_ID, 'playerSettings', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'chatBackgrounds', {
        scope: 'client',
        config: false,
        type: Object,
        default: {}
    });

    // ════════════════════════════════════════════════════════════════════════
    // GM-ONLY WORLD SETTINGS (Hidden)
    // ════════════════════════════════════════════════════════════════════════

    game.settings.register(MODULE_ID, 'gmSettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, 'gmBackgrounds', {
        scope: 'world',
        config: false,
        type: Object,
        default: {
            global: null,
            perUser: {},
            perChat: {}
        }
    });
});

// ════════════════════════════════════════════════════════════════════════════
// READY HOOK - Initialize module
// ════════════════════════════════════════════════════════════════════════════

Hooks.once('ready', () => {
    RNKCyphur.initialize();

    // Apply global theme
    const globalTheme = game.settings.get(MODULE_ID, 'globalTheme') || 'neon';
    if (globalTheme && globalTheme !== 'none') {
        UIManager.applyTheme(globalTheme);
    }

    // Store personal background reference
    const bg = game.settings.get(MODULE_ID, 'personalBackground');
    if (bg) {
        window.RNKCyphurPersonalBackground = bg;
    }

    // Register hotbar button
    registerCyphurHotbarButton();
    
    console.log('Cyphur | Ready for encrypted communications!');
});

// ════════════════════════════════════════════════════════════════════════════
// HOTBAR BUTTON INJECTION
// ════════════════════════════════════════════════════════════════════════════

function registerCyphurHotbarButton() {
    Hooks.on('renderHotbar', () => injectCyphurHotbarSlot());
    injectCyphurHotbarSlot();
}

function injectCyphurHotbarSlot() {
    // Only inject on page 1
    const currentPage = ui.hotbar?.page ?? ui.hotbar?._page ?? 1;
    if (currentPage !== 1) return;

    const slot = document.querySelector('#hotbar .slot[data-slot="8"]');
    if (!slot) return;

    // Check if already injected
    if (slot.classList.contains('cyphur-injected')) return;

    slot.classList.add('cyphur-injected');
    slot.innerHTML = `
        <div class="cyphur-hotbar-btn" title="Open Cyphur Communications">
            <i class="fas fa-satellite-dish"></i>
            <span class="cyphur-hotbar-badge" style="display:none;">0</span>
        </div>
    `;

    slot.style.cursor = 'pointer';
    slot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        UIManager.openPlayerHub();
    });

    // Update badge
    updateHotbarBadge();
}

function updateHotbarBadge() {
    import('./DataManager.js').then(({ DataManager }) => {
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
    });
}

// Update badge when unread counts change
Hooks.on('updateSetting', (setting) => {
    if (setting.key === `${MODULE_ID}.unreadData`) {
        updateHotbarBadge();
    }
});

// ════════════════════════════════════════════════════════════════════════════
// SCENE CONTROLS - Add Cyphur button to the sidebar layers
// ════════════════════════════════════════════════════════════════════════════

Hooks.on('getSceneControlButtons', (controls) => {
    // Add Cyphur as its own control layer at the end
    controls.push({
        name: 'cyphur',
        title: 'CYPHUR.OpenCyphur',
        icon: 'fas fa-satellite-dish',
        layer: 'controls',
        visible: true,
        tools: [
            {
                name: 'openHub',
                title: 'CYPHUR.Hub.Title',
                icon: 'fas fa-comments',
                button: true,
                onClick: () => UIManager.openPlayerHub()
            },
            {
                name: 'newChat',
                title: 'CYPHUR.Buttons.NewChat',
                icon: 'fas fa-plus',
                button: true,
                onClick: () => {
                    // Open user selection dialog
                    const users = game.users.filter(u => u.id !== game.user.id && u.active);
                    if (users.length === 0) {
                        ui.notifications.warn(game.i18n.localize('CYPHUR.NoUsersOnline'));
                        return;
                    }
                    new Dialog({
                        title: game.i18n.localize('CYPHUR.Buttons.NewChat'),
                        content: `<div class="cyphur-user-select">
                            <p>${game.i18n.localize('CYPHUR.SelectUser')}</p>
                            <select id="cyphur-user-select" style="width:100%;padding:5px;">
                                ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                            </select>
                        </div>`,
                        buttons: {
                            start: {
                                icon: '<i class="fas fa-comments"></i>',
                                label: game.i18n.localize('CYPHUR.Buttons.Send'),
                                callback: (html) => {
                                    const userId = html.find('#cyphur-user-select').val();
                                    UIManager.openChatFor(userId);
                                }
                            }
                        },
                        default: 'start'
                    }).render(true);
                }
            }
        ],
        activeTool: 'openHub'
    });

    // Also add GM tools if user is GM
    if (game.user.isGM) {
        const cyphurControl = controls.find(c => c.name === 'cyphur');
        if (cyphurControl) {
            cyphurControl.tools.push(
                {
                    name: 'gmMonitor',
                    title: 'CYPHUR.GMMonitorTitle',
                    icon: 'fas fa-eye',
                    button: true,
                    onClick: () => UIManager.openGMMonitor()
                },
                {
                    name: 'gmTools',
                    title: 'CYPHUR.GMModTitle',
                    icon: 'fas fa-tools',
                    button: true,
                    onClick: () => UIManager.openGMModWindow()
                },
                {
                    name: 'groupManager',
                    title: 'CYPHUR.GroupManagerTitle',
                    icon: 'fas fa-users-cog',
                    button: true,
                    onClick: () => UIManager.openGroupManager()
                }
            );
        }
    }
});

// ════════════════════════════════════════════════════════════════════════════
// CHAT MESSAGE HOOKS - For integration with main Foundry chat
// ════════════════════════════════════════════════════════════════════════════

// Optional: Add a whisper redirect button in Foundry's chat
Hooks.on('renderChatMessage', (message, html, data) => {
    // If it's a whisper, add option to continue in Cyphur
    if (message.whisper?.length > 0 && message.whisper.length < game.users.size) {
        const recipientId = message.whisper.find(id => id !== game.user.id);
        if (recipientId) {
            const btn = document.createElement('a');
            btn.className = 'cyphur-continue-btn';
            btn.innerHTML = '<i class="fas fa-satellite-dish"></i>';
            btn.title = 'Continue in Cyphur';
            btn.addEventListener('click', () => UIManager.openChatFor(recipientId));
            
            html.find('.message-header').append(btn);
        }
    }
});
