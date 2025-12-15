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
        UIManager: UIManager,
        DataManager: import('./DataManager.js').then(m => m.DataManager)
    };

    // Register API on module instance
    const module = game.modules.get(MODULE_ID);
    if (module) {
        module.api = game.RNKCyphur;
    }

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
    console.log('Cyphur | Ready hook fired');
    
    try {
        RNKCyphur.initialize();
        console.log('Cyphur | Module initialized successfully');
    } catch (error) {
        console.error('Cyphur | Error initializing:', error);
    }

    // Apply global theme
    try {
        const globalTheme = game.settings.get(MODULE_ID, 'globalTheme') || 'neon';
        if (globalTheme && globalTheme !== 'none') {
            UIManager.applyTheme(globalTheme);
        }
    } catch (error) {
        console.error('Cyphur | Error applying theme:', error);
    }

    // Store personal background reference
    try {
        const bg = game.settings.get(MODULE_ID, 'personalBackground');
        if (bg) {
            window.RNKCyphurPersonalBackground = bg;
        }
    } catch (error) {
        console.error('Cyphur | Error loading background:', error);
    }

    // Register hotbar button
    console.log('Cyphur | Registering hotbar button...');
    registerCyphurHotbarButton();
    
    // Force scene controls refresh to ensure Cyphur button appears
    setTimeout(() => {
        if (ui.controls) {
            console.log('Cyphur | Forcing scene controls refresh');
            try {
                ui.controls.initialize();
            } catch (error) {
                console.error('Cyphur | Error refreshing scene controls:', error);
            }
        } else {
            console.warn('Cyphur | ui.controls not available');
        }
    }, 1000);
    
    console.log('Cyphur | Ready for encrypted communications!');
    console.log('Cyphur | Check for floating button at bottom-left of screen');
});

// ════════════════════════════════════════════════════════════════════════════
// HOTBAR BUTTON INJECTION
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// HOTBAR BUTTON INJECTION
// ════════════════════════════════════════════════════════════════════════════

function registerCyphurHotbarButton() {
    // Always create the floating button immediately
    createFloatingButton();
    
    // Ensure it persists if UI updates
    Hooks.on('renderHotbar', () => {
        setTimeout(createFloatingButton, 100);
    });
    
    // Periodic check to ensure it stays visible
    setTimeout(createFloatingButton, 500);
    setTimeout(createFloatingButton, 2000);
}

function injectCyphurHotbarSlot() {
    // Deprecated: Redirect to floating button
    createFloatingButton();
}

function createFloatingButton() {
    // Check if floating button already exists
    const existing = document.getElementById('cyphur-floating-btn');
    if (existing) {
        console.log('Cyphur | Floating button already exists');
        return;
    }

    console.log('Cyphur | Creating floating button...');
    const btn = document.createElement('div');
    btn.id = 'cyphur-floating-btn';
    btn.className = 'cyphur-hotbar-btn';
    btn.innerHTML = `
        <i class="fas fa-satellite-dish"></i>
        <span class="cyphur-hotbar-badge" style="display:none;">0</span>
    `;
    btn.title = "Open Cyphur Communications";
    
    // Style as a floating radial button
    Object.assign(btn.style, {
        position: 'fixed',
        bottom: '120px',
        left: '20px',
        width: '60px',
        height: '60px',
        background: 'rgba(10, 10, 18, 0.95)',
        border: '2px solid #00fff2',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: '99999',
        boxShadow: '0 0 20px rgba(0, 255, 242, 0.5)',
        fontSize: '28px',
        color: '#00fff2',
        transition: 'all 0.3s ease',
        pointerEvents: 'auto'
    });
    
    // Hover effect
    btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.1)';
        btn.style.boxShadow = '0 0 30px rgba(0, 255, 242, 0.8)';
        btn.style.background = 'rgba(20, 20, 35, 1)';
    };
    btn.onmouseleave = () => {
        btn.style.transform = 'scale(1)';
        btn.style.boxShadow = '0 0 20px rgba(0, 255, 242, 0.5)';
        btn.style.background = 'rgba(10, 10, 18, 0.95)';
    };
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Cyphur | Floating button clicked!');
        UIManager.openPlayerHub();
    });
    
    document.body.appendChild(btn);
    console.log('Cyphur | Floating button added to DOM:', btn);
    updateHotbarBadge();
}

function updateHotbarBadge() {
    import('./DataManager.js').then(({ DataManager }) => {
        const total = DataManager.getTotalUnread();
        const badges = document.querySelectorAll('.cyphur-hotbar-badge');
        
        badges.forEach(badge => {
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });
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
    console.log('Cyphur | getSceneControlButtons hook fired', controls);
    
    // Foundry may provide a non-array controls shape; normalize before using array methods.
    const controlsArr = Array.isArray(controls)
        ? controls
        : (Array.isArray(controls?.controls)
            ? controls.controls
            : (Array.isArray(controls?.sceneControls)
                ? controls.sceneControls
                : null));
    
    console.log('Cyphur | Controls array:', controlsArr);
    if (!controlsArr) {
        console.warn('Cyphur | Could not find controls array!');
        return;
    }

    // Add Cyphur as its own control layer at the end
    const cyphurControl = {
        name: 'cyphur',
        title: 'Cyphur Communications',
        icon: 'fas fa-satellite-dish',
        visible: true,
        tools: [
            {
                name: 'openHub',
                title: 'Open Cyphur Hub',
                icon: 'fas fa-comments',
                button: true,
                onClick: () => {
                    console.log('Cyphur | Hub button clicked');
                    UIManager.openPlayerHub();
                }
            },
            {
                name: 'newChat',
                title: 'New Private Chat',
                icon: 'fas fa-plus',
                button: true,
                onClick: () => {
                    console.log('Cyphur | New chat button clicked');
                    // Open user selection dialog
                    const users = game.users.filter(u => u.id !== game.user.id && u.active);
                    if (users.length === 0) {
                        ui.notifications.warn('No other users are currently online');
                        return;
                    }
                    new Dialog({
                        title: 'New Private Chat',
                        content: `<div class="cyphur-user-select">
                            <p>Select a user to chat with:</p>
                            <select id="cyphur-user-select" style="width:100%;padding:5px;">
                                ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                            </select>
                        </div>`,
                        buttons: {
                            start: {
                                icon: '<i class="fas fa-comments"></i>',
                                label: 'Start Chat',
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
    };
    
    controlsArr.push(cyphurControl);
    console.log('Cyphur | Added Cyphur control to scene controls:', cyphurControl);

    // Also add GM tools if user is GM
    if (game.user.isGM) {
        console.log('Cyphur | Adding GM tools to scene control');
        if (cyphurControl) {
            cyphurControl.tools.push(
                {
                    name: 'gmMonitor',
                    title: 'GM Monitor',
                    icon: 'fas fa-eye',
                    button: true,
                    onClick: () => {
                        console.log('Cyphur | GM Monitor clicked');
                        UIManager.openGMMonitor();
                    }
                },
                {
                    name: 'gmTools',
                    title: 'GM Moderation Tools',
                    icon: 'fas fa-tools',
                    button: true,
                    onClick: () => {
                        console.log('Cyphur | GM Tools clicked');
                        UIManager.openGMModWindow();
                    }
                },
                {
                    name: 'groupManager',
                    title: 'Group Manager',
                    icon: 'fas fa-users-cog',
                    button: true,
                    onClick: () => {
                        console.log('Cyphur | Group Manager clicked');
                        UIManager.openGroupManager();
                    }
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
