const { Plugin } = require('obsidian');
module.exports = class LateRibbon extends Plugin {
  async onload() {
    await new Promise((r) => setTimeout(r, 500)); // stands in for e.g. `await this.loadData()`
    this.addRibbonIcon('dice', 'Late ribbon icon', () => {});
  }
};
