import fixture from './fixtures/linkedin-feed.html?raw';
import { extractLinkedInPost } from '../src/content/linkedin-extractor';

describe('extractLinkedInPost', () => {
  beforeEach(() => {
    document.body.innerHTML = fixture;
  });

  it('extracts the exact reply target and all visible discussion without identities', () => {
    const target = document.querySelector('#selected-comment');
    if (!target) throw new Error('Fixture target is missing.');
    const context = extractLinkedInPost(target, 'https://www.linkedin.com/feed/');

    expect(context.responseTarget).toEqual({
      type: 'reply',
      participantLabel: 'Target Commenter',
      text: 'How did you keep the documentation current?',
    });
    expect(context.visibleDiscussion).toHaveLength(2);
    expect(context.visibleDiscussion.map(({ participantLabel }) => participantLabel)).toEqual([
      'Commenter A',
      'Target Commenter',
    ]);
    expect(JSON.stringify(context)).not.toMatch(/Alice|Bob|Carol|\/in\//);
    expect(context.reactionSummary).toBe('42 reactions');
  });

  it('targets the post when the user right-clicks its text', () => {
    const target = document.querySelector('.update-components-text');
    if (!target) throw new Error('Fixture post text is missing.');
    const context = extractLinkedInPost(
      target,
      'https://www.linkedin.com/feed/update/urn:li:activity:735/',
    );
    expect(context.responseTarget.type).toBe('post');
    expect(context.surface).toBe('post-detail');
    expect(JSON.stringify(context)).not.toContain('7350000000000000000');
  });

  it('fails closed outside a supported post root', () => {
    const target = document.createElement('div');
    document.body.append(target);
    expect(() => extractLinkedInPost(target)).toThrow(/Right-click inside/);
  });

  it('keeps repost commentary and quoted text in the outer selected post', () => {
    document.body.innerHTML = `
      <article class="feed-shared-update-v2" data-urn="urn:li:activity:999">
        <div class="update-components-text">My perspective on this announcement.</div>
        <div class="feed-shared-update-v2">
          <div class="update-components-text"><span id="quoted">The original announcement.</span></div>
        </div>
      </article>`;
    const target = document.querySelector('#quoted');
    if (!target) throw new Error('Quoted fixture text is missing.');
    const context = extractLinkedInPost(target);
    expect(context.visiblePostText).toContain('My perspective');
    expect(context.visiblePostText).toContain('The original announcement');
  });

  it('supports current data-id activity roots and comment entities', () => {
    document.body.innerHTML = `
      <div data-finite-scroll-hotkey-item>
        <div class="occludable-update" data-id="urn:li:activity:7420000000000000000">
          <div class="attributed-text-segment-list__content">
            <span id="current-post-text">A current LinkedIn feed post.</span>
          </div>
          <article class="comments-comment-entity" data-id="urn:li:comment:current">
            <a href="https://www.linkedin.com/in/current-commenter/">Current Commenter</a>
            <div class="comments-comment-entity__content">
              <span id="current-comment-text">A visible current-layout comment.</span>
            </div>
          </article>
        </div>
      </div>`;
    const target = document.querySelector('#current-comment-text');
    if (!target) throw new Error('Current-layout fixture target is missing.');

    const context = extractLinkedInPost(target, 'https://www.linkedin.com/feed/');

    expect(context.visiblePostText).toBe('A current LinkedIn feed post.');
    expect(context.responseTarget).toEqual({
      type: 'reply',
      participantLabel: 'Target Commenter',
      text: 'A visible current-layout comment.',
    });
    expect(JSON.stringify(context)).not.toMatch(/Current Commenter|current-commenter/);
  });

  it('supports the obfuscated semantic feed layout', () => {
    document.body.innerHTML = `
      <div id="expandedPostKeyFeedType_MAIN_FEED_RELEVANCE" componentkey="expandedPostKeyFeedType_MAIN_FEED_RELEVANCE">
        <div role="listitem" componentkey="post-key">
          <h2><span>Feed post</span></h2>
          <p><span data-testid="expandable-text-box" id="semantic-post-text">A semantic feed post.</span></p>
          <button aria-label="Comment">Comment</button>
          <div data-testid="commentListPostKey" data-component-type="LazyColumn">
            <div
              id="replaceableComment_urn:li:comment:(urn:li:activity:7481,7482)"
              componentkey="replaceableComment_urn:li:comment:(urn:li:activity:7481,7482)"
            >
              <a href="https://www.linkedin.com/in/semantic-commenter/">Semantic Commenter</a>
              <p>
                <span data-testid="expandable-text-box" id="semantic-comment-text">
                  A semantic-layout comment.
                </span>
              </p>
              <button aria-label="Reply">Reply</button>
            </div>
          </div>
        </div>
      </div>`;
    const target = document.querySelector('#semantic-comment-text');
    if (!target) throw new Error('Semantic-layout fixture target is missing.');

    const context = extractLinkedInPost(target, 'https://www.linkedin.com/feed/');

    expect(context.extractionVersion).toBe('2026.07.5');
    expect(context.visiblePostText).toBe('A semantic feed post.');
    expect(context.visibleDiscussion).toHaveLength(1);
    expect(context.responseTarget).toEqual({
      type: 'reply',
      participantLabel: 'Target Commenter',
      text: 'A semantic-layout comment.',
    });
    expect(JSON.stringify(context)).not.toMatch(/Semantic Commenter|semantic-commenter/);
  });

  it('extracts the post and complete visible thread for an indented semantic reply target', () => {
    document.body.innerHTML = `
      <div data-testid="commentListPostKey" data-component-type="LazyColumn">
        <div role="listitem" componentkey="expandedPostKeyFeedType_FEED_DETAIL">
          <p><span data-testid="expandable-text-box">The original post.</span></p>
          <div>
            <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,unrelated)">
              <a id="unrelated-author" href="https://www.linkedin.com/in/unrelated/">Unrelated Person</a>
              <p><span data-testid="expandable-text-box">An unrelated comment.</span></p>
              <button aria-label="Reply">Reply</button>
            </div>
            <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,parent)">
              <a id="parent-author" href="https://www.linkedin.com/in/parent/">Parent Person</a>
              <p><span data-testid="expandable-text-box">The parent comment.</span></p>
              <button aria-label="Reply">Reply</button>
            </div>
            <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,selected-reply)">
              <a id="selected-author" href="https://www.linkedin.com/in/replier/">Reply Person</a>
              <p><span data-testid="expandable-text-box" id="selected-nested-reply">The selected nested reply.</span></p>
              <button aria-label="Reply">Reply</button>
            </div>
            <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,later-reply)">
              <a id="later-author" href="https://www.linkedin.com/in/parent/">Parent Person</a>
              <p><span data-testid="expandable-text-box">A later reply in the same thread.</span></p>
              <button aria-label="Reply">Reply</button>
            </div>
            <div id="replaceableComment_urn:li:comment:(urn:li:activity:7481,next-thread)">
              <a id="next-author" href="https://www.linkedin.com/in/next/">Next Person</a>
              <p><span data-testid="expandable-text-box">The next unrelated thread.</span></p>
              <button aria-label="Reply">Reply</button>
            </div>
          </div>
          <div contenteditable="true" role="textbox" aria-label="Text editor for creating reply">
            Reply composer text must not be extracted.
          </div>
        </div>
      </div>`;
    setInlineStart('#unrelated-author', 16);
    setInlineStart('#parent-author', 16);
    setInlineStart('#selected-author', 52);
    setInlineStart('#later-author', 52);
    setInlineStart('#next-author', 16);
    const target = document.querySelector('#selected-nested-reply');
    if (!target) throw new Error('Nested reply fixture target is missing.');

    const beforeExtraction = document.body.innerHTML;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const context = extractLinkedInPost(
      target,
      'https://www.linkedin.com/feed/update/urn:li:activity:7481/',
    );

    expect(context.visiblePostText).toBe('The original post.');
    expect(
      context.visibleDiscussion.map(({ text, depth, isTarget }) => ({
        text,
        depth,
        isTarget,
      })),
    ).toEqual([
      { text: 'The parent comment.', depth: 0, isTarget: false },
      { text: 'The selected nested reply.', depth: 1, isTarget: true },
      { text: 'A later reply in the same thread.', depth: 1, isTarget: false },
    ]);
    expect(context.responseTarget).toEqual({
      type: 'reply',
      participantLabel: 'Target Commenter',
      text: 'The selected nested reply.',
    });
    expect(JSON.stringify(context)).not.toMatch(
      /unrelated comment|next unrelated thread|Reply composer|Person|\/in\//,
    );
    expect(document.body.innerHTML).toBe(beforeExtraction);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fails closed when an explicitly nested reply has no visible parent comment', () => {
    document.body.innerHTML = `
      <div id="expandedPostKeyFeedType_FEED_DETAIL">
        <p><span data-testid="expandable-text-box">The original post.</span></p>
        <div
          id="replaceableComment_urn:li:comment:(urn:li:activity:7481,orphan)"
          data-depth="1"
        >
          <a href="https://www.linkedin.com/in/orphan/">Orphan Person</a>
          <p><span data-testid="expandable-text-box" id="orphan-reply">An orphan reply.</span></p>
        </div>
      </div>`;
    const target = document.querySelector('#orphan-reply');
    if (!target) throw new Error('Orphan reply fixture target is missing.');

    expect(() => extractLinkedInPost(target)).toThrow(/no visible parent comment/);
  });
});

function setInlineStart(selector: string, left: number): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  element.getBoundingClientRect = () => ({
    bottom: 56,
    height: 40,
    left,
    right: left + 40,
    top: 16,
    width: 40,
    x: left,
    y: 16,
    toJSON: () => ({}),
  });
}
