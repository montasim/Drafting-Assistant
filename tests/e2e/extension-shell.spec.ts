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
});

test('side panel starts with a setup-safe state', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole('heading', { name: 'Drafting Assistant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete private setup' })).toBeVisible();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Developer' })).toBeVisible();
  const settingsCard = page.getByRole('heading', { name: 'Settings & privacy' }).locator('..');
  await expect(settingsCard.getByRole('heading', { name: 'Developer' })).toHaveCount(0);
  await expect(page.getByText('Mohammad Montasim Al Mamun Shuvo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/montasim',
  );
  await expect(page.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/montasim/',
  );
  const supportButton = page.getByRole('button', { name: 'Support montasim' });
  await expect(supportButton).toBeVisible();
  await expect(supportButton).toHaveAttribute('aria-expanded', 'false');
  await supportButton.click();
  await expect(supportButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTitle('Support montasim')).toHaveAttribute(
    'src',
    'https://www.supportkori.com/widget/montasim',
  );
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
