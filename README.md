# Snap Blur

Chrome / Edge extension (Manifest V3). Works like Edge's Screenshot, inside the same tab:
select an area, optionally blur personal information, then copy to the clipboard.
It never saves a file and never stores the image (no `downloads` or `storage` permission).

## Install (unpacked)

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.
4. After pulling changes, click the reload icon on the extension card.

## Use

1. Click the toolbar icon or press `Alt+Shift+S`. The page freezes and dims.
2. Drag to select an area. Drag the handles to resize, drag inside to move.
   **Whole screen** selects everything.
3. In the toolbar under the selection:
   - **Copy** (`Enter`): copy the area and close.
   - **Markup**: open the editor in the same tab to hide information, then **Copy**.
   - **✕** (`Esc`): cancel.

Markup keys:

| Key | Action |
|---|---|
| `B` | Blur |
| `P` | Pixelate |
| `K` | Black box (safest for passwords, card numbers) |
| `Ctrl/Cmd+Z` | Undo |
| `Enter` / `Ctrl/Cmd+C` | Copy and close |
| `Esc` | Cancel drag, then close |

The **Strength** slider sets blur radius / pixel block size for the next edit.

## Limits

- Captures the visible area only (no full-page scroll capture).
- Browser pages (`chrome://`, `edge://`, Web Store, built-in PDF viewer) cannot be captured; the icon shows a red `!`.
- Copy needs a secure page (`https://` or `localhost`). On plain `http://` pages the browser blocks the clipboard.
- Weak blur on large text can sometimes be reversed. For secrets, use Black box.
- Change the shortcut at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.
