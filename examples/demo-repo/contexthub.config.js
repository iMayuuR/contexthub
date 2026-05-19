module.exports = {
  roots: ['.'],
  query: {
    rrfK: 60
  },
  graph: {
    maxNodes: 500
  },
  watch: {
    debounceMs: 300,
    maxFilesPerBatch: 100
  }
};
