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
import { GeminiDiscoveryClient } from '../src/infrastructure/gemini-discovery-client';
import { GroqClient } from '../src/infrastructure/groq-client';
import {
  analyzeAndSaveVoice,
  discoveryFailure,
  generateOpportunityDraft,
  persistCompletedDiscovery,
  runDiscovery,
} from '../src/application/discovery-service';
import {
  getDiscoveryPermissions,
  removeAllDiscoveryPermissions,
} from '../src/infrastructure/discovery-permission';
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
  const discoveryProvider = new GroqClient();
  const geminiDiscoveryProvider = new GeminiDiscoveryClient();
  let activeRequestId: string | null = null;
  let activeDiscovery: AbortController | null = null;

  const ready = initialize(storage);

  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install')
      void chrome.tabs.create({ url: chrome.runtime.getURL('/onboarding.html') });
  });

  chrome.permissions.onAdded.addListener((permissions) => {
    if (permissions.origins?.includes(LINKEDIN_ORIGIN)) void scheduleLinkedInIntegration();
  });
  chrome.permissions.onRemoved.addListener((permissions) => {
    if (permissions.origins?.includes(LINKEDIN_ORIGIN)) void scheduleLinkedInIntegration();
  });

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
            discoveryProvider,
            geminiDiscoveryProvider,
            () => activeRequestId,
            (value) => (activeRequestId = value),
            () => activeDiscovery,
            (value) => (activeDiscovery = value),
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
  await storage.migratePlaintextCredentials();
  const previousState = await storage.getAnalysisState();
  if (previousState.status === 'running') {
    await storage.saveAnalysisState({
      status: 'error',
      requestId: previousState.requestId,
      code: 'provider-unavailable',
      message: 'The previous analysis was interrupted when the extension stopped.',
    });
  }
  const previousDiscoveryState = await storage.getDiscoveryState();
  if (previousDiscoveryState.status === 'running') {
    await storage.saveDiscoveryState({
      status: 'error',
      runId: previousDiscoveryState.runId,
      code: 'provider-unavailable',
      message: 'The previous discovery operation was interrupted when the extension stopped.',
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
  discoveryProvider: GroqClient,
  geminiDiscoveryProvider: GeminiDiscoveryClient,
  getActiveRequestId: () => string | null,
  setActiveRequestId: (value: string | null) => void,
  getActiveDiscovery: () => AbortController | null,
  setActiveDiscovery: (value: AbortController | null) => void,
): Promise<RuntimeResponse> {
  switch (request.type) {
    case 'setup:get': {
      const [settings, profile, credentialState, hasLinkedInPermission] = await Promise.all([
        storage.getSettings(),
        storage.getProfile(),
        storage.getCredentialState(),
        chrome.permissions.contains({ origins: [LINKEDIN_ORIGIN] }),
      ]);
      return {
        ok: true,
        setup: {
          settings,
          profile,
          hasCredential: credentialState === 'session' || credentialState === 'unlocked',
          credentialState,
          hasLinkedInPermission,
        },
      };
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
      if (!request.settings.rememberCredential) await storage.forgetCredentialOnDevice();
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
    case 'discovery:get': {
      const [settings, voice, state, current, history, credentialState, permissions] =
        await Promise.all([
          storage.getDiscoverySettings(),
          storage.getVoiceSettings(),
          storage.getDiscoveryState(),
          storage.getDiscoveryResult(),
          storage.listPublicationHistory(),
          storage.getDiscoveryCredentialState(),
          getDiscoveryPermissions(),
        ]);
      return {
        ok: true,
        discovery: {
          settings,
          voice,
          state,
          current,
          history,
          hasCredential: credentialState === 'session' || credentialState === 'unlocked',
          credentialState,
          permissions,
        },
      };
    }
    case 'discovery:credential-validate':
      return {
        ok: true,
        valid: await discoveryProvider.validateCredential(request.apiKey),
      };
    case 'discovery:credential-save':
      await storage.saveDiscoveryCredential(request.apiKey, request.rememberOnDevice);
      return { ok: true };
    case 'discovery:credential-clear':
      await storage.clearDiscoveryCredential();
      return { ok: true };
    case 'discovery:settings-save':
      if (!request.settings.rememberCredential) await storage.forgetDiscoveryCredentialOnDevice();
      await storage.saveDiscoverySettings(request.settings);
      return { ok: true };
    case 'discovery:disable': {
      getActiveDiscovery()?.abort();
      const settings = await storage.getDiscoverySettings();
      await Promise.all([
        storage.saveDiscoverySettings({ ...settings, enabled: false, consent: false }),
        storage.clearDiscoveryCurrent(),
        storage.clearDiscoveryCredential(),
        removeAllDiscoveryPermissions(),
      ]);
      return { ok: true };
    }
    case 'discovery:run': {
      if (getActiveDiscovery())
        return { ok: false, code: 'busy', message: 'A discovery operation is already running.' };
      const runId = crypto.randomUUID();
      const controller = new AbortController();
      const startedAt = new Date().toISOString();
      setActiveDiscovery(controller);
      await storage.saveDiscoveryState({
        status: 'running',
        runId,
        stage: 'collecting',
        startedAt,
      });
      try {
        const overrideApiKey =
          request.provider === 'gemini' ? await storage.getCredential() : undefined;
        if (request.provider === 'gemini' && !overrideApiKey)
          throw new AppError(
            'credential-missing',
            'Save a Gemini API key before using the manual discovery override.',
          );
        const result = await runDiscovery(
          runId,
          storage,
          request.provider === 'gemini' ? geminiDiscoveryProvider : discoveryProvider,
          controller.signal,
          async (stage) =>
            storage.saveDiscoveryState({
              status: 'running',
              runId,
              stage,
              startedAt,
            }),
          overrideApiKey ?? undefined,
          request.provider === 'gemini',
        );
        await persistCompletedDiscovery(storage, result);
        await storage.saveDiscoveryState({
          status: 'success',
          runId,
          completedAt: result.completedAt,
        });
        await storage.recordDiagnostic('discovery-completed');
        return { ok: true };
      } catch (error) {
        if (controller.signal.aborted) {
          await storage.saveDiscoveryState({ status: 'idle' });
          await storage.recordDiagnostic('discovery-cancelled');
          return { ok: true };
        }
        const failure = discoveryFailure(error);
        await storage.saveDiscoveryState({ status: 'error', runId, ...failure });
        await storage.recordDiagnostic('discovery-failed', failure.code);
        return { ok: false, ...failure };
      } finally {
        setActiveDiscovery(null);
      }
    }
    case 'discovery:cancel':
      getActiveDiscovery()?.abort();
      return { ok: true };
    case 'discovery:generate': {
      if (getActiveDiscovery())
        return { ok: false, code: 'busy', message: 'A discovery operation is already running.' };
      const controller = new AbortController();
      setActiveDiscovery(controller);
      try {
        const overrideApiKey =
          request.provider === 'gemini' ? await storage.getCredential() : undefined;
        if (request.provider === 'gemini' && !overrideApiKey)
          throw new AppError(
            'credential-missing',
            'Save a Gemini API key before using the manual draft override.',
          );
        await generateOpportunityDraft(
          request.opportunityId,
          request.alternative,
          storage,
          request.provider === 'gemini' ? geminiDiscoveryProvider : discoveryProvider,
          controller.signal,
          overrideApiKey ?? undefined,
        );
        return { ok: true };
      } finally {
        setActiveDiscovery(null);
      }
    }
    case 'discovery:update-draft':
      await storage.updatePublicationDraft(request.opportunityId, request.text);
      return { ok: true };
    case 'discovery:clear-seen':
      await storage.clearSeenItems();
      return { ok: true };
    case 'voice:save':
      await storage.saveVoiceSettings(request.voice);
      return { ok: true };
    case 'voice:analyze': {
      if (getActiveDiscovery())
        return { ok: false, code: 'busy', message: 'A discovery operation is already running.' };
      const controller = new AbortController();
      setActiveDiscovery(controller);
      try {
        return {
          ok: true,
          guide: await analyzeAndSaveVoice(
            request.samples,
            storage,
            discoveryProvider,
            controller.signal,
          ),
        };
      } finally {
        setActiveDiscovery(null);
      }
    }
    case 'publication-history:delete':
      await storage.deletePublicationHistory(request.entryId);
      return { ok: true };
    case 'publication-history:update-draft':
      await storage.updatePublicationHistoryDraft(request.entryId, request.text);
      return { ok: true };
    case 'publication-history:clear':
      await storage.clearPublicationHistory();
      return { ok: true };
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
