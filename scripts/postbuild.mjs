import { readFileSync, writeFileSync } from 'fs'

// 1. Read compiled UI JS
const js = readFileSync('build/ui.js', 'utf8')

// 2. Generate HTML with JS inlined
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>*{box-sizing:border-box;margin:0;padding:0}</style>
</head>
<body>
  <div id="create-figma-plugin"></div>
  <script>${js}</script>
</body>
</html>`

writeFileSync('build/ui.html', html)
console.log('✓ Generated build/ui.html')

// 3. Patch manifest.json to point to ui.html
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
manifest.ui = 'build/ui.html'
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n')
console.log('✓ Patched manifest.json → ui: "build/ui.html"')
