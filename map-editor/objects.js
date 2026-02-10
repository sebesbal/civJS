import * as THREE from 'three';

// Object manager class - uses dynamic type registry from economy data
export class ObjectManager {
  constructor(scene, tilemap = null) {
    this.scene = scene;
    this.tilemap = tilemap;
    this.objects = [];
    this.nextId = 0;
    this.selectedObject = null;
    this.objectTypes = {}; // Dynamic type registry
  }

  setTilemap(tilemap) {
    this.tilemap = tilemap;
  }

  // Update the object types registry (called when economy changes)
  setObjectTypes(objectTypes) {
    this.objectTypes = objectTypes || {};
  }

  // Calculate height offset for object based on its shape
  getObjectHeightOffset(typeDef) {
    if (typeDef.shape === 'cylinder' || typeDef.shape === 'box') {
      return typeDef.size.height / 2;
    } else if (typeDef.shape === 'sphere') {
      return typeDef.size.radius;
    }
    return 0;
  }

  createObject(type, position, id = null) {
    const typeDef = this.objectTypes[type];
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

    // Calculate object height offset so it sits on top of the tile surface
    const heightOffset = this.getObjectHeightOffset(typeDef);

    // Position object on top of tile (position.y is the tile top surface)
    mesh.position.set(position.x, position.y + heightOffset, position.z);
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

    const typeDef = this.objectTypes[objectData.type];
    if (!typeDef) return false;
    const heightOffset = this.getObjectHeightOffset(typeDef);

    objectData.mesh.position.set(
      newPosition.x,
      newPosition.y + heightOffset,
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
      const typeDef = this.objectTypes[obj.type];
      const heightOffset = typeDef ? this.getObjectHeightOffset(typeDef) : 0;

      return {
        id: obj.id,
        type: obj.type,
        position: {
          x: pos.x,
          y: pos.y - heightOffset, // Subtract height offset to get tile surface position
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
        // Skip objects whose type is no longer in the registry
        if (!this.objectTypes[objData.type]) {
          console.warn(`Skipping object with unknown type: ${objData.type}`);
          return;
        }

        // Use saved position, but if tilemap is available, use actual tile top surface
        let yPosition = objData.position.y;
        if (this.tilemap) {
          yPosition = this.tilemap.getTileTopSurface(objData.position.x, objData.position.z);
        }

        const position = new THREE.Vector3(
          objData.position.x,
          yPosition,
          objData.position.z
        );
        this.createObject(objData.type, position, objData.id);
      });
    }
  }
}
