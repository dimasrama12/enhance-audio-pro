# Product Requirements Document (PRD) - Enhance Audio Pro Feature Updates

This document summarizes the update notes and functional improvements that need to be implemented in the application.

## 1. Light Mode Improvements ✅
- **UI Element Visibility:** Ensure all text, queue lists, and settings menu elements are clearly visible with proper contrast when Light Mode is active.
- **Comprehensive Theme Coverage:** Applying Light Mode must change the theme of the entire application interface consistently, not just specific parts.

## 2. Settings Persistence & Global Changes ✅
- **Automatic Configuration Saving:** All setting changes made by the user (such as theme selection, default output directory, etc.) must be saved persistently. When the user reopens the app, the last chosen configuration will be directly applied. This applies to all configurable features in the settings menu.
- **Global Language Application:** The Language change feature must be applied thoroughly across all parts of the app, not just the settings menu. Language changes must cover the General tab, Formats tab, User Guide, main application screen, column headers, and all other interface elements.
- **DeepFilterNet AI Model Integration:** The DeepFilterNet AI model for noise removal must be embedded/bundled directly into the application. The AI model download button in the settings menu must be removed, allowing users to use it immediately without manual downloading.

## 3. User Guide Layout Changes ✅
- **Paragraph Format:** Change the layout structure of the User Guide from a column/accordion format to regular text paragraphs to make it more natural and structured to read.

## 4. Background Interaction Prevention (Modal Overlay Prevent Scroll)
- **Main Page Locking:** When the user opens the "Settings" window/modal, the system must prevent user interaction with the main page. The user is not allowed to scroll or click elements on the main page as long as the settings window is still open.

## 5. Main Screen Table UI Enhancements
- **Table Header Layout:** Improve the text display on the main screen table column headers. Short text (such as "SAMPLE HZ") should not be cut into two lines. Solutions can include reducing the header font size, changing the font type, or adjusting the default column width.
- **Resizable Columns:** Users must be able to adjust/drag the column widths specifically for "FILENAME" and "DESTINATION" according to their preferences.
- **Individual Clickable Destination:** The "DESTINATION" column on each audio file row must be clickable. When clicked, the user can specify a specific storage directory for that file.
- **Batch Destination Selection (Multi-selection):** Support multi-selection functionality on the file queue. If the user selects multiple files at once, then clicks and changes the destination on *one* of the selected files, the destination of all other currently selected files will automatically be updated to the same directory address.

## 6. Dropzone Text & Interaction Adjustments
- **Dynamic Text:** Change the text in the dropzone area dynamically based on the active tab. On the Audio tab, the text should read "Drop audio files here", and on the Video tab, it should change to "Drop video files here".
- **Click to Open File Explorer:** The dropzone area will not only function for drag-and-drop but will also be clickable. When clicked, the system will directly open the File Explorer pop-up window to select files.

## 7. Grid View & Shortcuts
- **Grid View layout:** Modify the Grid View mode for the file queue so that a single row will display exactly 3 file boxes side-by-side.
- **View Shortcuts:** Add keyboard shortcuts: press `1` to switch to Table View and `2` to switch to Grid View.
- **Shortcut Info Update:** These new shortcuts must be automatically reflected/added to the Shortcuts menu information in the Settings.

## 8. Deselecting Queue Files
- **Click Outside Area:** In addition to using the `X` shortcut to deselect files in the queue, users can now deselect files by clicking on the empty area outside the queued file boxes.

## 9. Recent Files Shortcut
- **History Shortcut:** Add the keyboard shortcut `Ctrl + H` to open the processed files history panel (Recent Files).
- **Shortcut Info Update:** As before, this new shortcut information must be added to the Shortcuts menu in the Settings.

## 10. Toolbar Layout Reordering
- **Left Grouping (Primary Action Buttons):** Move the main action buttons ("Enhance", "Separate Stems", "Convert", and "Record") to the left side of the toolbar. The box width of these four buttons should be made equal to the width of the "Record" button.
- **Right Grouping (Additional Tools & Icons):** Move the Search files input, filter dropdown, format dropdown (Convert to), and the row of icons (Switch to table view, Open file, Group by format, and Trash) to the right side of the toolbar.
- **Tab Consistency:** This new layout must be applied consistently across both the Audio and Video tabs.
