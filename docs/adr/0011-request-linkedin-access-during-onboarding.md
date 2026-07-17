---
status: accepted
---

# Request LinkedIn host access during onboarding

The extension will declare LinkedIn as an optional host and request access only to `https://www.linkedin.com/*` after the user completes disclosure and Risk Acknowledgment and initiates the permission request. It will then register the isolated content script for that host, accepting an extra onboarding step in exchange for no LinkedIn access at installation and a narrow, explicit permission boundary; access to all sites is prohibited.
