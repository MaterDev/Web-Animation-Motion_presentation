export default {
  id: 'canvas/readback',
  technique: 'canvas',
  title: 'Readback — radiology workstation',
  order: 3,
  source: { sheet: 'design/techniques/canvas.html', section: '§4 Readback' },
  summary: 'A synthetic scan read back with getImageData every frame; histogram, window/level, region stats and fusion overlay all derived from the pixels.',
};
