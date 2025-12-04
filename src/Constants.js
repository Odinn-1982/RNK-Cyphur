/**
 * RNK Cyphur - Shared Constants
 * Central location for module configuration and constants
 */

export const MODULE_ID = 'rnk-cyphur';
export const MODULE_NAME = 'RNK Cyphur';
export const SOCKET_NAME = `module.${MODULE_ID}`;

// Socket event types
export const SOCKET_EVENTS = {
    PRIVATE_MESSAGE: 'privateMessage',
    GROUP_MESSAGE: 'groupMessage',
    CHANNEL_MESSAGE: 'channelMessage',
    TYPING: 'typing',
    EDIT_MESSAGE: 'editMessage',
    DELETE_MESSAGE: 'deleteMessage',
    ADD_REACTION: 'addReaction',
    GROUP_CREATE: 'groupCreate',
    GROUP_UPDATE: 'groupUpdate',
    GROUP_DELETE: 'groupDelete',
    GROUP_SYNC: 'groupSync',
    PRIVATE_SYNC: 'privateSync',
    BACKGROUND_SHARE: 'backgroundShare',
    PRESENCE_UPDATE: 'presenceUpdate',
    MESSAGE_READ: 'messageRead',
    CHANNEL_INVITE: 'channelInvite',
    IMAGE_SHARE: 'imageShare',
    GM_INTERCEPT: 'gmIntercept'
};

// Message types for different content
export const MESSAGE_TYPES = {
    TEXT: 'text',
    SYSTEM: 'system',
    DICE: 'dice',
    ITEM_LINK: 'itemLink',
    ACTOR_LINK: 'actorLink',
    IMAGE: 'image',
    FILE: 'file'
};

// Default settings values
export const DEFAULTS = {
    theme: 'neon',
    enableSounds: true,
    soundVolume: 50,
    notificationSound: 'notify.wav',
    enableNotifications: true,
    enterToSend: true,
    showAvatars: true,
    compactMode: false,
    maxMessageHistory: 500,
    typingTimeout: 5000,
    maxIntercepted: 1000
};

// Theme definitions
export const THEMES = {
    neon: { name: 'Neon', class: 'cyphur-theme-neon', description: 'Cyan/blue cyberpunk' },
    matrix: { name: 'Matrix', class: 'cyphur-theme-matrix', description: 'Green hacker aesthetic' },
    cyber: { name: 'Cyber', class: 'cyphur-theme-cyber', description: 'Pink/purple synthwave' },
    midnight: { name: 'Midnight', class: 'cyphur-theme-midnight', description: 'Subtle professional blue' },
    plasma: { name: 'Plasma', class: 'cyphur-theme-plasma', description: 'Vibrant purple energy' },
    hologram: { name: 'Hologram', class: 'cyphur-theme-hologram', description: 'Translucent holographic' },
    quantum: { name: 'Quantum', class: 'cyphur-theme-quantum', description: 'Soft pastel sci-fi' },
    void: { name: 'Void', class: 'cyphur-theme-void', description: 'Minimal ultra-dark' }
};

// Available notification sounds
export const SOUNDS = [
    { id: 'notify', name: 'Notify', file: 'notify.wav' },
    { id: 'new-notification', name: 'New Notification', file: 'new-notification.mp3' },
    { id: 'alerte', name: 'Alert', file: 'alerte.mp3' },
    { id: 'impact', name: 'Impact', file: 'impact.mp3' },
    { id: 'glitch-effect', name: 'Glitch', file: 'glitch-effect.mp3' },
    { id: 'hello', name: 'Hello', file: 'hello.mp3' },
    { id: 'warning', name: 'Warning', file: 'warning.mp3' },
    { id: 'siren', name: 'Siren', file: 'siren.mp3' },
    { id: 'camera-flash', name: 'Camera Flash', file: 'camera-flash.mp3' },
    { id: 'vine-boom', name: 'Vine Boom', file: 'vine-boom.mp3' },
    { id: 'wow', name: 'Wow', file: 'wow.mp3' },
    { id: 'game-over', name: 'Game Over', file: 'game-over.mp3' },
    { id: 'punch', name: 'Punch', file: 'punch.mp3' },
    { id: 'sword', name: 'Sword', file: 'sword.mp3' },
    { id: 'water-splash', name: 'Water Splash', file: 'water-splash.mp3' },
    { id: 'censor-beep', name: 'Censor Beep', file: 'censor-beep.mp3' },
    { id: 'car-horn', name: 'Car Horn', file: 'car-horn-honking.mp3' },
    { id: 'vinyl-stop', name: 'Vinyl Stop', file: 'vinyl-stop.mp3' },
    { id: 'wolf', name: 'Wolf', file: 'wolf.mp3' },
    { id: 'witch', name: 'Witch', file: 'witch.mp3' },
    { id: 'evil-laugh', name: 'Evil Laugh', file: 'evil laugh.mp3' },
    { id: 'creepy-laugh', name: 'Creepy Laugh', file: 'creepy laugh.mp3' },
    { id: 'scary-laugh', name: 'Scary Laugh', file: 'scary laugh.mp3' },
    { id: 'possessed', name: 'Possessed', file: 'possessed.mp3' },
    { id: 'female-siren', name: 'Female Siren', file: 'female siren 5.mp3' },
    { id: 'run', name: 'Run', file: 'run.mp3' },
    { id: 'run-away', name: 'Run Away Girl', file: 'run away girl.mp3' },
    { id: 'get-out', name: 'Get Out', file: 'get out of here.mp3' },
    { id: 'stop-breathing', name: 'Stop Breathing', file: 'stop breathing.mp3' }
];

// Reaction emoji presets
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '💯', '🎲', '⚔️', '🛡️', '✨', '🎉', '💀', '🤔', '👀'];

// Status indicators
export const STATUS = {
    ONLINE: 'online',
    AWAY: 'away',
    BUSY: 'busy',
    OFFLINE: 'offline'
};

// Supported image types for upload
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

