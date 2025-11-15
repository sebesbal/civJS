import * as THREE from 'three';
import { ObjectTypes } from './config/object-types.js';

// Re-export ObjectTypes for backward compatibility with other modules
export { ObjectTypes };

// Object manager class
export class ObjectManager {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.nextId = 0;
    this.selectedObject = null;
  }

  createObject(type, position, id = null) {
    const typeDef = ObjectTypes[type];
    if (!typeDef) {
      console.error(`Unknown object type: ${type}`);
      return null;
    }

    let geometry;
    if (typeDef.shape === 'cylinder') {
      geometry = new THREE.CylinderGeometry(
        typeDef.size.radius,
        typeDef.size.radius,
        typeDef.size.height,
        16
      );
    } else if (typeDef.shape === 'box') {
      geometry = new THREE.BoxGeometry(
        typeDef.size.width,
        typeDef.size.height,
        typeDef.size.depth
      );
    } else if (typeDef.shape === 'sphere') {
      geometry = new THREE.SphereGeometry(typeDef.size.radius, 16, 16);
    }

    const material = new THREE.MeshStandardMaterial({ color: typeDef.color });
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position on top of tile
    mesh.position.set(position.x, position.y + 0.5, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Use provided ID or generate new one
    const objectId = id !== null ? id : this.nextId++;
    if (id !== null && id >= this.nextId) {
      this.nextId = id + 1;
    }

    // Store object data
    const objectData = {
      id: objectId,
      type: type,
      mesh: mesh,
      originalMaterial: material,
      highlightMaterial: null
    };

    this.objects.push(objectData);
    this.scene.add(mesh);
    
    return objectData;
  }

  removeObject(objectId) {
    const index = this.objects.findIndex(obj => obj.id === objectId);
    if (index === -1) return false;

    const objectData = this.objects[index];
    this.scene.remove(objectData.mesh);
    objectData.mesh.geometry.dispose();
    objectData.mesh.material.dispose();
    
    if (objectData.highlightMaterial) {
      objectData.highlightMaterial.dispose();
    }

    this.objects.splice(index, 1);
    
    if (this.selectedObject && this.selectedObject.id === objectId) {
      this.deselectObject();
    }
    
    return true;
  }

  selectObject(objectId) {
    this.deselectObject();
    
    const objectData = this.objects.find(obj => obj.id === objectId);
    if (!objectData) return null;

    // Create highlight material
    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: objectData.originalMaterial.color.getHex(),
      emissive: objectData.originalMaterial.color.getHex(),
      emissiveIntensity: 0.3
    });
    
    objectData.highlightMaterial = highlightMaterial;
    objectData.mesh.material = highlightMaterial;
    
    this.selectedObject = objectData;
    return objectData;
  }

  deselectObject() {
    if (this.selectedObject) {
      this.selectedObject.mesh.material = this.selectedObject.originalMaterial;
      if (this.selectedObject.highlightMaterial) {
        this.selectedObject.highlightMaterial.dispose();
        this.selectedObject.highlightMaterial = null;
      }
      this.selectedObject = null;
    }
  }

  moveObject(objectId, newPosition) {
    const objectData = this.objects.find(obj => obj.id === objectId);
    if (!objectData) return false;

    // Calculate height based on object type
    const typeDef = ObjectTypes[objectData.type];
    let height = 0.5;
    if (typeDef.shape === 'cylinder') {
      height = typeDef.size.height / 2;
    } else if (typeDef.shape === 'box') {
      height = typeDef.size.height / 2;
    } else if (typeDef.shape === 'sphere') {
      height = typeDef.size.radius;
    }

    objectData.mesh.position.set(
      newPosition.x,
      newPosition.y + height,
      newPosition.z
    );
    
    return true;
  }

  getAllObjects() {
    return this.objects;
  }

  getObjectById(id) {
    return this.objects.find(obj => obj.id === id);
  }

  clearAll() {
    this.objects.forEach(obj => {
      this.scene.remove(obj.mesh);
      obj.mesh.geometry.dispose();
      obj.mesh.material.dispose();
      if (obj.highlightMaterial) {
        obj.highlightMaterial.dispose();
      }
    });
    this.objects = [];
    this.selectedObject = null;
  }

  // Serialize objects to data array
  serialize() {
    const objects = this.objects.map(obj => {
      const pos = obj.mesh.position;
      return {
        id: obj.id,
        type: obj.type,
        position: {
          x: pos.x,
          y: pos.y - 0.5, // Subtract base offset to get tile position
          z: pos.z
        }
      };
    });
    
    return {
      objects: objects,
      nextId: this.nextId
    };
  }

  // Load objects from serialized data
  loadFromData(objectsData, nextId) {
    // Clear existing objects
    this.clearAll();
    
    // Set next ID
    this.nextId = nextId || 0;
    
    // Recreate objects with their original IDs
    if (objectsData && Array.isArray(objectsData)) {
      objectsData.forEach(objData => {
        const position = new THREE.Vector3(
          objData.position.x,
          objData.position.y,
          objData.position.z
        );
        this.createObject(objData.type, position, objData.id);
      });
    }
  }
}

