# Official platform playback

These modules were adapted from the MIT-licensed Yingjian Video Notes v0.43.0 source (2026-09-14):

- shared/online-video.mjs: allowlisted URL parsing and canonical video/part identity.
- shared/online-page.mjs: locally authored media sampling/control in a sandboxed official frame.
- electron/online-resolver.mjs: bounded Bilibili HTTPS short-link redirects.
- electron/online-controller.mjs: isolated official platform windows and verified playback state.

The implementation is bundled with ThoughtSpace and does not import the sibling project or require the Yingjian plugin. Source copies contain the original MIT notice. ThoughtSpace uses its own per-provider session partition. No global request interception, local server, stream extraction or remote code evaluation in the plugin context is added. The only injected function is the locally authored onlinePageAction in a trusted, sandboxed official frame.

Local changes invalidate pending samples and commands across navigation, reload, newer seek/open requests and explicit video adoption. State is published only after actual media readback. Platform selectors and runtime compatibility can change; unit tests with injected Electron dependencies do not prove current public video playback.

Source parsing and redirect validation reject duplicate identity/time parameters, conflicting start-time fields, malformed times, control characters, explicit ports, credentials, backslashes and dot path segments before URL normalization. This prevents silently attaching notes to one interpretation of an ambiguous source URL.
