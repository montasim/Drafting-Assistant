import { defineConfig } from 'wxt';

const e2eLinkedInPermission = process.env.E2E_REQUIRED_LINKEDIN === '1';

export default defineConfig({
  outDir: e2eLinkedInPermission ? '.wxt/e2e-output' : '.output',
  outDirTemplate: '.',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Professional Drafting Assistant',
    short_name: 'Drafting AI',
    description: 'Create professional, evidence-bound response drafts from user-selected posts.',
    minimum_chrome_version: '120',
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; frame-src https://supportkori.com https://www.supportkori.com",
    },
    permissions: ['contextMenus', 'scripting', 'sidePanel', 'storage'],
    optional_host_permissions: e2eLinkedInPermission ? [] : ['https://www.linkedin.com/*'],
    host_permissions: [
      'https://generativelanguage.googleapis.com/*',
      ...(e2eLinkedInPermission ? ['https://www.linkedin.com/*'] : []),
    ],
    action: {
      default_title: 'Open Professional Drafting Assistant',
      default_icon: {
        16: 'icon/icon-16.png',
        32: 'icon/icon-32.png',
        48: 'icon/icon-48.png',
        128: 'icon/icon-128.png',
      },
    },
    icons: {
      16: 'icon/icon-16.png',
      32: 'icon/icon-32.png',
      48: 'icon/icon-48.png',
      128: 'icon/icon-128.png',
    },
    incognito: 'not_allowed',
  },
});
