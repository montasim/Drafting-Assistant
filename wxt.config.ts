import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const e2eLinkedInPermission = process.env.E2E_REQUIRED_LINKEDIN === '1';

export default defineConfig({
  outDir: e2eLinkedInPermission ? '.wxt/e2e-output' : '.output',
  outDirTemplate: '.',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Professional Drafting Assistant',
    short_name: 'Drafting AI',
    description:
      'Create evidence-bound LinkedIn responses and manually discovered standalone post drafts.',
    minimum_chrome_version: '120',
    permissions: ['contextMenus', 'scripting', 'sidePanel', 'storage'],
    optional_host_permissions: [
      ...(e2eLinkedInPermission ? [] : ['https://www.linkedin.com/*']),
      'https://api.groq.com/*',
      'https://hacker-news.firebaseio.com/*',
      'https://dev.to/*',
      'https://medium.com/*',
      'https://lobste.rs/*',
      'https://api.stackexchange.com/*',
    ],
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
