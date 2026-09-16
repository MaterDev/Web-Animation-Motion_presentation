/* The single-file vgpu bundle the design harness imports as
   design/vendor/vgpu.module.js. One app on the WebGPU sheet (Supercell)
   runs on it, adopting the sheet's own device with initFromDevice.
   Re-exporting `*` keeps the whole public surface; vendor.js asserts the
   exports that app depends on. */
export * from 'vgpu';
