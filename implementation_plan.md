# UI Refinements, Deletion Warnings, and Directory Persistence Plan

This plan details the implementation of Task 63, which includes resolving the destination path persistence bug, aligning columns during resize, adding delete confirmation warnings for processing files, optimizing the waveform player toggle transition, updating the history panel, and cleaning up temporary app files on exit.

## User Review Required

> [!IMPORTANT]
> - We will add a shutdown cleanup routine in Rust to scan and remove any recorded or processed temporary audio/video files from the user's system temp directory when the application exits.
> - The A/B toggle buttons will be completely removed from the table rows and grid cards. They will remain fully functional inside the bottom Waveform Player panel.
> - The history refresh button will be removed, and clicking any history card will immediately open the containing folder in Explorer and select/highlight the file.

## Proposed Changes

### Database & Tauri Commands

#### [MODIFY] [queue.rs](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src-tauri/src/db/queue.rs)
- Implement `update_job_destination(conn: &Connection, id: &str, destination: &str) -> Result<()>` to update the `destination` column in the SQLite database.

#### [MODIFY] [queue.rs](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src-tauri/src/commands/queue.rs)
- Implement `set_destination` command to call `db::queue::update_job_destination`.
- Implement `show_item_in_folder` command to open explorer.exe with `/select,"<path>"` on Windows, macOS `open -R`, or `xdg-open` on Linux.

#### [MODIFY] [lib.rs](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src-tauri/src/lib.rs)
- Import `set_destination` and `show_item_in_folder`.
- Register both commands inside `invoke_handler`.
- Add `cleanup_temp_files` helper to search database for paths starting with the temp folder and delete them on application shutdown (`CloseRequested` window event).

---

### Frontend API and UI Components

#### [MODIFY] [ipc.ts](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/lib/ipc.ts)
- Add `invokeSetDestination(jobId: string, destination: string)` and `invokeShowItemInFolder(path: string)` wrappers.

#### [MODIFY] [en.json](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/i18n/locales/en.json) & [id.json](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/i18n/locales/id.json)
- Add `"confirmDeleteProcessing"` translation keys under the `"queue"` section.

#### [MODIFY] [HistoryPanel.tsx](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/components/HistoryPanel.tsx)
- Remove the refresh button (`RefreshCw`) from the header.
- Add `cursor-pointer` to the row container.
- Implement an `onClick` handler on the history item to call `invokeShowItemInFolder(job.output_filepath)`.

#### [MODIFY] [QueueGrid.tsx](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/components/QueueGrid.tsx)
- **Status Column Fix:** Give the `STATUS` column a fixed width `w-32` in the table header and body, so it stays aligned.
- **Filename Column Flex:** Apply `width: '100%', minWidth: colWidths.filename` style to the `FILENAME` header cell so it acts as the flexible column, keeping all right-hand columns anchored together.
- **Destination Column width:** Apply `colWidths.destination` to both `th` and row `td` elements dynamically.
- **Remove Row/Card AB Toggle:** Replace A/B buttons with a simple `StatusBadge` in both table row and grid card.
- **Single Delete Warning:** In the single trash button `onClick`, check if `job.status === 'processing'` or `job.status === 'queued'` and show a confirmation warning.
- **Clear All Warning:** In the clear all confirmation modal, display an extra warning message if any non-locked items in the queue are currently in `processing` or `queued` state.

#### [MODIFY] [QueueToolbar.tsx](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/components/QueueToolbar.tsx)
- In `handleDeleteSelected`, check if any selected job is `processing` or `queued`. If so, show a confirmation warning before deleting.

#### [MODIFY] [useKeyboardShortcuts.ts](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/hooks/useKeyboardShortcuts.ts)
- In the delete selected items shortcut handler, check if any of the items to be deleted are `processing` or `queued`. If so, show a confirmation warning.

#### [MODIFY] [WaveformPlayer.tsx](file:///d:/vibe%20coding/app%20enhance%20audio%20pro/src/components/WaveformPlayer.tsx)
- Completely remove the loading waveform overlay paragraph (`{isLoading && ...}`) so toggling A/B or swapping tracks happens directly and smoothly in the background without overlay flashing.

---

## Verification Plan

### Automated Checks
- Compile the Tauri application.
- Validate there are no compilation or TypeScript errors.

### Manual Verification
1. Open settings, verify general settings and language toggle.
2. Add multiple files to the queue:
   - Change output destination on one or more files (e.g. to a specific path). Start enhance. Verify that the enhanced output is saved to the chosen folder.
3. Verify table column resizing:
   - Resize "FILENAME" and "DESTINATION" columns. Shrink them and confirm the right-hand columns remain anchored to the right side and do not drift apart.
4. Verify done status badge:
   - Enhance a file. Once done, verify that the status badge changes to green "Done" (no A/B buttons in the row).
5. Test delete warnings:
   - Trigger enhancement of a file (so it is processing).
   - Try to delete the processing file (via single row trash icon, select and press delete, or select and click toolbar trash). Confirm a warning popup appears.
   - Click "Clear" header button. Verify the modal shows warning about processing files.
6. Test WaveformPlayer A/B Toggle:
   - Click play on a completed job to load it in the waveform player.
   - Click "Enhanced / Original" toggle below the waveform. Verify that the switch is instant and no "loading waveform..." text overlay flashes.
7. Test History Panel:
   - Open history panel using sidebar or `Ctrl + H`. Verify the refresh icon is removed.
   - Click on a history row. Verify that File Explorer opens, highlights/selects the enhanced output file.
8. Test App Exit Cleanup:
   - Record some audio (saved in temp folder).
   - Close the app. Verify that the recorded `.wav` file is deleted from the system temp directory.
