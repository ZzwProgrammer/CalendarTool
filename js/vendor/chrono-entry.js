// Browser bundle entry for chrono-node with all locales
import * as chrono from 'chrono-node';

// Log available locales for debugging
console.log('[chrono] Available locales:', Object.keys(chrono).filter(k => !k.startsWith('_') && typeof chrono[k] === 'object'));

// Export as global
window.chrono = chrono;
