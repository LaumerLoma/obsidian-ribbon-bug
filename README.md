# Obsidian: hidden ribbon icons from plugins are reset (and erased) on a vault's first open on a device

**Obsidian:** 1.14.4 (installer 1.8.9), macOS. The same ribbon code is present in 1.8.9, so this is not new in 1.14.

## Steps to reproduce
1. Create an empty vault with one community plugin that adds its ribbon icon after an async step in `onload`.
   Many plugins do this, e.g. `await this.loadData()` followed by `addRibbonIcon`. Kanban and Templater both trigger it.
   See [`repro/late-ribbon/`](repro/late-ribbon/).
2. Put `.obsidian/workspace.json` = [`repro/workspace.json`](repro/workspace.json), which has
   `"left-ribbon": {"hiddenItems": {"late-ribbon:Late ribbon icon": true, ...}}`.
3. Open the vault in an Obsidian that has **never opened this vault before**: a new device, a reinstall, a fresh app-data dir, or a vault that arrived via Sync or git.

## Expected
The "Late ribbon icon" stays hidden, as saved in `workspace.json`.

## Actual
- The icon is shown (`app.workspace.leftRibbon.items[...].hidden === false`).
- The layout is saved before the plugin registers its icon, so `late-ribbon:Late ribbon icon` is **removed from `hiddenItems`** in `workspace.json`. The user's choice is lost permanently, not just for one session.
- Reproduced 3/3 on first open. On later opens of the same vault on the same device it does not reproduce (3/3).

## Cause (from the shipped app.js)
`WorkspaceRibbon.load(e)` only applies `e.hiddenItems` to items that are **already** in `this.items`:
```js
for (const item of this.items) item.hidden = hiddenItems[item.id] ?? false;
```
`addRibbonItemButton(id, ...)` creates unknown items with `hidden: false` and never looks at the saved state.
`serialize()` only writes items that currently exist, so entries for not-yet-registered icons are dropped.

## Suggested fix
Keep the loaded `hiddenItems` map on the ribbon, e.g. `this.savedHidden = hiddenItems`, and:
- In `addRibbonItemButton`, for a new item use `hidden: this.savedHidden[id] ?? false`.
- In `serialize()`, merge: `{...this.savedHidden, ...currentItems}`, so icons whose plugin hasn't loaded yet (or is disabled) keep their entry. The ordering logic in `load()` already works from the saved keys.

### Same root cause also breaks language switching
Ribbon item ids are `pluginId + ":" + title`, and `title` is the **localized** label
(`registerRibbonItem` / `Plugin.addRibbonIcon`). After a language switch none of the saved
`hiddenItems` keys match. Every icon reappears and the order resets. Then `serialize()` drops the
old-language keys, so switching back doesn't restore anything either. Known reports on the Obsidian forum:
- Hidden Ribbon icons reappear after switching to another language (`repro`, staff: "we are aware of this")
- Hidden left-ribbon menus are reset when language switched (sandbox, restricted mode, v1.4.16)
- Order of left ribbon items is not preserved across languages (`repro`, 1.13.7)

That case additionally needs a stable, non-localized id. Core plugins could use the command id or icon id; for
`addRibbonIcon` it could be `pluginId + ":" + icon`, or an optional explicit id parameter, with a one-time migration
from the old title-based keys. The `savedHidden` merge above is still needed so that
unmatched entries aren't destroyed.

## Workaround
[`workaround/ribbon-compat/`](workaround/ribbon-compat/) is a tiny plugin that re-applies the saved value when an icon is first registered.
Copy the folder to `<vault>/.obsidian/plugins/ribbon-compat/`, enable it, and list it first in `community-plugins.json`.

---

### Related, already fixed upstream (FYI)
1.14 renamed the ribbon class `.workspace-ribbon.mod-left` to `.mod-primary` (`left/right` became `primary/secondary`). Themes written for ≤1.13 lose their ribbon styling as a result. Baseline 3.x was affected; **Baseline 4.0.0 already handles it**. Other older themes may still break. 1.14 still adds the legacy `mod-left` class to the sidebar toggle button and splits, but not to the ribbon itself.
