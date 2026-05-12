export * from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// web-ifc-three expects mergeGeometries export name.
export const mergeGeometries = mergeBufferGeometries;
