// Economy Save/Load Manager
export class EconomySaveLoadManager {
  constructor() {
    this.currentVersion = 1;
  }

  // Serialize economy data to JSON
  saveEconomyData(economyManager) {
    try {
      const data = economyManager.serialize();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error saving economy data:', error);
      throw error;
    }
  }

  // Download economy data as JSON file
  downloadEconomyData(economyDataJson, filename = 'economy-save.json') {
    const blob = new Blob([economyDataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Load economy data from JSON string
  async loadEconomyData(economyDataJson) {
    try {
      const data = JSON.parse(economyDataJson);
      
      // Validate version
      if (!data.version || data.version > this.currentVersion) {
        throw new Error('Unsupported save file version');
      }
      
      // Validate required fields
      if (!data.nodes || !Array.isArray(data.nodes)) {
        throw new Error('Invalid save file: missing nodes array');
      }
      
      return data;
    } catch (error) {
      console.error('Error loading economy data:', error);
      throw error;
    }
  }

  // Read file from file input
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          resolve(e.target.result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Load economy data from a URL/path
  async loadEconomyFromPath(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.statusText}`);
      }
      const text = await response.text();
      return await this.loadEconomyData(text);
    } catch (error) {
      console.error(`Error loading economy from ${path}:`, error);
      throw error;
    }
  }
}

