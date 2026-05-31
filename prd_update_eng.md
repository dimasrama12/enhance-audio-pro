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
