export default {
  id: 'canvas/off-thread',
  technique: 'canvas',
  title: 'Off-thread — twin blitted players',
  order: 4,
  source: { sheet: 'design/techniques/canvas.html', section: '§5 Off-thread' },
  summary: 'Two blitted media players from one source, one drawn on the main thread and one by a worker via OffscreenCanvas; block the main thread to see which stops.',
};
