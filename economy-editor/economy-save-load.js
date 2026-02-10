// Economy Save/Load Manager
import { SaveLoadBase } from '../utils/save-load-base.js';

export class EconomySaveLoadManager extends SaveLoadBase {
  constructor() {
    super(1);
  }

  // Serialize economy data to JSON
  saveEconomyData(economyManager) {
    const data = economyManager.serialize();
    return JSON.stringify(data, null, 2);
  }

  // Download economy data as JSON file
  downloadEconomyData(economyDataJson, filename = 'economy-save.json') {
    this.downloadAsFile(economyDataJson, filename);
  }

  // Load economy data from JSON string
  async loadEconomyData(economyDataJson) {
    return this.parseAndValidate(economyDataJson, ['nodes']);
  }

  // Load economy data from a URL/path
  async loadEconomyFromPath(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    const text = await response.text();
    return await this.loadEconomyData(text);
  }
}
