type NavigatorWithUAData = Navigator & {
  userAgentData?: { platform?: string };
};

const nav = navigator as NavigatorWithUAData;

// Prefer the modern User-Agent Client Hints API, fall back to the deprecated
// navigator.platform, and finally to the userAgent string.
const platform =
  nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent;

export const isMac = /mac/i.test(platform);
