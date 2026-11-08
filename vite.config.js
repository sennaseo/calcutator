import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// require('./x.png') → import (RN 이미지 require를 Vite가 이해하게)
function requireAssets() {
  return {
    name: 'require-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/src\/.*\.js$/.test(id.replace(/\\/g, '/'))) return;
      const imports = [];
      const out = code.replace(/require\((['"])([^'"]+\.(?:png|jpe?g|gif|webp))\1\)/g, (_, q, p) => {
        const name = `__asset${imports.length}`;
        imports.push(`import ${name} from ${JSON.stringify(p)};`);
        return name;
      });
      if (!imports.length) return;
      return {code: imports.join('\n') + '\n' + out, map: null};
    },
  };
}

export default defineConfig({
  plugins: [requireAssets(), react({include: /\.(jsx?|tsx?)$/})],
  define: {global: 'globalThis', __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'), 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')},
  resolve: {
    alias: [
      {find: /^react-native$/, replacement: 'react-native-web'},
      {find: 'react-native-webview', replacement: path.resolve('web-shims/WebView.jsx')},
    ],
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  esbuild: {loader: 'tsx', include: /\.[jt]sx?$/, exclude: /node_modules/}, // RN 관례: .js 안에 JSX
  optimizeDeps: {
    esbuildOptions: {define: {global: 'globalThis'}, loader: {'.js': 'jsx'}, resolveExtensions: ['.web.js', '.web.tsx', '.web.ts', '.js', '.jsx', '.ts', '.tsx', '.json']},
  },
});
