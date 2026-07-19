import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import path from 'node:path';

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  const extensionPath = path.resolve(
    process.env.E2E_REQUIRED_LINKEDIN === '1' ? '.wxt/e2e-output' : '.output',
  );
  context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  let worker = context.serviceWorkers()[0];
  worker ??= await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => context.close());

test('onboarding communicates the manual-only privacy boundary', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
  await expect(
    page.getByRole('heading', { name: 'Professional Drafting Assistant' }),
  ).toBeVisible();
  await expect(page.getByText('The extension never posts, clicks, expands comments')).toBeVisible();
  await expect(page.getByRole('heading', { name: '2. Grant site access' })).toBeHidden();
  const acknowledgements = page.getByRole('checkbox');
  await acknowledgements.nth(0).check();
  await acknowledgements.nth(1).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: '1. Understand the boundary' })).toBeHidden();
  await expect(page.getByRole('heading', { name: '2. Grant site access' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'LinkedIn access granted' })).toBeVisible();
  await page.getByRole('button', { name: '6 Optional discovery' }).click();
  await expect(
    page.getByRole('heading', { name: 'Would you like help finding post ideas?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Yes, configure discovery' }).click();
  await expect(page.getByRole('heading', { name: 'Discovery connection' })).toBeVisible();
  await page.getByRole('button', { name: '2 LinkedIn access' }).click();
  await expect(page.getByRole('heading', { name: '2. Grant site access' })).toBeVisible();
});

