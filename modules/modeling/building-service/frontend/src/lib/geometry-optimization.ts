import * as THREE from "three";
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";

/**
 * Geometry optimization utilities for large IFC models
 */

const createOptimizedPhongFromSource = (source: THREE.Material): THREE.MeshPhongMaterial => {
  const candidate = source as THREE.MeshStandardMaterial & {
    shininess?: number;
  };

  return new THREE.MeshPhongMaterial({
    color: candidate.color?.clone() ?? new THREE.Color(0xcccccc),
    emissive: candidate.emissive?.clone() ?? new THREE.Color(0x000000),
    emissiveIntensity: candidate.emissiveIntensity ?? 1,
    transparent: candidate.transparent ?? false,
    opacity: candidate.opacity ?? 1,
    side: candidate.side ?? THREE.DoubleSide,
    wireframe: false,
    flatShading: true,
    map: candidate.map ?? null,
    alphaMap: candidate.alphaMap ?? null,
    transparentMap: null,
    specularMap: candidate.specularMap ?? null,
    aoMap: candidate.aoMap ?? null,
    lightMap: candidate.lightMap ?? null,
    shininess: candidate.shininess ?? 18,
  });
};

const optimizeMaterial = (
  material: THREE.Material,
  cache: Map<string, THREE.Material>
): THREE.Material => {
  const cached = cache.get(material.uuid);
  if (cached) {
    return cached;
  }

  const optimized = createOptimizedPhongFromSource(material);
  cache.set(material.uuid, optimized);
  return optimized;
};

/**
 * Preserve IFC colors/material appearance while converting to cheaper render materials.
 */
export const applyOptimizedIfcMaterials = (object: THREE.Object3D): void => {
  const materialCache = new Map<string, THREE.Material>();

  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) {
      return;
    }

    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) => optimizeMaterial(material, materialCache));
    } else if (node.material) {
      node.material = optimizeMaterial(node.material, materialCache);
    }

    node.frustumCulled = true;
    node.castShadow = false;
    node.receiveShadow = false;
  });
};

/**
 * Build distance-based LOD meshes for heavy geometry to reduce GPU load.
 */
export const applyDistanceBasedLod = (
  object: THREE.Object3D,
  options?: {
    minVertices?: number;
    mediumRatio?: number;
    lowRatio?: number;
    mediumDistance?: number;
    lowDistance?: number;
  }
): void => {
  const minVertices = Math.max(1000, options?.minVertices ?? 6000);
  const mediumRatio = Math.min(0.95, Math.max(0.2, options?.mediumRatio ?? 0.65));
  const lowRatio = Math.min(mediumRatio, Math.max(0.1, options?.lowRatio ?? 0.35));
  const mediumDistance = Math.max(10, options?.mediumDistance ?? 80);
  const lowDistance = Math.max(mediumDistance + 10, options?.lowDistance ?? 180);
  const modifier = new SimplifyModifier();

  const replacements: Array<{ parent: THREE.Object3D; original: THREE.Mesh; lod: THREE.LOD }> = [];

  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.geometry || !node.parent) return;

    const geometry = node.geometry;
    const position = geometry.getAttribute("position");
    const vertexCount = position?.count ?? 0;
    if (vertexCount < minVertices) return;

    try {
      const baseGeometry = geometry.clone();
      const mediumGeometry = modifier.modify(
        baseGeometry.clone(),
        Math.max(0, Math.floor(vertexCount * (1 - mediumRatio)))
      );
      const lowGeometry = modifier.modify(
        baseGeometry.clone(),
        Math.max(0, Math.floor(vertexCount * (1 - lowRatio)))
      );

      const baseMesh = new THREE.Mesh(baseGeometry, node.material);
      const mediumMesh = new THREE.Mesh(mediumGeometry, node.material);
      const lowMesh = new THREE.Mesh(lowGeometry, node.material);

      baseMesh.castShadow = node.castShadow;
      baseMesh.receiveShadow = node.receiveShadow;
      mediumMesh.castShadow = node.castShadow;
      mediumMesh.receiveShadow = node.receiveShadow;
      lowMesh.castShadow = node.castShadow;
      lowMesh.receiveShadow = node.receiveShadow;

      const lod = new THREE.LOD();
      lod.position.copy(node.position);
      lod.rotation.copy(node.rotation);
      lod.scale.copy(node.scale);
      lod.userData = { ...node.userData };

      lod.addLevel(baseMesh, 0);
      lod.addLevel(mediumMesh, mediumDistance);
      lod.addLevel(lowMesh, lowDistance);

      replacements.push({ parent: node.parent, original: node, lod });
    } catch {
      // Skip meshes that cannot be simplified by the modifier.
    }
  });

  for (const { parent, original, lod } of replacements) {
    parent.add(lod);
    parent.remove(original);
    if (original.geometry) {
      original.geometry.dispose();
    }
  }
};

