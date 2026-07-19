import {
  LINKEDIN_ORIGIN,
  requestLinkedInPermission,
} from '../src/infrastructure/linkedin-permission';

describe('LinkedIn permission request', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the optional permission API directly for the LinkedIn origin', async () => {
    const request = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('chrome', { permissions: { request } });

    await expect(requestLinkedInPermission()).resolves.toBe(true);
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith({ origins: [LINKEDIN_ORIGIN] });
  });
});
