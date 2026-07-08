Task: Update the "User Guide" text inside the Settings panel (tab User Guide) of the Enhance Audio Pro app.

Context: The app previously had ManipulationPanel (Trim/Speed/Pitch/Volume/Fade), 11-band EQPanel, merge/loop, and Demucs stem separation. These features have already been removed from the codebase per a locked scope decision — the app now only supports Enhance (DeepFilterNet3 noise reduction) and Convert (format conversion, mp3⇄wav auto-toggle, video audio extraction).

Problem: The current "Getting Started" text in the Settings > User Guide tab still references the removed features:
"Drop audio or video files onto the drop zone... Select pending files and click Enhance to apply AI-powered noise removal using DeepFilterNet3 — adjust the strength in General settings. Click Separate Stems to split audio into vocals, drums, bass, and other parts via Demucs. Convert between MP3, WAV, FLAC, AAC, OGG, OPUS, and M4A using the toolbar or per-file format selector. Click any queue row to open the manipulation panel for Trim, Speed, Pitch, Volume, Fade, Merge, Loop, and an 11-band EQ. Select a completed file to open the waveform player with A/B toggle to compare original and enhanced audio. Click the microphone icon to record directly from your input device."

Find where this string lives in the codebase (likely a component under src/ related to Settings or UserGuide, or a constants/i18n file) and rewrite it to:
1. Remove all mentions of: Separate Stems, Demucs, manipulation panel, Trim, Speed, Pitch, Volume (as a standalone control), Fade, Merge, Loop, 11-band EQ.
2. Keep only what's actually implemented: DropZone (drag-and-drop + file dialog), Enhance (DeepFilterNet3 + Enhancement Strength slider), Convert (format list: MP3, WAV, FLAC, AAC, OGG, OPUS, M4A — confirm actual supported list against fileValidation.ts before finalizing), QueueGrid (per-row and bulk Enhance/Convert, play/lock/delete/download), WaveformPlayer (A/B toggle, gain/dB control, zoom), keyboard shortcuts, and Record (mic input).
3. Match the tone/length of the original (short paragraph, plain sentences, no marketing language).

Show me the diff before applying. Also flag if you find the same removed-feature references anywhere else in the UI (tooltips, placeholder text, other help strings) so I can decide whether to fix those too.