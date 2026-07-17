import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { extractLinkedInPost } from '../src/content/linkedin-extractor';
import { toAppError } from '../src/application/errors';
import { runtimeRequestSchema, type RuntimeResponse } from '../src/shared/protocol';

export default defineUnlistedScript(() => {
  const scope = globalThis as typeof globalThis & {
    __professionalDraftingAssistantLoaded?: boolean;
  };
  if (scope.__professionalDraftingAssistantLoaded) return;
  scope.__professionalDraftingAssistantLoaded = true;
  let lastContextTarget: Element | null = null;

  document.addEventListener(
    'contextmenu',
    (event) => {
      lastContextTarget = event.target instanceof Element ? event.target : null;
    },
    { capture: true, passive: true },
  );

  chrome.runtime.onMessage.addListener(
    (raw: unknown, _sender, sendResponse: (response: RuntimeResponse) => void) => {
      const request = runtimeRequestSchema.safeParse(raw);
      if (!request.success || request.data.type !== 'content:extract-selected-post') return false;
      try {
        if (!lastContextTarget?.isConnected)
          throw new Error('Right-click a post again, then choose Analyze this post.');
        sendResponse({ ok: true, context: extractLinkedInPost(lastContextTarget) });
      } catch (error) {
        const appError = toAppError(error);
        sendResponse({ ok: false, code: appError.code, message: appError.message });
      }
      return false;
    },
  );
});