test('device retention stores ciphertext with a non-exportable extension key', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/onboarding.html`);
  const response = (await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: 'credential:save',
      apiKey: 'e2e-device-vault-secret',
      rememberOnDevice: true,
    }),
  )) as unknown;
  expect(response).toEqual({ ok: true });

  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error('Extension service worker is missing.');
  const vault = await worker.evaluate(async () => {
    const stored = (await chrome.storage.local.get('geminiCredential')).geminiCredential;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('professional-drafting-assistant-vault', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'Could not open the test vault.'));
    });
    const key = await new Promise<CryptoKey>((resolve, reject) => {
      const request = database
        .transaction('device-keys', 'readonly')
        .objectStore('device-keys')
        .get('device-aes-gcm-v1');
      request.onsuccess = () => resolve(request.result as CryptoKey);
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'Could not read the test vault key.'));
    });
    database.close();
    return {
      serialized: JSON.stringify(stored),
      cipher:
        stored && typeof stored === 'object' ? (stored as { cipher?: unknown }).cipher : undefined,
      keyExtractable: key.extractable,
      keyAlgorithm: key.algorithm.name,
    };
  });

  expect(vault.serialized).not.toContain('e2e-device-vault-secret');
  expect(vault).toMatchObject({
    cipher: 'AES-256-GCM',
    keyExtractable: false,
    keyAlgorithm: 'AES-GCM',
  });

  await worker.evaluate(async () => {
    await chrome.storage.local.remove('geminiCredential');
    await chrome.storage.session.remove('geminiCredential');
  });
  await page.close();
});

test('side panel starts with a setup-safe state', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole('heading', { name: 'Drafting Assistant' })).toBeVisible();
  await expect(page.getByText('Private writing workspace · Local')).toBeVisible();
  const supportLink = page.getByRole('link', { name: 'Support montasim' });
  await expect(supportLink).toBeVisible();
  await expect(supportLink).toHaveAttribute('href', 'https://www.supportkori.com/montasim');
  await expect(supportLink).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('button', { name: 'Complete setup' })).toBeVisible();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Draft settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Developer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Discovery connection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Train your voice' })).toBeVisible();
  await page.getByRole('heading', { name: 'Developer' }).click();
  await expect(page.getByText('Mohammad Montasim Al Mamun Shuvo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/montasim',
  );
  await expect(page.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/montasim/',
  );
  await expect(page.getByRole('link', { name: 'Support montasim' })).toHaveCount(1);
  await page.getByRole('tab', { name: 'Discover' }).click();
  await expect(
    page.getByRole('heading', { name: 'Find post ideas from developer sources' }),
  ).toBeVisible();
  await expect(page.getByText('Discovery does not access or post on LinkedIn.')).toBeVisible();
});

test('constructive challenge behaves like every other draft direction', async () => {
  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error('Extension service worker is missing.');
  const now = new Date().toISOString();
  const drafts = [
    { strategy: 'professional-insight', text: 'Add a grounded perspective.' },
    { strategy: 'specific-question', text: 'Which evidence would change this conclusion?' },
    { strategy: 'support-and-extend', text: 'Extend the useful part of the argument.' },
    {
      strategy: 'constructive-challenge',
      text: 'The conclusion does not yet follow from the premise. Which assumption closes that gap?',
    },
  ];
  await worker.evaluate(
    async ({ now, drafts }) => {
      const summary = {
        overview: 'The response target makes a broad claim from limited evidence.',
        themes: ['AI', 'developer roles'],
        intent: 'Challenge an industry prediction',
        uncertainties: ['The prediction is not supported with evidence.'],
        risks: [],
      };
      await chrome.storage.local.set({
        settings: {
          schemaVersion: 2,
          onboardingComplete: true,
          analysisConsent: true,
          riskAcknowledged: true,
          rememberCredential: true,
          lengthMode: 'standard',
        },
        history: [
          {
            id: 'four-draft-analysis',
            createdAt: now,
            responseTargetType: 'reply',
            postExcerpt: 'Software development roles are changing.',
            summary,
            drafts,
            language: 'English',
            model: 'gemini-test',
          },
        ],
      });
      await chrome.storage.session.set({
        geminiCredential: 'e2e-key',
        analysisState: {
          status: 'success',
          requestId: 'four-draft-analysis',
          context: {
            schemaVersion: 1,
            extractionVersion: 'e2e',
            surface: 'feed',
            visiblePostText: 'Software development roles are changing.',
            visibleDiscussion: [
              {
                participantLabel: 'Target Commenter',
                text: 'The conclusion overstates what the evidence supports.',
                depth: 0,
                isTarget: true,
              },
            ],
            responseTarget: {
              type: 'reply',
              participantLabel: 'Target Commenter',
              text: 'The conclusion overstates what the evidence supports.',
            },
            excerpt: 'Software development roles are changing.',
            extractedAt: now,
          },
          result: {
            schemaVersion: 1,
            summary,
            drafts,
            language: 'English',
            model: 'gemini-test',
            generatedAt: now,
          },
        },
      });
    },
    { now, drafts },
  );

  const page = await context.newPage();
  await page.setViewportSize({ width: 400, height: 930 });
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const directions = ['Add insight', 'Ask a question', 'Build on it', 'Challenge it'];
  const directionButtons = directions.map((name) => page.getByRole('button', { name }));
  await Promise.all(directionButtons.map((button) => expect(button).toBeVisible()));
  const rows = await Promise.all(
    directionButtons.map(async (button) => Math.round((await button.boundingBox())?.y ?? -1)),
  );
  expect(new Set(rows).size).toBe(1);

  const challengeButton = page.getByRole('button', { name: 'Challenge it' });
  await challengeButton.click();
  const challengeDraft = page.getByRole('textbox', { name: 'Constructive Challenge draft' });
  const initialChallenge = drafts.find(({ strategy }) => strategy === 'constructive-challenge');
  if (!initialChallenge) throw new Error('Constructive challenge fixture is missing.');
  await expect(challengeDraft).toHaveValue(initialChallenge.text);
  const edited = 'Which evidence supports the leap from role change to role elimination?';
  await challengeDraft.fill(edited);
  await challengeDraft.blur();
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const stored = await chrome.storage.local.get('history');
        const history = stored.history as { drafts: { text: string }[] }[] | undefined;
        return history?.[0]?.drafts[3]?.text;
      }),
    )
    .toBe(edited);

  await page.close();
  await worker.evaluate(async () => {
    await chrome.storage.local.remove(['settings', 'geminiCredential', 'history']);
    await chrome.storage.session.remove(['analysisState', 'geminiCredential']);
  });
});

test('packaged content script extracts the obfuscated semantic feed layout', async () => {
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${extensionId}/onboarding.html`);
  await expect(setup.getByRole('heading', { name: '1. Understand the boundary' })).toBeVisible();

  await context.route('https://www.linkedin.com/feed/', async (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body>
        <div data-testid="commentListPostKey" data-component-type="LazyColumn">
          <div role="listitem" componentkey="expandedPostKeyFeedType_MAIN_FEED_RELEVANCE">
            <h2><span>Feed post</span></h2>
            <p><span data-testid="expandable-text-box" id="semantic-post-text">A semantic feed post.</span></p>
            <button aria-label="Comment">Comment</button>
            <div>
              <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,unrelated)">
                <a href="https://www.linkedin.com/in/unrelated-identity/">Unrelated Identity</a>
                <p><span data-testid="expandable-text-box">An unrelated thread.</span></p>
                <button aria-label="Reply">Reply</button>
              </div>
              <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,parent)"
                   componentkey="replaceableComment_urn:li:comment:(urn:li:activity:7481,parent)">
                <a href="https://www.linkedin.com/in/private-parent/">Private Parent</a>
                <p><span data-testid="expandable-text-box">A semantic-layout parent comment.</span></p>
                <button aria-label="Reply">Reply</button>
              </div>
              <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,reply)"
                   componentkey="replaceableComment_urn:li:comment:(urn:li:activity:7481,reply)"
                   style="margin-left: 36px">
                <a href="https://www.linkedin.com/in/private-replier/">Private Replier</a>
                <p><span data-testid="expandable-text-box" id="semantic-comment-text">A nested semantic-layout reply.</span></p>
                <button aria-label="Reply">Reply</button>
              </div>
              <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,next)">
                <a href="https://www.linkedin.com/in/next-identity/">Next Identity</a>
                <p><span data-testid="expandable-text-box">The next unrelated thread.</span></p>
                <button aria-label="Reply">Reply</button>
              </div>
            </div>
            <div contenteditable="true" role="textbox" aria-label="Text editor for creating reply">Composer text</div>
          </div>
        </div>
      </body></html>`,
    }),
  );
  const linkedIn = await context.newPage();
  await linkedIn.goto('https://www.linkedin.com/feed/');
  await linkedIn.locator('#semantic-comment-text').click({ button: 'right' });

  const worker = context.serviceWorkers()[0];
  if (!worker) throw new Error('Extension service worker is missing.');
  const response: unknown = await worker.evaluate(async (): Promise<unknown> => {
    const [tab] = await chrome.tabs.query({ url: 'https://www.linkedin.com/feed/' });
    if (!tab?.id) return null;
    const result: unknown = await chrome.tabs.sendMessage(tab.id, {
      type: 'content:extract-selected-post',
    });
    return result;
  });

  expect(response).toMatchObject({
    ok: true,
    context: {
      extractionVersion: '2026.07.5',
      visiblePostText: 'A semantic feed post.',
      visibleDiscussion: [
        { text: 'A semantic-layout parent comment.', depth: 0, isTarget: false },
        { text: 'A nested semantic-layout reply.', depth: 1, isTarget: true },
      ],
      responseTarget: {
        type: 'reply',
        participantLabel: 'Target Commenter',
        text: 'A nested semantic-layout reply.',
      },
    },
  });
  expect(JSON.stringify(response)).not.toMatch(
    /Private Parent|Private Replier|private-parent|private-replier|unrelated thread|Composer text/,
  );
});
