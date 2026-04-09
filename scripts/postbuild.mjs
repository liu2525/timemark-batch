import { readFileSync, writeFileSync } from 'fs'

// 1. Read compiled UI JS
const js = readFileSync('build/ui.js', 'utf8')

// 2. Generate HTML with JS inlined
// __FIGMA_COMMAND__ and __SHOW_UI_DATA__ are normally injected by Figma when
// manifest ui points to a .js file. When using an HTML file we must define them.
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>*{box-sizing:border-box;margin:0;padding:0}</style>
</head>
<body>
  <div id="create-figma-plugin"></div>
  <script>
    var __FIGMA_COMMAND__ = (typeof __figmaCommand__ !== 'undefined') ? __figmaCommand__ : '';
    var __SHOW_UI_DATA__ = null;
  </script>
  <script>${js}</script>
</body>
</html>`

writeFileSync('build/ui.html', html)
console.log('✓ Generated build/ui.html')

// 3. Patch manifest.json to point to ui.html and set correct networkAccess
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
manifest.ui = 'build/ui.html'
manifest.networkAccess = {
  allowedDomains: [
    'https://api.openai.com',
    'https://translate.googleapis.com',
    'https://api.mymemory.translated.net',
    'https://api-free.deepl.com',
    'https://api.deepl.com',
    'https://api.cognitive.microsofttranslator.com',
  ]
}
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n')
console.log('✓ Patched manifest.json → ui: "build/ui.html", networkAccess: openai')
