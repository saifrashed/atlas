# Fix startup and create the four-part Atlas walkthrough

## Changes
- Remove the startup overlay so Atlas opens directly without a white/blank beginning.
- Extend the right-side AI chat to explain the currently opened XML document as well as XSD schemas.
- Include saved review comments in the Documentation page and Markdown export.
- Keep the existing visual compare view and verify its added/removed highlighting.

## Verification and walkthrough
- Use only fictional demo XML/XSD data.
- Test this complete journey in the running app:
  1. Import an XML/XSD example, open its schema diagram, add a node and a comment.
  2. Ask AI to explain the XML structure.
  3. Compare schema versions and show changed lines.
  4. Export Markdown and confirm the comments are included.
- Record a fresh Loom-style MP4 of those four steps.
- Add a generated English voice-over if local narration quality is usable; otherwise deliver the full timed narration text with the video.

## Technical details
- Reuse the current Explorer, AI chat, Compare, comments, and Documentation flows rather than adding new tabs.
- Keep AI context server-side and use the existing assigned model and error behavior.
- Validate the startup, interactions, downloaded Markdown, audio track, and final video frames.
