/**
 * RNK Cyphur - Quantum Portal
 * Pop-out window functionality for multi-monitor setups
 * Custom implementation inspired by but not copying other modules
 */

import { MODULE_ID } from './Constants.js';

export class QuantumPortal {
    
    static portalWindows = new Map();
    static portalId = foundry.utils.randomID(16);
    
    /**
     * Initialize the Quantum Portal system
     */
    static init() {
        console.log(`${MODULE_ID} | Quantum Portal initializing...`);
        
        // Clean up portals when main window closes
        window.addEventListener('beforeunload', () => {
            this.closeAllPortals();
        });
    }
    
    /**
     * Check if an app is already in a portal
     */
    static isInPortal(appId) {
        return this.portalWindows.has(appId);
    }
    
    /**
     * Get the portal window for an app
     */
    static getPortal(appId) {
        return this.portalWindows.get(appId);
    }
    
    /**
     * Open a Quantum Portal for an application window
     * @param {Application} app - The Foundry application to pop out
     */
    static async openPortal(app) {
        const appId = app.id || app.appId;
        
        // Check if already in portal
        if (this.isInPortal(appId)) {
            const existing = this.getPortal(appId);
            if (existing && !existing.closed) {
                existing.focus();
                return existing;
            }
            this.portalWindows.delete(appId);
        }
        
        // Get the app's DOM element
        const appElement = this._getAppElement(app);
        if (!appElement) {
            ui.notifications.warn(game.i18n.localize('CYPHUR.Errors.PortalFailed'));
            return null;
        }
        
        // Calculate window dimensions
        const dimensions = this._calculateDimensions(appElement);
        
        // Create the portal window
        const portalWindow = this._createPortalWindow(dimensions);
        if (!portalWindow) {
            ui.notifications.warn(game.i18n.localize('CYPHUR.Errors.PortalBlocked'));
            return null;
        }
        
        // Build the portal document
        await this._buildPortalDocument(portalWindow, app, appElement);
        
        // Store reference
        this.portalWindows.set(appId, portalWindow);
        
        // Handle portal close
        portalWindow.addEventListener('beforeunload', () => {
            this._handlePortalClose(app, appId);
        });
        
        // Emit event
        Hooks.callAll('cyphur.portalOpened', app, portalWindow);
        
        console.log(`${MODULE_ID} | Quantum Portal opened for ${app.title}`);
        
        return portalWindow;
    }
    
    /**
     * Close a specific portal
     */
    static closePortal(appId) {
        const portal = this.portalWindows.get(appId);
        if (portal && !portal.closed) {
            portal.close();
        }
        this.portalWindows.delete(appId);
    }
    
    /**
     * Close all open portals
     */
    static closeAllPortals() {
        for (const [appId, portal] of this.portalWindows) {
            if (portal && !portal.closed) {
                portal.close();
            }
        }
        this.portalWindows.clear();
    }
    
    /**
     * Get the DOM element for an application
     * @private
     */
    static _getAppElement(app) {
        // ApplicationV2
        if (app.element && !(app.element instanceof jQuery)) {
            return app.element;
        }
        
        // Try by ID
        const appId = app.id || app.appId;
        if (appId) {
            const elem = document.getElementById(appId);
            if (elem) return elem;
        }
        
        // ApplicationV1 jQuery
        if (app.element && app.element[0]) {
            return app.element[0];
        }
        
        // _element property
        if (app._element) {
            return app._element instanceof jQuery ? app._element[0] : app._element;
        }
        
        return null;
    }
    
    /**
     * Calculate portal window dimensions
     * @private
     */
    static _calculateDimensions(element) {
        const rect = element.getBoundingClientRect();
        const padding = 20;
        
        return {
            width: Math.max(rect.width + padding * 2, 400),
            height: Math.max(rect.height + padding * 2, 300),
            left: window.screenX + rect.left - padding,
            top: window.screenY + rect.top - padding
        };
    }
    
    /**
     * Create the portal window
     * @private
     */
    static _createPortalWindow(dimensions) {
        const features = [
            'toolbar=no',
            'location=no',
            'menubar=no',
            'scrollbars=yes',
            'resizable=yes',
            `width=${dimensions.width}`,
            `height=${dimensions.height}`,
            `left=${dimensions.left}`,
            `top=${dimensions.top}`
        ].join(',');
        
        const portal = window.open('about:blank', '_blank', features);
        
        if (portal) {
            portal._isQuantumPortal = true;
            portal._parentWindow = window;
        }
        
        return portal;
    }
    
