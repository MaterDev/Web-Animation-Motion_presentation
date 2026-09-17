export default {
  id: 'webgpu/pipeline',
  technique: 'webgpu',
  title: 'Frame inspector',
  order: 1,
  source: { sheet: 'design/techniques/webgpu.html', section: '§1 Pipeline · what a frame costs on the GPU' },
  summary: 'Four GPU passes over 200 000 particles, each timed between two GPU timestamps; switch a pass off and its time goes.',
};