/**
 * Merge geometries of similar materials to reduce draw calls
 */
export const mergeGeometriesByMaterial = (
  object: THREE.Object3D
): Map<string, THREE.BufferGeometry> => {
  const geometriesByMaterial = new Map<string, THREE.BufferGeometry[]>();

  object.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry) {
      const matKey =
        node.material instanceof THREE.Material
          ? node.material.uuid
          : Array.isArray(node.material)
            ? node.material.map((m) => m.uuid).join(",")
            : "default";

      if (!geometriesByMaterial.has(matKey)) {
        geometriesByMaterial.set(matKey, []);
      }
      geometriesByMaterial.get(matKey)!.push(node.geometry);
    }
  });

  // Merge geometries per material
  const mergedGeometries = new Map<string, THREE.BufferGeometry>();
  const BufferGeometryUtils = require("three/examples/jsm/utils/BufferGeometryUtils.js");

  for (const [matKey, geometries] of geometriesByMaterial) {
    if (geometries.length > 1) {
      const merged = BufferGeometryUtils.mergeBufferGeometries(geometries, false);
      mergedGeometries.set(matKey, merged);
    } else if (geometries.length === 1) {
      mergedGeometries.set(matKey, geometries[0]);
    }
  }

  return mergedGeometries;
};

/**
 * Optimize lighting for large scenes (fewer lights = faster rendering)
 */
export const createOptimizedLighting = (): THREE.Light[] => {
  const lights = [];

  // Single ambient light instead of complex lighting setup
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  lights.push(ambient);

  // Single directional light from a typical viewing angle
  const directional = new THREE.DirectionalLight(0xffffff, 1.0);
  directional.position.set(10, 20, 10);
  directional.castShadow = false; // Disable shadows for large models
  lights.push(directional);

  return lights;
};

/**
 * Calculate memory footprint of geometry
 */
export const estimateGeometryMemory = (geometry: THREE.BufferGeometry): number => {
  let bytes = 0;

  if (geometry.attributes.position) {
    bytes += geometry.attributes.position.array.byteLength;
  }
  if (geometry.attributes.normal) {
    bytes += geometry.attributes.normal.array.byteLength;
  }
  if (geometry.attributes.uv) {
    bytes += geometry.attributes.uv.array.byteLength;
  }

  return bytes;
};

/**
 * Format bytes to human readable size
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

/**
 * Performance metrics collector
 */
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = performance.now();
  private fps = 60;
  private triangleCount = 0;
  private drawCalls = 0;

  update(renderer: THREE.WebGLRenderer): void {
    this.frameCount++;
    const currentTime = performance.now();
    const delta = currentTime - this.lastTime;

    if (delta >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.triangleCount = renderer.info.render.triangles;
      this.drawCalls = renderer.info.render.calls;
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  getMetrics() {
    return {
      fps: this.fps,
      triangles: this.triangleCount,
      drawCalls: this.drawCalls,
    };
  }
}

/**
 * Dispose of Three.js objects properly to prevent memory leaks
 */
export const disposeObject = (object: THREE.Object3D): void => {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      if (node.geometry) {
        node.geometry.dispose();
      }
      if (node.material) {
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => m.dispose());
        } else {
          node.material.dispose();
        }
      }
    }
  });
};