    /**
     * Build the portal document with styles and content
     * @private
     */
    static async _buildPortalDocument(portal, app, appElement) {
        const doc = portal.document;
        
        // Start building the document
        doc.open();
        doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
        doc.close();
        
        // Copy styles from main document
        await this._copyStyles(doc);
        
        // Set document title
        doc.title = `⚡ ${app.title} - Quantum Portal`;
        
        // Style the body
        doc.body.style.cssText = `
            margin: 0;
            padding: 20px;
            background: #0a0a12;
            min-height: 100vh;
            box-sizing: border-box;
            display: flex;
            align-items: flex-start;
            justify-content: center;
        `;
        
        // Copy root CSS variables
        doc.documentElement.style.cssText = document.documentElement.style.cssText;
        
        // Clone and adopt the app element
        const clone = appElement.cloneNode(true);
        
        // Reset positioning for the portal
        clone.style.position = 'relative';
        clone.style.top = 'auto';
        clone.style.left = 'auto';
        clone.style.transform = 'none';
        clone.style.width = '100%';
        clone.style.maxWidth = `${appElement.offsetWidth}px`;
        clone.style.height = 'auto';
        clone.style.minHeight = `${appElement.offsetHeight}px`;
        
        // Hide the original
        appElement.style.display = 'none';
        appElement._hiddenByPortal = true;
        
        // Add to portal
        doc.body.appendChild(clone);
        
        // Re-attach event listeners by re-rendering
        this._setupPortalInteractivity(portal, app, clone, appElement);
        
        // Add portal indicator
        this._addPortalIndicator(doc);
    }
    
    /**
     * Copy stylesheets to portal document
     * @private
     */
    static async _copyStyles(doc) {
        const head = doc.head;
        
        // Copy all stylesheets
        for (const sheet of document.styleSheets) {
            try {
                if (sheet.href) {
                    // External stylesheet
                    const link = doc.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = sheet.href;
                    head.appendChild(link);
                } else if (sheet.cssRules) {
                    // Inline stylesheet
                    const style = doc.createElement('style');
                    let css = '';
                    for (const rule of sheet.cssRules) {
                        css += rule.cssText + '\n';
                    }
                    style.textContent = css;
                    head.appendChild(style);
                }
            } catch (e) {
                // CORS restrictions on some stylesheets
                console.debug(`${MODULE_ID} | Could not copy stylesheet:`, e);
            }
        }
        
        // Add portal-specific styles
        const portalStyles = doc.createElement('style');
        portalStyles.textContent = `
            body {
                scrollbar-width: thin;
                scrollbar-color: var(--cyphur-neon-cyan, #00fff2) var(--cyphur-bg-dark, #0a0a12);
            }
            
            body::-webkit-scrollbar {
                width: 8px;
            }
            
            body::-webkit-scrollbar-track {
                background: var(--cyphur-bg-dark, #0a0a12);
            }
            
            body::-webkit-scrollbar-thumb {
                background: var(--cyphur-neon-cyan, #00fff2);
                border-radius: 4px;
            }
            
            .quantum-portal-indicator {
                position: fixed;
                bottom: 10px;
                right: 10px;
                padding: 8px 16px;
                background: rgba(0, 255, 242, 0.2);
                border: 1px solid var(--cyphur-neon-cyan, #00fff2);
                border-radius: 20px;
                color: var(--cyphur-neon-cyan, #00fff2);
                font-family: 'Rajdhani', sans-serif;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
                animation: portalPulse 2s infinite;
                pointer-events: none;
                z-index: 9999;
            }
            
            @keyframes portalPulse {
                0%, 100% { 
                    opacity: 0.7;
                    box-shadow: 0 0 10px rgba(0, 255, 242, 0.3);
                }
                50% { 
                    opacity: 1;
                    box-shadow: 0 0 20px rgba(0, 255, 242, 0.6);
                }
            }
        `;
        head.appendChild(portalStyles);
    }
    
