export const LINKEDIN_ORIGIN = 'https://www.linkedin.com/*';

export function requestLinkedInPermission(): Promise<boolean> {
  // Keep this as the first browser API call from the click handler. Chrome rejects optional
  // permission requests deferred through runtime messaging because the user gesture is lost.
  return chrome.permissions.request({ origins: [LINKEDIN_ORIGIN] });
}
