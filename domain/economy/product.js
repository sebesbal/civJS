// Product - represents a single product node in the economy DAG
export class Product {
  constructor(id, name, imagePath = '', inputs = []) {
    this.id = id;
    this.name = name;
    this.imagePath = imagePath;
    this.inputs = inputs; // Array<{ productId: number, amount: number }>
    this.position = { x: 0, y: 0, z: 0 };
  }

  validate() {
    if (!this.name || this.name.trim() === '') {
      return { valid: false, error: 'Product name cannot be empty' };
    }

    if (!Array.isArray(this.inputs)) {
      return { valid: false, error: 'Inputs must be an array' };
    }

    for (const input of this.inputs) {
      if (typeof input.productId !== 'number' || input.productId < 0) {
        return { valid: false, error: 'Invalid productId in inputs' };
      }
      if (typeof input.amount !== 'number' || input.amount <= 0) {
        return { valid: false, error: 'Input amount must be a positive number' };
      }
    }

    return { valid: true };
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      imagePath: this.imagePath,
      inputs: this.inputs.map(input => ({
        productId: input.productId,
        amount: input.amount
      }))
    };
  }

  static deserialize(data) {
    return new Product(data.id, data.name, data.imagePath || '', data.inputs || []);
  }

  isRawMaterial() {
    return this.inputs.length === 0;
  }

  getDependencies() {
    return this.inputs.map(input => input.productId);
  }
}