    /**
     * Setup interactivity in portal window
     * @private
     */
    static _setupPortalInteractivity(portal, app, clone, originalElement) {
        const doc = portal.document;
        
        // Handle form submissions
        clone.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                // Relay to original form
                const originalForm = originalElement.querySelector(`form[name="${form.name}"]`) || originalElement.querySelector('form');
                if (originalForm) {
                    const event = new Event('submit', { bubbles: true, cancelable: true });
                    originalForm.dispatchEvent(event);
                }
            });
        });
        
        // Handle button clicks
        clone.querySelectorAll('button, [data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                if (action === 'close') {
                    portal.close();
                    return;
                }
                
                // Find corresponding button in original
                const selector = btn.id ? `#${btn.id}` : 
                    btn.dataset.action ? `[data-action="${btn.dataset.action}"]` :
                    btn.className ? `.${btn.className.split(' ').join('.')}` : null;
                    
                if (selector) {
                    const originalBtn = originalElement.querySelector(selector);
                    if (originalBtn) {
                        originalBtn.click();
                    }
                }
            });
        });
        
        // Handle input changes
        clone.querySelectorAll('input, textarea, select').forEach(input => {
            input.addEventListener('change', (e) => {
                const name = input.name || input.id;
                if (name) {
                    const original = originalElement.querySelector(`[name="${name}"], #${name}`);
                    if (original) {
                        original.value = input.value;
                        original.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });
            
            input.addEventListener('input', (e) => {
                const name = input.name || input.id;
                if (name) {
                    const original = originalElement.querySelector(`[name="${name}"], #${name}`);
                    if (original) {
                        original.value = input.value;
                        original.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });
        });
        
        // Sync updates from original to portal periodically
        const syncInterval = setInterval(() => {
            if (portal.closed) {
                clearInterval(syncInterval);
                return;
            }
            
            // Sync message containers
            const originalMessages = originalElement.querySelector('.cyphur-messages');
            const portalMessages = clone.querySelector('.cyphur-messages');
            if (originalMessages && portalMessages) {
                portalMessages.innerHTML = originalMessages.innerHTML;
            }
        }, 500);
    }
    
    /**
     * Add portal indicator badge
     * @private
     */
    static _addPortalIndicator(doc) {
        const indicator = doc.createElement('div');
        indicator.className = 'quantum-portal-indicator';
        indicator.innerHTML = '⚡ Quantum Portal Active';
        doc.body.appendChild(indicator);
    }
    
    /**
     * Handle portal window closing
     * @private
     */
    static _handlePortalClose(app, appId) {
        // Show original element again
        const appElement = this._getAppElement(app);
        if (appElement && appElement._hiddenByPortal) {
            appElement.style.display = '';
            delete appElement._hiddenByPortal;
        }
        
        // Remove from tracking
        this.portalWindows.delete(appId);
        
        // Emit event
        Hooks.callAll('cyphur.portalClosed', app);
        
        console.log(`${MODULE_ID} | Quantum Portal closed for ${app.title}`);
    }
    
    /**
     * Add the Quantum Portal button to a window header
     * @param {HTMLElement} header - The window header element
     * @param {Application} app - The application instance
     */
    static addPortalButton(header, app) {
        // Don't add if already exists
        if (header.querySelector('.quantum-portal-btn')) return;
        
        const portalBtn = document.createElement('button');
        portalBtn.type = 'button';
        portalBtn.className = 'quantum-portal-btn header-control';
        portalBtn.dataset.tooltip = game.i18n.localize('CYPHUR.Tooltips.QuantumPortal');
        portalBtn.innerHTML = `
            <img src="modules/rnk-cyphur/rnk-codex.jpg" 
                 alt="Quantum Portal" 
                 class="quantum-portal-logo" />
        `;
        
        portalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openPortal(app);
        });
        
        // Insert before close button
        const closeBtn = header.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.parentNode.insertBefore(portalBtn, closeBtn);
        } else {
            header.appendChild(portalBtn);
        }
    }
    
    /**
     * Add logo display to window content
     * @param {HTMLElement} content - The window content element
     * @param {string} position - Where to place the logo ('header', 'footer', 'corner')
     */
    static addLogoDisplay(content, position = 'corner') {
        // Don't add if already exists
        if (content.querySelector('.cyphur-logo-display')) return;
        
        const logo = document.createElement('div');
        logo.className = `cyphur-logo-display cyphur-logo-${position}`;
        logo.innerHTML = `
            <img src="modules/rnk-cyphur/rnk-codex.jpg" 
                 alt="RNK Cyphur" 
                 class="cyphur-logo-img animated" />
        `;
        
        if (position === 'header') {
            content.insertBefore(logo, content.firstChild);
        } else {
            content.appendChild(logo);
        }
    }
}

// Export for use in other modules
window.QuantumPortal = QuantumPortal;
