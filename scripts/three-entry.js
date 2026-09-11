/* The single-file Three.js bundle the design harness imports as
   design/vendor/three.module.js. Everything from the core, plus the
   example modules the SL-12 sheet uses — bundled TOGETHER so the loader,
   the environment and the passes share one THREE instance. Importing the
   examples separately would pull a second copy of the core and every
   `instanceof` check between them would fail.

   Re-exporting `*` keeps every existing `import * as THREE` consumer working. */
export * from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
export { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
export { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
