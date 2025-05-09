module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    '@babel/preset-flow',
  ],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./app'],
        alias: {
          '^@app/(.+)': './app/\\1',
        },
      },
    ],
    'react-native-reanimated/plugin', // must be last
  ],
};
