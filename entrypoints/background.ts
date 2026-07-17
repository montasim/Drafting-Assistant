import { defineBackground } from 'wxt/utils/define-background';
import type { AiProvider } from '../src/application/ai-provider';
import { toAppError, AppError } from '../src/application/errors';
import {
  historyEntrySchema,
  postContextSchema,
  type AnalysisState,
  type HistoryEntry,
  type PostContext,
} from '../src/domain/schemas';
import { ExtensionStorage } from '../src/infrastructure/storage';
import { GeminiClient } from '../src/infrastructure/gemini-client';
import {
  runtimeRequestSchema,
  type RuntimeRequest,
  type RuntimeResponse,
} from '../src/shared/protocol';

const LINKEDIN_ORIGIN = 'https://www.linkedin.com/*';
const CONTENT_SCRIPT_ID = 'professional-drafting-linkedin';
const CONTEXT_MENU_ID = 'analyze-linkedin-post';
let integrationSync: Promise<void> = Promise.resolve();

export default defineBackground(() => {
  const storage = new ExtensionStorage();
  const provider: AiProvider = new GeminiClient();
  let activeRequestId: string | null = null;

  const ready = initialize(storage);

  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install')
      void chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding.html') });
  });

  chrome.permissions.onAdded.addListener(() => void scheduleLinkedInIntegration());
  chrome.permissions.onRemoved.addListener(() => void scheduleLinkedInIntegration());

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
    const tabId = tab.id;
    void chrome.sidePanel.open({ tabId });
    void ready.then(() =>
      analyzeSelected(
        tabId,
        storage,
        provider,
        () => activeRequestId,
        (value) => (activeRequestId = value),
      ),
    );
  });

  chrome.runtime.onMessage.addListener(
    (raw: unknown, sender, sendResponse: (response: RuntimeResponse) => void) => {
      const parsed = runtimeRequestSchema.safeParse(raw);
      if (!parsed.success) {
        sendResponse({
          ok: false,
          code: 'invalid-request',
          message: 'The extension received an invalid request.',
        });
        return false;
      }
      void ready
        .then(() =>
          handleRequest(
            parsed.data,
            sender,
            storage,
            provider,
            () => activeRequestId,
            (value) => (activeRequestId = value),
          ),
        )
        .then(sendResponse)
        .catch((error: unknown) => {
          const appError = toAppError(error);
          sendResponse({ ok: false, code: appError.code, message: appError.message });
        });
      return true;
    },
  );
});

async function initialize(storage: ExtensionStorage): Promise<void> {
  await storage.restrictAccess();
  await storage.migrateToGemini();
  const previousState = await storage.getAnalysisState();
  if (previousState.status === 'running') {
    await storage.saveAnalysisState({
      status: 'error',
      requestId: previousState.requestId,
      code: 'provider-unavailable',
      message: 'The previous analysis was interrupted when the extension stopped.',
    });
  }
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await scheduleLinkedInIntegration();
}

function scheduleLinkedInIntegration(): Promise<void> {
  const next = integrationSync.then(syncLinkedInIntegration);
  integrationSync = next.catch(() => undefined);
  return next;
}

async function syncLinkedInIntegration(): Promise<void> {
  const hasPermission = await chrome.permissions.contains({ origins: [LINKEDIN_ORIGIN] });
  const registrations = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID],
  });
  if (hasPermission && registrations.length === 0) {
    await chrome.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        matches: [LINKEDIN_ORIGIN],
        js: ['linkedin.js'],
        runAt: 'document_idle',
        world: 'ISOLATED',
        persistAcrossSessions: true,
      },
    ]);
  }
  if (hasPermission) await injectIntoOpenLinkedInTabs();
  if (!hasPermission && registrations.length > 0)
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  await chrome.contextMenus.removeAll();
  if (hasPermission) {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Analyze this post',
      contexts: ['page', 'selection', 'link', 'image'],
      documentUrlPatterns: [LINKEDIN_ORIGIN],
    });
  }
}

async function injectIntoOpenLinkedInTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: [LINKEDIN_ORIGIN] });
  await Promise.all(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => typeof tab.id === 'number')
      .map(async (tab) => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['linkedin.js'],
          });
        } catch {
          // Restricted LinkedIn-owned pages can reject injection; normal navigation retries it.
        }
      }),
  );
}

