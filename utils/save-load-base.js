// Base class for save/load functionality shared between game and economy managers

export class SaveLoadBase {
  constructor(version = 1) {
    this.currentVersion = version;
  }

  // Download JSON data as a file
  downloadAsFile(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Read a File object as text
  readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Parse JSON and validate version
  parseAndValidate(jsonString, requiredFields = []) {
    const data = JSON.parse(jsonString);

    if (!data.version || data.version > this.currentVersion) {
      throw new Error('Unsupported save file version');
    }

    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`Invalid save file: missing ${field}`);
      }
    }

    return data;
  }
}
