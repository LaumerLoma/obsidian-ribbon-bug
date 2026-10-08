'use strict';
const { Plugin } = require('obsidian');

// Core WorkspaceRibbon.load() only applies saved hiddenItems to icons that already exist,
// and serialize() only writes icons that exist. An icon a plugin adds later shows up as
// visible, and if the layout is saved before it registers (always on a vault's first open
// on a device), its hidden entry is dropped from workspace.json for good.
// This re-applies the value read straight from workspace.json when an icon is first added.
module.exports = class RibbonCompat extends Plugin {
  async onload() {
    const ribbon = this.app.workspace.leftRibbon;
    const saved = await this.readSavedHiddenItems();
    if (!saved || !ribbon) return;
    const has = (id) => Object.prototype.hasOwnProperty.call(saved, id);

    const orig = ribbon.addRibbonItemButton;
    ribbon.addRibbonItemButton = function (id, ...rest) {
      const isNew = !this.items.some((i) => i.id === id);
      const el = orig.call(this, id, ...rest);
      if (isNew && has(id)) {
        this.items.find((i) => i.id === id).hidden = !!saved[id];
        this.onChange(true);
      }
      return el;
    };
    this.register(() => { ribbon.addRibbonItemButton = orig; });

    // Icons registered while we were reading the file.
    let changed = false;
    for (const item of ribbon.items) {
      if (has(item.id) && item.hidden !== !!saved[item.id]) {
        item.hidden = !!saved[item.id];
        changed = true;
      }
    }
    if (changed) ribbon.onChange(true);
  }

  async readSavedHiddenItems() {
    try {
      const path = `${this.app.vault.configDir}/workspace.json`;
      const json = JSON.parse(await this.app.vault.adapter.read(path));
      return json['left-ribbon'] && json['left-ribbon'].hiddenItems;
    } catch (e) {
      console.warn('[ribbon-compat] could not read saved ribbon state', e);
      return null;
    }
  }
};