async function handleRequest(
  request: RuntimeRequest,
  sender: chrome.runtime.MessageSender,
  storage: ExtensionStorage,
  provider: AiProvider,
  getActiveRequestId: () => string | null,
  setActiveRequestId: (value: string | null) => void,
): Promise<RuntimeResponse> {
  switch (request.type) {
    case 'setup:get': {
      const [settings, profile, credential, hasLinkedInPermission] = await Promise.all([
        storage.getSettings(),
        storage.getProfile(),
        storage.getCredential(),
        chrome.permissions.contains({ origins: [LINKEDIN_ORIGIN] }),
      ]);
      return {
        ok: true,
        setup: { settings, profile, hasCredential: credential !== null, hasLinkedInPermission },
      };
    }
    case 'permission:request-linkedin': {
      const granted = await chrome.permissions.request({ origins: [LINKEDIN_ORIGIN] });
      if (granted) await scheduleLinkedInIntegration();
      return granted
        ? { ok: true }
        : { ok: false, code: 'permission-denied', message: 'LinkedIn access was not granted.' };
    }
    case 'permission:remove-linkedin':
      await chrome.permissions.remove({ origins: [LINKEDIN_ORIGIN] });
      await scheduleLinkedInIntegration();
      return { ok: true };
    case 'credential:validate':
      return { ok: true, valid: await provider.validateCredential(request.apiKey) };
    case 'credential:save':
      await storage.saveCredential(request.apiKey, request.rememberOnDevice);
      return { ok: true };
    case 'credential:clear':
      await storage.clearCredential();
      return { ok: true };
    case 'settings:save':
      await storage.saveSettings(request.settings);
      return { ok: true };
    case 'profile:save':
      await storage.saveProfile(request.profile);
      return { ok: true };
    case 'profile:derive-pdf': {
      const apiKey = await storage.getCredential();
      if (!apiKey) throw new AppError('credential-missing', 'Save a Gemini API key first.');
      const profile = await provider.deriveProfile(apiKey, request.dataUrl);
      return { ok: true, profile };
    }
    case 'analysis:get-state':
      return { ok: true, state: await storage.getAnalysisState() };
    case 'analysis:extract-selected': {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = sender.tab?.id ?? activeTab?.id;
      if (!tabId)
        return {
          ok: false,
          code: 'tab-missing',
          message: 'Open LinkedIn and select a post first.',
        };
      await analyzeSelected(tabId, storage, provider, getActiveRequestId, setActiveRequestId);
      return { ok: true };
    }
    case 'analysis:cancel':
      return {
        ok: false,
        code: 'cancel-not-supported',
        message:
          'The current provider request cannot be safely cancelled. You can close this panel.',
      };
    case 'history:list':
      return { ok: true, history: await storage.listHistory() };
    case 'history:update-draft':
      await storage.updateHistoryDraft(request.entryId, request.draftIndex, request.text);
      return { ok: true };
    case 'history:delete':
      await storage.deleteHistory(request.entryId);
      return { ok: true };
    case 'history:clear':
      await storage.clearHistory();
      return { ok: true };
    case 'diagnostics:export':
      return { ok: true, diagnosticJson: await storage.exportDiagnostics() };
    case 'content:extract-selected-post':
      return {
        ok: false,
        code: 'wrong-context',
        message: 'This request is handled only inside LinkedIn.',
      };
  }
}

async function analyzeSelected(
  tabId: number,
  storage: ExtensionStorage,
  provider: AiProvider,
  getActiveRequestId: () => string | null,
  setActiveRequestId: (value: string | null) => void,
): Promise<void> {
  if (getActiveRequestId()) {
    await storage.recordDiagnostic('analysis-ignored', 'busy');
    return;
  }
  const requestId = crypto.randomUUID();
  setActiveRequestId(requestId);
  try {
    const [settings, profile, apiKey, hasPermission] = await Promise.all([
      storage.getSettings(),
      storage.getProfile(),
      storage.getCredential(),
      chrome.permissions.contains({ origins: [LINKEDIN_ORIGIN] }),
    ]);
    if (!settings.onboardingComplete || !settings.analysisConsent || !settings.riskAcknowledged) {
      throw new AppError(
        'permission-missing',
        'Finish onboarding and consent before analyzing a post.',
      );
    }
    if (!hasPermission)
      throw new AppError('permission-missing', 'Grant access to linkedin.com in Settings.');
    if (!apiKey) throw new AppError('credential-missing', 'Save a Gemini API key in Settings.');
    let rawResponse: unknown;
    try {
      rawResponse = await chrome.tabs.sendMessage(tabId, {
        type: 'content:extract-selected-post',
      });
    } catch {
      throw new AppError(
        'unsupported-layout',
        'The LinkedIn page is not ready. Reload it, right-click the post again, and retry.',
      );
    }
    const extracted = parseContextResponse(rawResponse);
    const context = extracted;
    await storage.saveAnalysisState({
      status: 'running',
      requestId,
      targetType: context.responseTarget.type,
      excerpt: context.excerpt,
      startedAt: new Date().toISOString(),
    });
    const result = await provider.analyze(apiKey, context, profile, settings);
    await storage.saveAnalysisState({ status: 'success', requestId, context, result });
    const history = historyEntrySchema.parse({
      id: requestId,
      createdAt: result.generatedAt,
      responseTargetType: context.responseTarget.type,
      postExcerpt: context.excerpt,
      summary: result.summary,
      drafts: result.drafts,
      language: result.language,
      model: result.model,
    } satisfies HistoryEntry);
    await storage.addHistory(history);
    await storage.recordDiagnostic('analysis-completed');
  } catch (error) {
    const appError = toAppError(error);
    const state: AnalysisState = {
      status: 'error',
      requestId,
      code: appError.code,
      message: appError.message,
    };
    await storage.saveAnalysisState(state);
    await storage.recordDiagnostic('analysis-failed', appError.code);
  } finally {
    setActiveRequestId(null);
  }
}

function parseContextResponse(response: unknown): PostContext {
  if (!response || typeof response !== 'object')
    throw new AppError(
      'unsupported-layout',
      'The LinkedIn page did not return a selected post. Reload the page and try again.',
    );
  const record = response as Record<string, unknown>;
  if (record.ok !== true) {
    throw new AppError(
      'unsupported-layout',
      typeof record.message === 'string'
        ? record.message
        : 'The selected post could not be extracted safely.',
    );
  }
  const parsed = postContextSchema.safeParse(record.context);
  if (!parsed.success)
    throw new AppError('unsupported-layout', 'The selected post did not pass safety validation.');
  return parsed.data;
}
