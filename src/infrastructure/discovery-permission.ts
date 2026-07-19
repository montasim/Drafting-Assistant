import { DISCOVERY_SOURCE_IDS, type DiscoverySourceId } from '../domain/discovery';

export const GROQ_ORIGIN = 'https://api.groq.com/*';

export const DISCOVERY_SOURCE_ORIGINS: Record<DiscoverySourceId, string> = {
  'hacker-news': 'https://hacker-news.firebaseio.com/*',
  dev: 'https://dev.to/*',
  medium: 'https://medium.com/*',
  lobsters: 'https://lobste.rs/*',
  'stack-overflow': 'https://api.stackexchange.com/*',
};

export type DiscoveryPermissionSnapshot = Record<DiscoverySourceId, boolean> & {
  groq: boolean;
};

export async function getDiscoveryPermissions(): Promise<DiscoveryPermissionSnapshot> {
  const pairs = await Promise.all([
    ...DISCOVERY_SOURCE_IDS.map(
      async (source) =>
        [
          source,
          await chrome.permissions.contains({ origins: [DISCOVERY_SOURCE_ORIGINS[source]] }),
        ] as const,
    ),
    Promise.resolve([
      'groq',
      await chrome.permissions.contains({ origins: [GROQ_ORIGIN] }),
    ] as const),
  ]);
  return Object.fromEntries(pairs) as DiscoveryPermissionSnapshot;
}

export async function requestDiscoveryPermissions(sources: DiscoverySourceId[]): Promise<boolean> {
  const origins = [GROQ_ORIGIN, ...sources.map((source) => DISCOVERY_SOURCE_ORIGINS[source])];
  return chrome.permissions.request({ origins: [...new Set(origins)] });
}

export async function removeSourcePermission(source: DiscoverySourceId): Promise<void> {
  await chrome.permissions.remove({ origins: [DISCOVERY_SOURCE_ORIGINS[source]] });
}

export async function removeAllDiscoveryPermissions(): Promise<void> {
  const snapshot = await getDiscoveryPermissions();
  const origins = [
    ...(snapshot.groq ? [GROQ_ORIGIN] : []),
    ...DISCOVERY_SOURCE_IDS.filter((source) => snapshot[source]).map(
      (source) => DISCOVERY_SOURCE_ORIGINS[source],
    ),
  ];
  if (origins.length > 0) await chrome.permissions.remove({ origins });
}
