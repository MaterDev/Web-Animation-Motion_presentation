export default {
  id: 'canvas/off-thread',
  technique: 'canvas',
  title: 'Off-thread — blitted player and visualizer',
  order: 4,
  source: { sheet: 'design/techniques/canvas.html', section: '§5 Off-thread' },
  summary: 'A blitted media player and a 90s spectrum/scope visualizer, both drawn by one worker through transferred OffscreenCanvases; block the main thread and they keep running.',
};
