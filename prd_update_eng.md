# Product Requirements Document (PRD) - Enhance Audio Pro Feature Updates

This document summarizes the update notes and functional improvements that need to be implemented in the application.

## 1. Light Mode Improvements ✅
- **UI Element Visibility:** Ensure all text, queue lists, and settings menu elements are clearly visible with proper contrast when Light Mode is active.
- **Toolbar Visibility Bug Fix:** Fix an issue in Light Theme where the Search files box, filter dropdown, convert to dropdown, and "Record" button are completely invisible. Ensure these elements have proper contrast/background colors to be visible.
- **Comprehensive Theme Coverage:** Applying Light Mode must change the theme of the entire application interface consistently, not just specific parts.

## 2. Settings Persistence & Global Changes ✅
- **Automatic Configuration Saving:** All setting changes made by the user (such as theme selection, default output directory, etc.) must be saved persistently. When the user reopens the app, the last chosen configuration will be directly applied.
- **Global Language Application:** Language changes must be applied thoroughly across all parts of the app. This includes translating the "Processed Files History" panel and its description, as well as the dynamic text in the dropzone (e.g., "Drop audio here").
- **DeepFilterNet AI Model Integration:** The DeepFilterNet AI model for noise removal must be embedded/bundled directly into the application. The AI model download button in the settings menu must be removed, allowing immediate usage.

## 3. User Guide & Settings UI Changes ✅
- **Compact Paragraph Format:** Change the layout structure of the User Guide from a column/accordion format to be fully compacted into a single continuous paragraph under the "Getting Started" section.
- **Hide Settings Scrollbar:** Hide the visual scrollbar in the settings menu (both in the General and User Guide tabs). However, the content area must remain scrollable using the mouse wheel or trackpad.
- **User Guide Localization:** Ensure that the User Guide text is also correctly translated when the application language is changed (e.g., to Indonesian).

