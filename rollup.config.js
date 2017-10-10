export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/douyu-live.js',
      format: 'cjs',
      name: 'douyu-live'
    },
    {
      file: 'dist/douyu-live.esm.js',
      format: 'es',
      name: 'douyu-live'
    }
  ]
}