## 4. Scroll & Background Interaction Prevention ✅
- **Main Page Locking:** When the user opens the "Settings" window/modal, the system must prevent user interaction with the main page.
- **Prevent App Window Scroll:** Prevent the entire application window from being scrollable (so the app interface doesn't move down). Scrolling should only apply specifically inside the file queue container or history panel.

## 5. Main Screen Table UI Enhancements ✅
- **Table Header Layout:** Improve the text display on the main screen table column headers. Short text (such as "SAMPLE HZ") should not be cut into two lines.
- **Resizable Columns:** Users must be able to adjust/drag the column widths specifically for "FILENAME" and "DESTINATION" according to their preferences.
- **Individual Clickable Destination:** The "DESTINATION" column on each audio file row must be clickable to allow users to specify a specific output directory for that file.
- **Batch Destination Selection (Multi-selection):** Support multi-selection functionality on the file queue. If the user selects multiple files at once, changing the destination on *one* of the selected files will automatically update the destination of all other selected files.

## 6. Dropzone Text & Interaction Adjustments ✅
- **Dynamic Text:** Change the text in the dropzone area dynamically based on the active tab ("Drop audio files here" on the Audio tab, and "Drop video files here" on the Video tab). This text must also support language translation.
- **Click to Open File Explorer:** The dropzone area will not only function for drag-and-drop but will also be clickable. When clicked, it will directly open the File Explorer pop-up window to select files.

## 7. Grid View & Shortcuts ✅
- **Grid View Layout:** Modify the Grid View mode for the file queue so that a single row displays exactly 3 file boxes side-by-side.
- **View Shortcuts:** Add keyboard shortcuts: press `1` to switch to Table View and `2` to switch to Grid View. These new shortcuts must be automatically added to the Shortcuts menu information in the Settings.

## 8. Deselecting Queue Files ✅
- **Click Outside Area:** In addition to using the `X` shortcut to deselect files in the queue, users can now deselect files by clicking on the empty area outside the queued file boxes.

## 9. Recent Files Shortcut ✅
- **History Shortcut:** Add the keyboard shortcut `Ctrl + H` to open the processed files history panel (Recent Files). This new shortcut information must be added to the Shortcuts menu in the Settings.

## 10. Toolbar Layout Reordering ✅
- **Left Grouping (Primary Action Buttons):** Move the main action buttons ("Enhance", "Separate Stems", "Convert", and "Record") to the left side of the toolbar. The box width of these four buttons should be made equal to the width of the "Record" button.
- **Right Grouping (Additional Tools & Icons):** Move the Search files input, filter dropdown, format dropdown (Convert to), and the row of icons (Switch to table view, Open file, Group by format, and Trash) to the right side of the toolbar. This new layout must be applied consistently across both the Audio and Video tabs.

## 11. Settings Persistence Bug Fix ✅
- **Save Settings History:** Fix a bug where user settings (such as Portuguese language, default output folder, and Light Theme) are not saved after restarting the app. The application must permanently save user preferences so they don't have to reconfigure them on every launch.

## 12. File Import Enhancements (Folder Import & Drag-and-Drop) ✅
- **Shortcut Fix:** Fix the `Ctrl+Shift+O` shortcut so it properly imports files from a selected folder.
- **Folder Drag-and-Drop:** Add drag-and-drop support for folders. If a user drags and drops a folder containing audio/video files into the app, all supported files within that folder should automatically be added to the queue.

## 13. Light Theme Color Palette Update ✅
- **Professional Palette:** Use a professional, soft, yet high-contrast black-and-white color palette for the Light Theme. Remove bright blue or green colors from boxes and buttons.
- **Table Header Color:** Change the table column header text to bold black (instead of gray) when in Light Theme.
- **Element Background Colors:** Apply a gray background color to the search box, filters, and dropdowns that were previously invisible (blending into the background).
- **Primary Button Colors:** Change the primary action buttons (Enhance, Separate Stems, Convert) to gray to match the overall Light Theme aesthetic.

## 14. Settings Modal Width Adjustment ✅
- **Reduce Modal Width:** Reduce the overall width of the "Settings" pop-up modal, as the current layout is too wide.

## 15. Dynamic User Guide Localization ✅
- **User Guide Translation:** Ensure that the text inside the "User Guide" tab updates dynamically to match the selected language in the settings (e.g., displaying in Indonesian or Portuguese when selected).

## 16. Table View Column Dividers ✅
- **Vertical Lines:** Add vertical divider lines between columns in Table View to clearly distinguish the boundaries between each column.

## 17. Process Isolation ✅
- **Separate Operations:** Isolate the Enhance, Separate Stems, and Convert processes from each other to prevent background task collisions or conflicts.

## 18. Sequential Queue Processing & Status Indicators ✅
- **Sequential Batch Processing:** When a user initiates a batch action (enhance/separate/convert) on multiple queued files, the files must be processed one by one sequentially, starting from the top. The next file will only begin processing after the previous one finishes.
- **Status Color Indicators:**
  - **Pending:** Bone white / light gray.
  - **Processing:** Yellow.
  - **Done:** Green.
  - **Error:** Red (include a hover tooltip explaining the specific error or if it was abruptly stopped).

## 19. Format Group Collapsible Toggle ✅
- **Hide/Unhide Groups:** When the "Group by format" feature is active, allow users to collapse (hide) and expand (unhide) the groups by clicking a toggle icon next to the format name.

## 20. Lock Queue Items Feature ✅
- **Lock Functionality:** Fix the "Lock all" and "Lock selected" functions so they effectively lock file queue items, preventing them from being deleted.
- **Lock Icon Indicator:** Display a lock icon on the far right of any locked queue item. The icon should be blue in Light Theme and black in Dark Theme.

## 21. Theme-Specific Icon and Button Colors ✅
- **Dark Theme:** Change the "Separate Stems" button, "Convert" button, and the "Audio" icon in the left sidebar to a gray color (similar to the Record or Search files buttons).
- **Light Theme:** Change the "Video" icon in the left sidebar, "Enhance" button, "Separate Stems" button, "Convert" button, and "Record" button to a gray color (similar to the Search files button).

## 22. Thicken Table View Column Dividers ✅
- Increase the thickness of the vertical divider lines in the Table View to make them more visible.

## 23. Lock Queue Items Update ✅
- **Dark Theme:** Change the lock icon color to bone white.
- **Light Theme:** Change the lock icon color to gray.
- **Manual Toggle:** Allow users to toggle the lock state by manually clicking the lock icon on the queue item.
- **Shortcut:** Add keyboard shortcut `L` to toggle the lock state for selected queue items.

## 24. Queue Separation by Media Tab ✅
- Visually separate the file queue between the "Audio" and "Video" tabs. When the user switches tabs, only show files corresponding to the active tab's media type.

## 25. Remove "Open files" Icon ✅
- Remove the "Open files (Ctrl+O)" icon located next to the "Group by format" icon in the toolbar.

## 27. Active Tab Stroke Indicator ✅
- **Dark Theme:** Add a white stroke (border) around the active media tab (Audio/Video) in the left sidebar to indicate selection.
- **Light Theme:** Add a black stroke (border) around the active media tab.

## 28. Queue Background Contrast ✅
- **Dark Theme:** Increase the contrast between the app background and the queue table (including headers and row backgrounds).
- **Light Theme:** Increase the contrast between the app background and the queue table.

## 29. Default Destination Display ✅
- In the "Destination" column, if a file has no specific destination set, display the global "Default Output Folder" from the settings instead of leaving it blank.

## 30. Lock Header Icon ✅
- Add a Lock icon to the header of the "LOCK" column (the far-right column in the Table View).

## 31. Manipulation Tools Visibility ✅
- **Light Theme:** Fix the visibility and contrast of the bottom manipulation panel (features like Trim, Speed, EQ, etc.) so that the interface and options are clearly visible and contrast well with the background.

## 32. Global Lock Shortcut (Shift+L) ✅
- Implement `Shift+L` as a global shortcut to lock or unlock all items in the queue, regardless of current selection.

## 33. Refinement: Toolbar Buttons Width ✅
- Make the width of the "Enhance", "Separate Stems", "Convert", and "Record" buttons auto-adjust to their text content instead of a fixed width, while maintaining consistent height.

## 34. Refinement: Sidebar Active Tab Border✅
- Increase the border thickness (stroke width) for the active audio/video tab in the left sidebar for both light and dark themes.

## 35. Refinement: Manipulation Tools Visibility ✅
- Improve visibility and contrast of the EQ and Waveform tools (specifically the EQ slider boxes/tracks) in Light Theme so they do not blend with the background.

## 36. Refinement: Queue Selection Color ✅
- Change the background color of selected rows in the file queue to light gray instead of purple when in Light Theme.

## 37. Refinement: Queue Table Header Contrast and Borders ✅
- Add a border separating the table header from the table body.
- Change the header background color to contrast more with the table body.
- Add vertical column dividers (borders) inside the table header to separate the columns.

## 38. Record Button Visibility ✅
- Display the "Record" button only when the "Audio" tab is active. Hide it when the user switches to the "Video" tab.

## 39. Fix Drag & Drop Axis Constraints ✅
- Restrict drag-and-drop movement in Table View to the vertical axis only (up and down) to prevent unintended horizontal dragging.
- Ensure that dragging in Grid View behaves correctly and items do not overflow excessively to the right.

## 40. Waveform Visibility in Light Theme ✅
- Fix the visibility and contrast of the Waveform tool container in Light Theme so its background and layout are clearly visible, matching the clarity provided in Dark Theme.

## 41. Audio Recording Implementation & Custom Naming ✅
- Implement actual audio recording functionality to capture audio via a connected microphone or laptop microphone.
- Upon stopping the recording, automatically add the newly recorded audio file to the file queue in the Audio tab.
- Use a default naming convention for recorded files (e.g., `01_Record.wav`).
- Add a new configurable option in the "Settings" menu to allow users to customize this default recording name prefix.

## 42. Remove Play Icon Column✅
- Remove the play icon located to the left of the "Filename" column in the queue table.
- Remove the corresponding column entirely to simplify the table layout.

## 43. Revamp Manipulation Tools (Focus on Waveform) ✅
- Temporarily remove the following manipulation tools: Trim, Speed, Pitch, Volume, Fade, Merge, Loop, Spectrogram, and EQ. Focus strictly on the "Waveform" tool.
- Automatically expand and display the Manipulation Tools panel containing the waveform visualizer when an audio file in the queue is selected.
- Enhance the waveform visualization to display the audio signal as "spikes" (amplitude over time).
- Add playback controls directly to the waveform:
  - Press `Space` to play or pause the audio.
  - Press `Left Arrow` or `Right Arrow` to skip 5 seconds backward or forward.
  - Include an interactive vertical playhead (scrubber line) that can be clicked and dragged to navigate through the audio track.

## 44. Waveform Interaction, Zoom, and Style Upgrades 🚀 ✅
- **Real-time Scrubber Dragging:** When clicking and dragging the playhead (vertical scrubber line) to scrub through the audio, the playhead position and audio playback time must update smoothly in real-time under the mouse cursor.
- **Alt + Scroll Wheel Zoom:** Allow the user to zoom in/out of the waveform horizontally by pressing the `Alt` key while scrolling the mouse wheel.
- **Manual Zoom Slider:** Add a manual slider/seekbar below the waveform visualizer control area to allow adjusting the zoom level directly.
- **Mouse Hover Scroll (Horizontal Panning):** When the waveform is zoomed in (overflowing the container), allow the user to pan/scroll the waveform horizontally (left and right) by simply hover-scrolling with the mouse wheel when the cursor is positioned over the waveform.
- **Continuous Waveform Style:** Change the visual presentation of the waveform from separate spikes/bars to a continuous, solid filled wave outline (similar to Adobe Premiere Pro, as shown in the reference image). This means drawing a continuous wave outline with zero bar gaps.

## 45. Waveform Timeline, Zoom, Volume, Shortcuts & Dropzone Layout Upgrades 🚀 ✅
- **Unified Control Row:** Merge the playback seekbar (position slider) and the zoom slider into a single horizontal controls row to save space.
- **Timeline Ruler (Premiere Pro style):** Add a timeline ruler directly above the waveform. Ticks and time labels must display in the `00:00:00:00` (HH:MM:SS:FF) format and synchronize dynamically with the zoom level.
- **Focused Volume Control:** When the waveform player container is focused/clicked, allow the user to increase or decrease the audio volume in decibels (dB) by pressing `Arrow Up` (+1 dB) and `Arrow Down` (-1 dB). Show the current volume level in the UI next to the duration (e.g. `+2 dB`, `0 dB`, `-5 dB`).
- **Scroll Panning Fix:** Ensure that mouse scroll wheel events over the waveform container scroll the timeline horizontally left and right when the waveform is stretched (zoomed in).
- **Playback Shortcuts (J and L):** Add shortcuts:
  - Press `J` to play the audio backward at 2x speed.
  - Press `L` to play the audio forward at 2x speed.
  - Pressing `Space` (Play/Pause) or another action must clear these modes and return playback rate to normal (1x).
- **Simplify Playback Buttons:** Remove the physical "Stop" button next to the Play/Pause button under the waveform.
- **Dropzone Slide Animation:** When the waveform player slides up from the bottom (due to a queue item being selected), the "Drop audio/video files here" dropzone visual box must slide out to the top and fade out (animating height/opacity to 0) to save vertical space. When the waveform player is closed, the dropzone must slide back down. Drag-and-drop functionality on the application window must remain active when the dropzone is hidden.

## 46. Translation of User Request for Waveform & Dropzone Updates (Task 45 Reference) ✅
- **Prompt:**
  "1. Can the playback seekbar slider row be merged with the zoom slider row to save space? Also, add a video/audio timeline ruler ticks/grid above the waveform, synchronized with the zoom level, displaying time in the `00:00:00:00` (HH:MM:SS:FF) format (similar to Premiere Pro).
  2. Implement a focused volume control feature: when the waveform player window/panel is clicked/focused, allow the user to increase the volume by pressing the Up Arrow (adds 1 dB) and decrease it by pressing the Down Arrow (subtracts 1 dB), displaying the current dB level next to the duration.
  3. Fix the mouse scroll wheel functionality: when the waveform is stretched/zoomed in, scrolling the mouse wheel while hovering over the waveform should pan the waveform horizontally left/right. Zooming with Alt + Scroll should adjust the zoom in increments of 3 pixels per second.
  4. Add keyboard shortcuts J and L: pressing J plays the audio backward at 2x speed (visual rewind), while pressing L plays the audio forward at 2x speed. Pressing Space (Play/Pause) or another control should revert the playback speed back to normal (1x).
  5. Remove the physical 'Stop' button next to the Play/Pause button below the waveform.
  6. When the waveform player slides up from the bottom (when a queue file is clicked/selected), the 'Drop audio/video files here' dropzone UI must animate (slide and fade) out of view to the top to save space, but remain mounted so that global window drag-and-drop is still active. When the waveform player is closed, the dropzone must slide back down from the top."

## 47. Waveform Visual, Zoom Responsiveness, Vertical Gain Stretch & Frame-Level Zoom Upgrades 🚀 ✅
- **Remove Waveform Scrollbar:** Hide wavesurfer's built-in white horizontal scrollbar completely (`hideScrollbar: true`), relying solely on mouse wheel panning.
- **Immediate Zoom Response:** Calculate the default fit-to-width pixels-per-second value upon loading the file and use it as the minimum zoom boundary. Adjusting the zoom level must immediately scale the waveform without dead zones.
- **Vertical Gain Stretching:** Synchronize the vertical visual height/scale of the waveform with the volume dB level. Increasing the volume (dB) stretches the waveform vertically, while decreasing it shrinks the waveform towards the center line.
- **Rectified Half-Waveform View:** Change the waveform rendering from a double-sided symmetric view to a rectified half-waveform view (top half only), placing the zero baseline at the very bottom of the waveform player canvas.
- **Frame-Level Maximum Zoom:** Set the maximum zoom limit higher (up to 2000 pixels per second) to allow frame-by-frame editing resolution.

## 48. Fast Dropzone Transition, Initial Fit Zoom, Volume Cap, Crash Fix, W Shortcut, and Reset Feature 🚀 [NEW] ✅
- **Fast Dropzone Animation:** Speed up the dropzone ("Drop audio files here") hide/show transitions. When a queue file is clicked, the dropzone must rapidly slide up and fade out (transition duration: 0.1s). The same quick transition must apply when it slides back down/reappears.
- **Waveform Initial Fit-to-Width:** When the waveform player is opened or a new file is loaded, the waveform must fit exactly from start to end within the container (initial zoom level set exactly to `containerWidth / duration`). Disable mouse wheel horizontal panning when the waveform fits exactly (zoom level is at minimum/fit zoom). Panning should only be active when zoomed in (zoom level > min zoom).
- **Volume Limit (10 dB):** Cap the maximum volume increase to +10 dB (with the minimum floor remaining at -40 dB).
- **Blank Screen / Crash Fix:** Prevent the application from crashing (turning blank/black) when pressing Arrow Up or Arrow Down keys. Ensure side-effect updates to Wavesurfer are executed safely outside React's state update render lifecycle, wrapping calls in try-catch blocks.
- **Persistent Waveform Player & W Shortcut:** The waveform player window must not close when clicking empty areas or other elements; it must only close when the user clicks the Close (X) icon or presses the shortcut key `W`. The shortcut `W` (Close Waveform Player) must be listed in the Keyboard Shortcuts settings panel.
- **Red Close Icon:** The close (cross 'X') button in the waveform player header must be styled red.
- **Red Reset Button:** Add a red Reset button (using a counter-clockwise circular arrow icon) next to the Play/Pause button under the waveform. Clicking it pauses playback and resets playhead to 0, speed to 1x, volume to 0 dB, and zoom level to the initial fit-to-width level.

## 49. Dropzone Sync Bug, Separate 'L' Lock vs Speed Shortcuts, Rewind Fix, and Volume Gain Playback Fix 🚀 [NEW] ✅
- **Dropzone Sync Fix:** Prevent the issue where the waveform player is closed/hidden but the "Drop audio/video files here" dropzone fails to reappear. Ensure that when the waveform player is closed, the dropzone immediately slides down and becomes visible.
- **Separate Shortcut 'L' (Lock vs Playback Speed):**
  - When the waveform player container is focused/clicked, pressing `L` must act solely as a playback speed booster. Pressing it once increases speed to 2x, pressing it again increases it to 4x (maximum speed limit is 4x). Pressing `L` in this state must NOT trigger the queue item lock action.
  - When the user has clicked/focused the queue table/list or other parts of the app, pressing `L` behaves normally as the shortcut to lock/unlock selected queue items.
- **Fix Backward Playback (J Shortcut):** Fix the `J` shortcut (visual rewind) so that pressing `J` plays the audio backward at 2x speed. Ensure that this reverse playback is actually audible and works correctly.
- **Fix Volume dB Audio Playback Output:** Fix the volume control bug where pressing Arrow Up/Down changes the dB display (e.g. from 0 dB to +10 dB) and stretches the waveform visually, but the actual audible volume of the audio does not increase or decrease. Ensure the actual gain node / volume of WaveSurfer's audio output is updated dynamically and audibly.



## 50. Playback Shortcuts Logic & Frame-by-Frame Navigation 🚀 [NEW]
- **J & L Shortcut Enhancements:** ✅
  - The `L` shortcut (fast forward) maximum speed is 4x.
  - The `J` shortcut (backward playback) maximum speed is 4x.
  - When in accelerated mode (via `L` or `J`), pressing `Space` must immediately stop/pause the playback.
  - The `L` and `J` shortcuts must affect each other dynamically. For example, if playing at 4x forward (by pressing `L`), pressing `J` decreases the forward speed to 2x (and vice versa). They act as dynamic increment/decrement controls for the playback speed/direction.
- **Frame-by-Frame Navigation:** 
  - Allow the user to move the playhead (vertical line) backward by exactly one frame by pressing the `Left Shift` key.
  - Allow the user to move the playhead forward by exactly one frame by pressing the `Right Shift` key.
- **Settings UI Sync:** Ensure that the shortcut information for all these new behaviors (`J`, `L`, `Left Shift`, `Right Shift`) is synchronized and updated correctly in the application's Settings UI / Keyboard Shortcuts menu.

## 51. Waveform Playback, Zoom, Smooth Cursor & Clean App Shutdown 🚀 [NEW] ✅
- **J/L Speed Ladder Refinement:**
  - When the user presses **Play** then **L**, playback immediately jumps to **2x** (skipping 1x), then pressing L again jumps to **4x**.
  - Pressing **J** from 4x decreases to 2x → then to normal 1x forward playback → then directly to **backward 2x** (skipping the "paused" stop) → then backward 4x.
  - Pressing **L** from backward 4x goes to backward 2x → then directly to **normal 1x forward playback** (skipping pause) → then 2x → 4x.
  - Speed ladder: `−4x ↔ −2x ↔ 1x ↔ 2x ↔ 4x` (no pause state in the middle of the ladder).
- **Backward Playback with Audible Sound:** Fix the backward playback (J shortcut) so that audio is actually played in reverse. Use the Web Audio API `AudioBufferSourceNode` with a pre-reversed `AudioBuffer` to produce real backward audio. The reversed buffer is computed from the loaded file's decoded audio data.
- **Smooth Playhead at High Zoom:** Replace the `setInterval`-based reverse position ticker with a `requestAnimationFrame` loop synchronized to the `AudioContext` clock for pixel-accurate, display-rate (~60 fps) playhead position updates during backward playback.
- **Premiere Pro-style Maximum Zoom:** Make the maximum zoom level dynamic: compute it as `containerWidth × 30 fps`, so that at full zoom exactly **one frame** fills the entire waveform container width — matching Adobe Premiere Pro's zoom ceiling.
- **Cache Cleanup on App Close:** When the application is closed (via the close button or `Alt+X` shortcut), automatically clean up any temporary cached data before exiting.
- **Complete Process Shutdown:** Ensure the application and **all background processes** (Python backend sidecar) are fully terminated when the app is closed. The Rust layer must explicitly kill the sidecar `CommandChild` on the `CloseRequested` window event and then force-exit the process so no orphaned processes remain.

## 52. Instant Backward Playback, Capped Zoom, Load Caching & Timeline Navigation 🚀 [NEW] ✅
- **Instant Backward Playback:** Pre-decode and reverse the audio buffer in the background immediately when the file is loaded (in wavesurfer's `ready` event). This removes the lag/wait when pressing the `J` key on long audio files (e.g. 13-minute files).
- **Capped Zoom Limit:** Limit the maximum horizontal zoom level to `200` pixels per second (or `minZoom` if it exceeds 200 for very short files) to avoid extreme zoom resolutions.
- **Audio Loading Cache:** Implement a cache mechanism for loaded audio files. When switching between audio files in the queue (e.g., Audio 1 -> Audio 2 -> Audio 1), retrieve the loaded Blob URL and pre-reversed buffer from the cache instead of reading from disk and decoding again.
- **Timeline Navigation Shortcuts:** Add shortcuts `Ctrl + Arrow Left` to jump immediately to the beginning of the audio (time 0), and `Ctrl + Arrow Right` to jump immediately to the end of the audio.

## 53. Shortcut Adjustments, Fully-Loaded Caching & Loading Cancellation 🚀 [NEW] ✅
- **Shortcut Adjustments:**
  - `Arrow Left` and `Arrow Right` keys now skip backward and forward by exactly **1 second**.
  - `Shift + Arrow Left` and `Shift + Arrow Right` keys now skip backward and forward by **5 seconds**.
- **Fully-Loaded Caching Mechanism:**
  - Cache loaded audio files only after they are fully loaded (inside the wavesurfer `ready` event).
  - In addition to caching the `blobUrl` and `reversedBuffer`, also cache the decoded `peaks` (PCM channel data) and `duration`.
  - When loading from cache, pass these cached peaks and duration to `ws.load(url, peaks, duration)` to bypass the browser's audio file fetch and decoding process entirely, making cached files render **instantly**.
- **Interruption Load Cancellation:**
  - If a file is selected and another file is clicked before the first one finishes loading, cancel/abort the first load immediately and do not add it to the cache.

## 54. Waveform Opening Refactoring, Marquee Drag Selection, Delete Shortcuts, and Clear Queue Updates 🚀 [NEW]  ✅
- **Waveform Player Opening:** Added a play icon button to the left of the filename inside the queue table and cards. Clicking this play icon opens the waveform player, while clicking elsewhere on the row/card solely handles selection/reordering.
- **Drag-to-Select (Marquee Selection):** Enabled drag selection by clicking on the app's background and dragging a selection box across queue items.
- **Keyboard Delete Shortcuts:** Enabled deleting selected items by pressing `Delete` or `Backspace` keys on the keyboard.
- **Selected Deletion & Clear All Refactoring:** Changed the toolbar trash button to delete selected items instead of clearing the entire queue. Added a new "Clear" column to the table with a header button to clear the entire queue (requiring confirmation) and a trash icon in each row for single-file deletion.

## 55. Marquee Selection Bounds, Lock Safeguards, Import Loading Indicators & Switching Fixes 🚀 [NEW] ✅
- **Marquee Drag Selection Fixes:**
  - Fix the drag selection issue where dragging the cursor solely over the table rows fails to select them, whereas dragging past the table container selects them. Ensure drag selection functions reliably across the entire grid or list view area.
  - Constrain the selection marquee box visually so that it stays within the table/queue container bounds and does not draw outside.
- **Locked Items Deletion Safeguard:**
  - Verify and enforce that locked items (`lockedJobIds`) are never deleted when pressing the `Delete` or `Backspace` keys, nor when executing the "Clear" (Clear All) action in the table column.
- **Visual Feedback for Adding Files (Import Loading Indicator):**
  - Implement a loading state for newly imported files (via drag-and-drop or file/folder browse dialogs).
  - Newly added files should immediately appear in the queue list but in a faded/pale gray color, and remain non-interactive (cannot be clicked, played, reordered, or modified) while background import/processing is active.
  - Once fully loaded, transition their visual state to active (normal text color) to indicate they are ready.
- **Waveform Switching Crash/Error Fix:**
  - Fix the issue where rapidly switching between files in the queue (e.g. clicking the play icon from Audio 1 -> Audio 2 -> Audio 3) causes a "Failed to load audio" error inside the waveform player, breaking playback.

## 56. Locked Deletion Safeguards, Right-Click Overrides, Lock Header Toggle, Rapid Track Switching Fixes, Keyboard Shortcuts, Multi-Row Drag Reordering, and Tauri Compilation 🚀 [NEW] ✅
- **Locked Deletion Safeguards:**
  - Prevent the "Delete Selected" toolbar button and individual trash buttons from deleting locked files.
- **Right-Click Overrides:**
  - Intercept the default browser context menu globally and display a custom, premium HTML context menu containing only a "Refresh (Ctrl+R)" option styled to match the dark/light themes.
- **Lock Header Toggle:**
  - Clicking the lock icon in the table header toggles locking or unlocking all items in the queue.
- **Rapid Track Switching Fixes:**
  - Prevent the "Failed to load audio" error when rapidly switching between files in the waveform player by declaring the cancellation flag at the very top of `useEffect` and enforcing early return cancellation checks inside all async functions and wavesurfer handlers.
- **Keyboard Shortcuts:**
  - Change the shortcut for deleting selected items strictly to the `Delete` key (remove `Backspace`) and update the Keyboard Shortcuts panel.
- **Multi-Row Drag Reordering:**
  - Enable dragging multiple selected items together in the queue hierarchy, moving them as a single grouped batch when dropped.
- **Tauri Compilation:**
  - Rebuild the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 57. Ctrl+R Shortcut, Delete Key Fix, Waveform Rapid-Switch Error, Multi-Item Drag, Binary Rebuild 🚀 [NEW] ✅
- **Ctrl+R Direct App Refresh:**
  - Pressing `Ctrl+R` (or `F5`) now directly calls `window.location.reload()` instead of silently blocking the event. Previously the key was prevented but no action was taken; the only way to refresh was via the right-click context menu.
- **Delete Key as Primary Delete Shortcut:**
  - Changed the default `deleteSelected` binding from `Shift+X` to `Delete` in `DEFAULT_KEYBOARD_SHORTCUTS`.
  - Removed the redundant hardcoded `Delete` key handler from `QueueGrid.tsx` (now handled by the single configurable shortcut in `useKeyboardShortcuts.ts`).
  - Updated the shortcut handler to also close the waveform player when the currently-playing job is deleted.
  - Removed `Delete` from the "fixed shortcuts" info section in the Keyboard Shortcuts panel since it is now the remappable default.
- **Waveform Rapid-Switch Error Fix:**
  - Added a 50 ms debounce before WaveSurfer instance creation so rapid file switches (3+) never enter a create→destroy race with the audio element.
  - Added a `loadGenRef` (generation counter) alongside the existing `cancelled` flag for belt-and-suspenders staleness detection across all async callbacks and WaveSurfer event handlers.
- **Multi-Item Drag Reordering Fix:**
  - Fixed a silent early-exit in `reorderJobs` (Zustand store) where `targetIdx === -1` when the drop target (`overId`) is itself one of the selected/moving items. Now computes the insertion point from the item's original position in the jobs array.
  - Added `DragOverlay` to all four `DndContext` instances in `QueueGrid`. While dragging, a badge shows "Moving N items" (or "Moving 1 item") so users have clear visual feedback.
- **Tauri Release Binary Rebuild:**
  - Rebuilt the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 58. Multi-Item Drag Visual Union, Waveform Player Automatic Focus & Focus Preservation, Playback Switch Error Fixes, and Binary Recompilation 🚀 [NEW] ✅
- **Multi-Item Drag Visual Union:**
  - Enhance the visual feedback when dragging two or more queue items. Instead of rendering a separate overlay text/badge (like "Moving N items"), style the dragged items so they appear visually connected/merged and move in unison tracking the cursor's coordinates during the drag operation.
- **Waveform Player Focus Activation & Preservation:**
  - When the waveform player window first appears (triggered by clicking the Play icon of a queue item), it must immediately become active and focused, displaying the active outline border (stroke) automatically without requiring an initial click from the user.
  - Clicking inside the waveform player window or on its inner controls must preserve its active state (the outline border must not disappear).
  - The waveform player's active state (and visual stroke) must only be deactivated when the user explicitly clicks outside of the waveform player container.
- **Waveform Player Switching Error Fixes:**
  - Perform a deep cleanup of any remaining errors/crashes when rapidly clicking different queue files' play buttons or swapping waveform players. Fix any lingering asynchronous race conditions, obsolete audio context bindings, or event listener pollution to guarantee seamless playback transitions under load.
- **Tauri Release Binary Recompile:**
  - Recompile the Tauri application release executable at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 59. Multi-Drag Placeholder Preservation, Continuous Waveform Autofocus, Playback Interruption Error Fixes, and Binary Compilation 🚀 [NEW] ✅
- **Multi-Drag Placeholder Preservation:**
  - Prevent selected items from disappearing/vanishing from the table when they are dragged in a multi-item selection. They should remain in their original positions in the table, styled with `opacity-40` and not moved by `transform`, while the cursor moves the `DragOverlay` visual union badge.
- **Continuous Waveform Autofocus:**
  - Ensure that when the waveform player is already open and a user clicks the play icon of a different queue item, the waveform player window immediately autofocuses and displays the active outline border (stroke) automatically without requiring any clicks.
- **Playback Interruption Error Fixes:**
  - Fix any remaining "Failed to load audio" errors (media object errors) during rapid switching of queue tracks. Clear the source (`src = ''`) and trigger `load()` on the old audio element before destroying WaveSurfer, and ignore benign `AbortError` exceptions inside the error callback.
- **Tauri Release Binary Rebuild:**
  - Rebuild the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.


## 60. Multi-Drag Gap, Reopen Audio Playback, and Rebuild Release 🚀 [NEW] ✅
- **Multi-Drag Table Row Gap Fix:**
  - Prevent visual gaps between non-dragged items when performing a multi-item drag to reorder. The remaining items in the queue list/table must collapse together with no gaps.
- **Waveform Reopen Audio Playback Fix:**
  - Fix the bug where closing the waveform player using the `W` shortcut and reopening it causes audio playback to completely fail (silent/unplayable) until the application is restarted. Implement a robust solution for wavesurfer/audio cleanup and reinitialization.
- **Tauri Release Binary Rebuild:**
  - Rebuild the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.


## 61. Total WaveSurfer Re-instantiation, GPU Layer Crash Fix, and Binary Rebuild 🚀 [NEW] ✅
- **Total WaveSurfer Re-instantiation:**
  - Resolved the persistent "silent audio" issue encountered after ~6 rapid file switches by completely destroying and recreating the `WaveSurfer` instance and the underlying `HTMLAudioElement` pipeline on every track change. This bypasses the Chromium media decoder resource leak and WaveSurfer v7's inability to hot-swap media elements effectively.
- **WebView2 GPU Layer Crash Fix:**
  - Solved the application black screen flash (WebView2 GPU compositing crash) that previously occurred when destroying and recreating the WaveSurfer canvas. Injected a `will-change: transform, opacity` and `transform: translateZ(0)` hardware acceleration hint to the waveform container, locking the GPU render layer in place during transitions.
- **Tauri Release Binary Rebuild:**
  - Rebuilt the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 62. Dynamic Default Output Format 🚀 [NEW] ✅
- **Match Original Format:**
  - Modified the file import logic in the Rust backend (`db::queue::insert_job`) to dynamically extract the original audio file's extension (e.g., `mp3`, `wav`, `flac`) and set it as the default output format for that queue item. Previously, this was hardcoded to `wav`. If a user wishes to convert it to a different format, they can still manually change it via the format dropdown in the table.
- **Tauri Release Binary Rebuild:**
  - Rebuilt the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 63. UI Refinements, Deletion Warnings, and Directory Persistence 🚀 [NEW] ✅
- **Original Indonesian Requests:**
  1. Setting destination folder saves updates to the SQLite `destination` column directly. Corrected saving to original folders.
  2. status status enhance is updated to Done green badge instead of showing Enhanced/Original toggles.
  3. Clean up temporary files on app closure (WindowEvent::CloseRequested) to prevent cache accumulation.
  4. Flex alignment for column resizing keeps Size, Format, Bitrate, Sample Hz, and Status anchored to the right side next to Tools, Lock, Clear when filename is resized.
  5. Delete confirmation pop-up triggers when deleting/clearing files in processing/queued states.
  6. Waveform A/B switches without flashing the "Loading waveform..." text overlay.
  7. Processed Files History panel refresh icon removed; clicking a row opens/reveals the folder location.
- **Directory Persistence:**
  - Persist the custom save destination folder chosen in the table queue items to the SQLite database (`queue_jobs` table `destination` column) so the backend sidecar correctly reads and outputs the processed files to that folder instead of reverting to the source file's directory.
- **Table Column Resizing and Alignment:**
  - Modify the column width constraints in the queue table so that shrinking the "FILENAME" column keeps all other right-hand columns (`SIZE`, `FORMAT` (Output), `BITRATE`, `SAMPLE HZ`, `STATUS`) tightly packed and aligned/anchored to the right side next to `TOOLS`, `LOCK`, and `CLEAR`.
  - To achieve this, give the `STATUS` column a fixed width (e.g., `w-32` / 128px) and make `FILENAME` the flexible column (using `width: '100%'` and `minWidth: colWidths.filename`), allowing it to absorb any remaining horizontal space.
  - Apply resizable widths dynamically to the `DESTINATION` table cells using `colWidths.destination`.
- **Done Status Indicator:**
  - In both Table View and Grid View, remove the A/B toggle buttons ("Enhanced" and "Original") from the status column of the queue. Once enhancement finishes, simply display the green "Done" status badge. (The A/B toggle will remain available inside the Waveform Player).
- **Confirmation Warnings for Deletions:**
  - Show a confirmation popup asking: "Apakah Anda yakin ingin menghapus? File sedang diproses." (or equivalent English message depending on the active locale) if the user attempts to delete a file that is in `processing` or `queued` state.
  - This check must be enforced for keyboard deletes (`Delete` key), single-row trash icon clicks, toolbar "Delete Selected" button clicks, and when executing the "Clear All" action in the table column.
- **Clean Waveform Player Toggle Transitions:**
  - Remove the "Loading waveform..." text overlay when toggling between "Enhanced" and "Original" in the Waveform Player. Let the audio load in the background and immediately replace the waveform canvas without any flashing text.
- **History Panel Updates:**
  - Remove the refresh (`RefreshCw`) icon from the "Processed Files History" panel header.
  - Bind clicking a history item row to open/reveal the output file in the OS File Explorer (e.g. using a native `explorer.exe /select,"<path>"` command on Windows).
- **Process Cancellation & Application Cache Cleanup:**
  - Ensure all temporary/cache files created during processing or cancellation are cleanly deleted.
  - Implement a cleanup routine in the Rust layer to locate and delete any temporary recorded or processed audio files stored in the system temp directory on application exit (`WindowEvent::CloseRequested` handler).


## 64. Enhance Pipeline Improvements & Output Format Fix 🚀 [NEW] ✅
- **EnhanceRowButton UX Cleanup:**
  - When a queue item status is `done`, the Enhance button in the TOOLS column is now hidden entirely (returns null). Only the green Done status badge is shown — this is cleaner and less confusing.
  - Error status now shows an amber "Retry" button instead of the same purple "Enhance" button, making it visually distinct.
  - Queued status shows a disabled (30% opacity) button instead of the isDisabled logic conflating done+queued states.
- **Output Format Respect:**
  - `backend/routers/enhance.py` now reads `output_format` from the DB (previously only `filepath, destination, filename` were read). The output filename extension now correctly uses the user-selected format (e.g. if user changes format to `mp3`, the enhanced file is saved as `_enhanced.mp3`).
  - `backend/processors/enhance_speech.py` now handles non-native soundfile formats (MP3, AAC, M4A, OPUS, WMA): enhances to a temporary WAV first, then converts to the requested format via ffmpeg. The intermediate WAV is always cleaned up.
- **Partial Output Cleanup on Cancellation:**
  - When a job is cancelled mid-enhancement, `backend/routers/enhance.py` now detects and deletes any partially-written output file before sending the `pending` status callback. This prevents stale/incomplete files from accumulating on disk.
- **Old Rust Target Directory Cleanup:**
  - Deleted `src-tauri/target/` (the default Cargo output dir in the path-with-spaces workspace). This directory contained old artifacts compiled against the spaces path that caused linker failures (`rust-lld: error: could not open 'coding\\app\\'`). All future Rust builds must use `CARGO_TARGET_DIR=D:\cargo_build\enhance-audio-pro`.
- **Release Binary Rebuild:**
  - Rebuilt Python sidecar and Tauri release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 65. Enhance Process Fix, Delete Warning, and History Panel Upgrades 🚀 [NEW] ✅
- **Fix Stuck Enhance Process:**
  - Resolve the issue where the audio enhance process gets stuck, the progress bar does not advance, and the task waits indefinitely. Ensure progress is updated and processes do not hang.
- **Delete-While-Processing Confirmation Warning:**
  - Show a confirmation popup ("Apakah Anda yakin ingin menghapus? File sedang diproses.") when the user attempts to delete a file that is currently in `processing` or `queued` state. Ensure this warning triggers for all deletion methods (individual row trash icons, keyboard delete key, toolbar delete, and "Clear" queue buttons).
- **History Panel Improvements (Reveal Location, Missing Popup, Clear History):**
  - Clicking a history item must attempt to reveal the output file in its saved folder. If the file has been moved or deleted (i.e. does not exist at the target path), display a popup message saying "File telah dipindahkan".
  - Add a button at the bottom of the history panel labeled "Clear All History" (or "Hapus Semua Histori") to allow deleting all records from the processed history database.

## 66. Queue Enhancements, Resizable Size Column, Sequential Queueing, History Reveal Fix, Unique Naming, and Rebuild 🚀 [NEW] ✅
- **Count Up Duration Retention:**
  - Keep the final elapsed duration visible on the queue row once the status changes to `done` so the user knows how long the enhancement took.
- **Resizable Size Column:**
  - Make the `SIZE` table column resizable in the table view, matching the behavior of `FILENAME` and `DESTINATION` columns.
- **Queued Cancel Button:**
  - Render the "Cancel" button in the tools column for jobs that are in the `queued` state (as well as `processing`) to allow users to cancel them. Cancelling a queued job transitions it to `pending` and allows the queue to proceed to the next queued file.
- **Sequential Queueing on Individual Enhance:**
  - When clicking the individual "Enhance" button on a row, if another job is already processing, change the new job's status to `queued` (blue) instead of starting it immediately.
  - When the active job completes (status changes to `done`), the next `queued` job must automatically start processing.
- **History Reveal to Saved Destination:**
  - Clicking a history item in the "Processed Files History" panel must reveal/open the output folder where the enhanced file was saved, according to the job's set destination folder, rather than the default documents folder.
- **Unique Output Filename:**
  - If an enhanced file with the same name and format already exists in the destination folder, append an auto-incremented number suffix (e.g., `_01`, `_02`, etc.) to the output filename to prevent overwriting existing files.
- **Tauri Release Binary Rebuild:**
  - Rebuild the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 68. Delete Confirmation Re-verification, History Error Fix, Enhance Cold-Start Fix, Background Audio Preload & Debug Error Logger 🚀 [NEW]
- **Delete Warning Confirmation (Re-verification):** ✅
  - When the file status is `processing` or `queued` and the user selects that queue item then presses the Delete key, clicks the row trash icon, or clicks the toolbar "Delete Selected" button, show a `window.confirm()` warning popup. Already implemented (Tasks 63.5 / 65.5); verified still present in all paths.
  - The "Clear All" header button shows a modal with a red warning line if any active jobs are present; user must explicitly click "Yes, Clear All" to proceed.
- **History Panel Error Message Fix:**
  - Root cause: `get_recent_jobs` SQL had no `archived` filter, so error jobs still in the active queue (e.g. "Backend unavailable after N attempts") appeared in the History panel.
  - Fix: change query to `WHERE status = 'done' OR (status = 'error' AND archived = 1)` so active-queue error jobs are excluded. They only appear in history once explicitly removed from the queue.
- **Enhance Cold-Start Fix (First Enhance All Failure):**
  - Root cause: PyInstaller sidecar cold-start can exceed 16 s (8 attempts × 2 s). Clicking play before Enhance All accidentally gave the sidecar extra startup time — the audio load itself was not the true cause.
  - Fix: increase `MAX_ATTEMPTS` in `process.rs` from 8 to 25 (50 s total window), covering all realistic PyInstaller cold-start times.
- **Background Audio Preload on File Import:**
  - New `src/lib/audioPreload.ts` with `prewarmAudio(filepath)` that calls `read_audio_file` IPC in the background when files are added, storing the resulting Blob URL in `prewarmCache` for faster first WaveformPlayer open.
  - `submitAddFilesDirect` in `importHelper.ts` calls `prewarmAudio` for each newly added file.
- **Real-Time Debug Error Logger (.md files):**
  - New Rust command `append_error_log(entry)` appends markdown entries to `{app_data_dir}/error-logs/YYYY-MM-DD.md`.
  - New `src/lib/errorLogger.ts` with `logError(source, message, details?)` formats and fires the IPC call.
  - `QueueGrid.tsx` status-change error handler calls `logError` for every enhancement failure.
- **Tauri Release Binary Rebuild:**
  - Recompile release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.

## 67. Backend Unavailable Fix, Enhance All Processing Transition, Custom Settings Cache Location, and Binary Rebuild 🚀 [NEW] ✅
- **Backend Unavailable Connection Error Fix:**
  - Investigate and resolve the `Backend unavailable: error sending request for url (http://127.0.0.1:<port>/enhance)` error that triggers during both "Enhance All" and individual "Enhance" operations. Ensure the Python sidecar launches, binds, and communicates reliably.
- **Enhance All Initial Row Processing Fix:**
  - Fix the bug where clicking "Enhance All" marks all rows as `'queued'` instead of immediately starting the first row as `'processing'`. When the batch starts, the first queued job must immediately transition to `'processing'` and begin execution.
- **Scratch Disk / Cache Directory Setting:**
  - Add a new "Scratch Disk Location" or "Cache Directory" option in the Settings panel (e.g. allowing the user to browse and select a directory such as `D:\`).
  - Update both the Tauri frontend/backend and Python sidecar to use this custom directory for any temporary recordings, audio/video processing cache, and model temporary folders.
  - Ensure that this cache folder is automatically cleaned up and deleted on application close (`WindowEvent::CloseRequested` in Rust).
- **Tauri Release Binary Rebuild:**
  - Recompile the Tauri application release binary at `D:\cargo_build\enhance-audio-pro\release\enhance-audio-pro.exe`.



