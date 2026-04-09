// src/main.ts
import { UIMessage, MainMessage, CountryConfig, SchemeData, SchemesStore, PluginSettings, DEFAULT_SETTINGS, COUNTRY_LANG_CODE, MockupTextNode, SAMPLE_ADDRESSES } from './types'

// ─── Utility: recursive node finder ──────────────────────────────
function findNodeByName(root: BaseNode, name: string): BaseNode | null {
  if (root.name === name) return root
  if ('children' in root) {
    for (const child of root.children) {
      const found = findNodeByName(child, name)
      if (found) return found
    }
  }
  return null
}

// ─── Utility: find TEXT node by layer name, returning its pathKey ─
// Searches component.children (so pathKeys match collectBatchTexts output).
// If the layer named `targetName` is itself not a TEXT node (e.g. it's a
// Frame or Component), we dive in and find the first TEXT child inside it.
function findHeadlineTextWithPath(
  component: ComponentNode,
  targetName: string
): { node: TextNode; pathKey: string } | null {
  function firstText(node: BaseNode, path: string): { node: TextNode; pathKey: string } | null {
    if (node.type === 'TEXT') return { node: node as TextNode, pathKey: path }
    if ('children' in node) {
      for (const c of (node as ChildrenMixin).children) {
        const found = firstText(c, `${path}|${c.name}`)
        if (found) return found
      }
    }
    return null
  }
  function search(node: BaseNode, path: string): { node: TextNode; pathKey: string } | null {
    if (node.name === targetName) {
      // Found the target layer — grab its text (or first text child)
      if (node.type === 'TEXT') return { node: node as TextNode, pathKey: path }
      return firstText(node, path)
    }
    if ('children' in node) {
      for (const c of (node as ChildrenMixin).children) {
        const found = search(c, `${path}|${c.name}`)
        if (found) return found
      }
    }
    return null
  }
  for (const child of component.children) {
    const found = search(child, child.name)
    if (found) return found
  }
  return null
}

// ─── Utility: find __bg_library__ frame on any page ──────────────
function findBgLibrary(): FrameNode | null {
  for (const page of figma.root.children) {
    if (page.type !== 'PAGE') continue
    for (const node of page.children) {
      if (node.name === '__bg_library__' && node.type === 'FRAME') {
        return node as FrameNode
      }
    }
  }
  return null
}

// ─── Utility: collect all TEXT nodes recursively ─────────────────
function collectTextNodes(node: BaseNode, pathKey: string, layerName: string, results: MockupTextNode[]) {
  if (node.type === 'TEXT' && (node as TextNode).characters.trim()) {
    results.push({ layerName, pathKey, content: (node as TextNode).characters })
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      collectTextNodes(child, `${pathKey}|${child.name}`, layerName, results)
    }
  }
}

// ─── Utility: collect all TEXT nodes recursively (flat) ──────────
function collectAllTextNodes(node: BaseNode, result: TextNode[]) {
  if (node.type === 'TEXT') { result.push(node as TextNode); return }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      collectAllTextNodes(child, result)
    }
  }
}

// ─── Utility: watermark text classification ───────────────────────
// weekdaySet is built in ui.tsx (Intl available there) and passed via GENERATE message.
function classifyWatermarkText(text: string, weekdaySet: Set<string>): 'weekday' | 'date' | 'address' | null {
  const t = text.trim()
  if (!t || t.length < 2) return null
  // Skip time-only values like "16:35" or "09:30"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return null
  // Weekday: match against Intl-generated set passed from UI
  if (weekdaySet.has(t.toLowerCase())) return 'weekday'
  // Date: contains a 4-digit year (19xx or 20xx)
  if (/\b(19|20)\d{2}\b/.test(t) && t.length <= 50) return 'date'
  // Address: everything else with meaningful length
  if (t.length >= 5) return 'address'
  return null
}

// ─── Utility: find first TEXT node recursively ───────────────────
function findFirstTextNode(root: BaseNode): TextNode | null {
  if (root.type === 'TEXT') return root as TextNode
  if ('children' in root) {
    for (const child of (root as ChildrenMixin).children) {
      const found = findFirstTextNode(child)
      if (found) return found
    }
  }
  return null
}

// ─── Utility: find node by path key relative to root ─────────────
// Uses depth-first search so duplicate-named siblings (e.g. multiple
// "Option Item" instances) are all tried before giving up.
function findNodeByPathKey(root: BaseNode, pathKey: string): BaseNode | null {
  const segments = pathKey.split('|')
  function search(node: BaseNode, depth: number): BaseNode | null {
    if (depth === segments.length) return node
    if (!('children' in node)) return null
    for (const child of (node as ChildrenMixin).children) {
      if (child.name === segments[depth]) {
        const result = search(child, depth + 1)
        if (result) return result
      }
    }
    return null
  }
  return search(root, 0)
}

// ─── Handler: SCAN_TEXTS ─────────────────────────────────────────
function handleScanTexts(mockupLayerNames: string[]) {
  const component = resolveComponentFromSelection()
  if (!component) {
    figma.ui.postMessage({ type: 'ERROR', message: '请先选中 Main Component 再扫描' } as MainMessage)
    return
  }
  const texts: MockupTextNode[] = []
  const missing: string[] = []

  for (const layerName of mockupLayerNames) {
    const mockupLayer = findNodeByName(component, layerName)
    if (!mockupLayer) {
      missing.push(layerName)
      continue
    }
    if ('children' in mockupLayer) {
      for (const child of (mockupLayer as ChildrenMixin).children) {
        collectTextNodes(child, child.name, layerName, texts)
      }
    }
  }

  if (missing.length > 0 && texts.length === 0) {
    figma.ui.postMessage({ type: 'ERROR', message: `未找到图层: ${missing.join(', ')}` } as MainMessage)
    return
  }
  figma.ui.postMessage({ type: 'COMPONENT_TEXTS', texts } as MainMessage)
}

// ─── Utility: set text with font fallback ────────────────────────
// fitToBox=true: lock node to original dimensions and binary-search for
// the largest font size that keeps text within those bounds.
async function setTextSafe(
  node: TextNode, content: string, warnings: string[], label: string,
  fitToBox = false
) {
  try {
    // Capture original geometry BEFORE setting content
    const originalW = node.width
    const originalH = node.height

    const fn = node.fontName
    const fontToLoad = fn !== figma.mixed ? fn as FontName : { family: 'Inter', style: 'Regular' }
    try {
      await figma.loadFontAsync(fontToLoad)
      node.characters = content
    } catch {
      await figma.loadFontAsync({ family: 'Arial', style: 'Regular' })
      node.fontName = { family: 'Arial', style: 'Regular' }
      node.characters = content
    }

    if (fitToBox && originalH > 0) {
      // Read fontSize AFTER setting content — mixed-font nodes become uniform
      // after characters are replaced, so we get a real number here.
      const currentFontSize = node.fontSize !== figma.mixed ? node.fontSize as number : 0
      if (currentFontSize > 0) {
        const autoResize = node.textAutoResize
        const isAuto = autoResize === 'HEIGHT' || autoResize === 'WIDTH_AND_HEIGHT'
        const heightOver = node.height > originalH
        const widthOver  = autoResize === 'WIDTH_AND_HEIGHT' && node.width > originalW

        if (isAuto && (heightOver || widthOver)) {
          let lo = 6, hi = currentFontSize, bestFit = 6
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2
            node.fontSize = mid
            const fits = node.height <= originalH &&
              (autoResize !== 'WIDTH_AND_HEIGHT' || node.width <= originalW)
            if (fits) { bestFit = mid; lo = mid + 0.1 }
            else      { hi = mid - 0.1 }
            if (hi - lo < 0.2) break
          }
          node.fontSize = bestFit
          if (bestFit < currentFontSize * 0.6) {
            warnings.push(`${label}: 字号压缩至 ${bestFit.toFixed(1)}pt（原 ${currentFontSize.toFixed(1)}pt）`)
          }
        }

        // For HEIGHT mode: lock box to original size so it doesn't re-expand
        if (autoResize === 'HEIGHT') {
          try { node.textAutoResize = 'NONE'; node.resize(originalW, originalH) } catch { /* ignore */ }
        }
      }
    }
  } catch (e) {
    warnings.push(`${label}: 文字更新失败 — ${(e as Error).message}`)
  }
}

// ─── Handler: READ_HEADLINE_STYLE ────────────────────────────────
// Reads the 'headline' text node in the selected component and returns
// the character ranges that have a fill different from the dominant fill.
// The result is sent back as a HEADLINE_STYLE message.
function resolveComponentFromSelection(): ComponentNode | null {
  const sel = figma.currentPage.selection
  if (!sel.length) return null
  const first = sel[0]
  if (first.type === 'COMPONENT') return first as ComponentNode
  // If user selected a COMPONENT_SET (variant group), use first child component
  if (first.type === 'COMPONENT_SET') {
    const child = (first as ComponentSetNode).children.find(c => c.type === 'COMPONENT')
    return (child ?? null) as ComponentNode | null
  }
  return null
}

function handleReadHeadlineStyle() {
  type HF = import('./types').HighlightFill
  const empty: MainMessage = { type: 'HEADLINE_STYLE', text: '', highlightRanges: [], dominantFills: [], pathKey: '' }

  const component = resolveComponentFromSelection()
  if (!component) { figma.ui.postMessage(empty); return }

  // findHeadlineTextWithPath drills through Frame/Component containers so
  // the returned pathKey always matches what collectBatchTexts produces.
  const result = findHeadlineTextWithPath(component, 'headline')
  if (!result) { figma.ui.postMessage(empty); return }

  const { node: textNode, pathKey } = result
  const segments = textNode.getStyledTextSegments(['fills'])

  if (segments.length <= 1) {
    const fills = segments.length === 1 ? segments[0].fills as unknown as HF[] : []
    figma.ui.postMessage({ type: 'HEADLINE_STYLE', text: textNode.characters, highlightRanges: [], dominantFills: fills, pathKey } as MainMessage)
    return
  }

  // Dominant fill = the segment covering the most characters
  let dominantSeg = segments[0]
  for (const seg of segments) {
    if (seg.characters.length > dominantSeg.characters.length) dominantSeg = seg
  }
  const dominantKey = JSON.stringify(dominantSeg.fills)
  const dominantFills = dominantSeg.fills as unknown as HF[]

  const highlightRanges = segments
    .filter(seg => seg.characters.trim().length > 0 && JSON.stringify(seg.fills) !== dominantKey)
    .map(seg => ({ start: seg.start, end: seg.end, fills: seg.fills as unknown as HF[] }))

  figma.ui.postMessage({ type: 'HEADLINE_STYLE', text: textNode.characters, highlightRanges, dominantFills, pathKey } as MainMessage)
}

// ─── Handler: GET_INDUSTRIES ──────────────────────────────────────
function handleGetIndustries() {
  const library = findBgLibrary()
  const list = library
    ? library.children.map(n => n.name)
    : []
  const msg: MainMessage = { type: 'INDUSTRIES', list }
  figma.ui.postMessage(msg)
}

// ─── Handler: LOAD_SCHEMES ───────────────────────────────────────
async function handleLoadSchemes() {
  const raw = await figma.clientStorage.getAsync('schemes_store') as SchemesStore | undefined
  const data: SchemesStore = (raw && typeof raw.schemes === 'object')
    ? raw
    : { schemes: {}, lastScheme: '' }
  const msg: MainMessage = { type: 'SCHEMES', data, lastScheme: data.lastScheme }
  figma.ui.postMessage(msg)
}

// ─── Handler: SAVE_SCHEME ────────────────────────────────────────
async function handleSaveScheme(name: string, schemeData: SchemeData) {
  const existing = await figma.clientStorage.getAsync('schemes_store') as SchemesStore | undefined
  const store: SchemesStore = (existing && typeof existing.schemes === 'object')
    ? existing
    : { schemes: {}, lastScheme: '' }
  store.schemes[name] = schemeData
  store.lastScheme = name
  await figma.clientStorage.setAsync('schemes_store', store)
}

// ─── Handler: GENERATE ───────────────────────────────────────────
async function handleGenerate(msg: Extract<UIMessage, { type: 'GENERATE' }>) {
  const { configs, industry, bgImageHash, bgBytes, photoBytes } = msg

  // Step 1: validate selection
  const component = resolveComponentFromSelection()
  if (!component) {
    const sel = figma.currentPage.selection
    figma.ui.postMessage({
      type: 'ERROR',
      message: sel.length === 0
        ? '请先在画布上选中广告图模板 Component'
        : '请选中 Main Component 或 Component Set，而非 Instance 或其他图层'
    } as MainMessage)
    return
  }

  // Step 2: resolve bg imageHash
  let resolvedBgHash: string | null = bgImageHash ?? null

  if (!resolvedBgHash && bgBytes) {
    const img = figma.createImage(new Uint8Array(bgBytes))
    resolvedBgHash = img.hash
  }

  if (!resolvedBgHash) {
    const library = findBgLibrary()
    if (library) {
      const bgNode = library.children.find(n => n.name === industry)
      if (bgNode && bgNode.type === 'RECTANGLE') {
        const fills = bgNode.fills as Paint[]
        const imgPaint = fills.find(f => f.type === 'IMAGE') as ImagePaint | undefined
        resolvedBgHash = imgPaint?.imageHash ?? null
      }
    }
    // if still null (no library / no matching industry): bg layer keeps its original fill
  }

  // Step 3: resolve photo imageHash
  let resolvedPhotoHash: string | null = null
  if (photoBytes) {
    const img = figma.createImage(new Uint8Array(photoBytes))
    resolvedPhotoHash = img.hash
  }

  // Step 4: calculate layout origin + dimension tag
  const N = configs.length
  const instanceW = component.width
  const instanceH = component.height
  const dim = instanceW > instanceH * 1.1 ? 'Hor' : instanceH > instanceW * 1.1 ? 'Ver' : 'Sq'

  const totalWidth = N * instanceW + (N - 1) * 40
  const startX = figma.viewport.center.x - totalWidth / 2
  const startY = figma.viewport.center.y - instanceH / 2

  // Step 5: generate instances
  const warnings: string[] = []
  const instances: InstanceNode[] = []

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]

    const instance = component.createInstance()
    instance.x = startX + i * (instanceW + 40)
    instance.y = startY
    const langCode = COUNTRY_LANG_CODE[config.code] ?? config.code
    const suffix = msg.nameSuffix?.trim() || 'Msg'
    instance.name = `${langCode}-${dim}-${suffix}`

    // Update headline text layer
    if (config.headline) {
      // 1. Try layer named 'headline'
      let textNode: TextNode | null = null
      const byName = findNodeByName(instance, 'headline')
      if (byName?.type === 'TEXT') {
        textNode = byName as TextNode
      } else {
        // 2. Find first TextNode in direct children or inside a direct Instance child
        for (const child of instance.children) {
          if (child.type === 'TEXT') {
            textNode = child as TextNode; break
          }
          if (child.type === 'INSTANCE') {
            const t = (child as InstanceNode).children.find(c => c.type === 'TEXT')
            if (t) { textNode = t as TextNode; break }
          }
        }
      }
      if (textNode) {
        await setTextSafe(textNode, config.headline, warnings, config.code, true)
        // Re-apply fills (setTextSafe resets ALL character-level styling)
        if (config.headlineHighlightRange || config.headlineDominantFills?.length) {
          try {
            // Step 1: flood the full text with the dominant (base) fill
            if (config.headlineDominantFills?.length) {
              textNode.setRangeFills(0, config.headline.length, config.headlineDominantFills as Paint[])
            }
            // Step 2: overlay the accent fill on the highlight range
            if (config.headlineHighlightRange) {
              const { start, end, fills } = config.headlineHighlightRange
              if (end > start && end <= config.headline.length) {
                textNode.setRangeFills(start, end, fills as Paint[])
              }
            }
          } catch (e) {
            warnings.push(`${config.code}: 高亮色彩应用失败 — ${(e as Error).message}`)
          }
        }
      } else {
        warnings.push(`${config.code}: 未找到文字图层`)
      }
    }

    // Update subheadline text layer
    if (config.subheadline) {
      const subNode = findNodeByName(instance, 'subheadline')
      if (subNode?.type === 'TEXT') {
        await setTextSafe(subNode as TextNode, config.subheadline, warnings, config.code, true)
      }
    }

    // Replace bg fill
    if (resolvedBgHash) {
      const bgLayer = findNodeByName(instance, 'bg')
      if (bgLayer && 'fills' in bgLayer) {
        (bgLayer as GeometryMixin).fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: resolvedBgHash }]
      } else {
        warnings.push(`${config.code}: 未找到 bg 图层`)
      }
    } else {
      warnings.push(`${config.code}: 未配置背景图，bg 图层保持原样`)
    }

    // Replace photo fill
    if (resolvedPhotoHash) {
      const photoLayer = findNodeByName(instance, 'mockup/photo')
      if (photoLayer && 'fills' in photoLayer) {
        (photoLayer as GeometryMixin).fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: resolvedPhotoHash }]
      } else {
        warnings.push(`${config.code}: 未找到 mockup/photo 图层`)
      }
    }

    // Apply mockup text translations
    if (msg.mockupTranslations) {
      const countryTr = msg.mockupTranslations.find(t => t.code === config.code)
      if (countryTr) {
        for (const { layerName, pathKey, content } of countryTr.texts) {
          const mockupNode = findNodeByName(instance, layerName)
          if (mockupNode) {
            const textNode = findNodeByPathKey(mockupNode, pathKey)
            if (textNode?.type === 'TEXT') {
              await setTextSafe(textNode as TextNode, content, warnings, `${config.code} mockup`)
            }
          }
        }
      }
    }

    // Apply watermark
    if (msg.watermarkConfig) {
      const wt = msg.watermarkTexts?.[config.code]
      const weekdaySet = new Set<string>(msg.weekdayNames ?? [])
      const pool = SAMPLE_ADDRESSES[config.code] ?? SAMPLE_ADDRESSES['US']
      await applyWatermark(
        instance, config,
        msg.watermarkConfig.watermarkLayerName,
        wt?.dateStr ?? '', wt?.weekdayStr ?? '',
        pool[Math.floor(Math.random() * pool.length)],
        weekdaySet, warnings
      )
    }

    instances.push(instance)

    const progress: MainMessage = { type: 'PROGRESS', current: i + 1, total: N }
    figma.ui.postMessage(progress)
  }

  // Step 6: zoom to view
  figma.viewport.scrollAndZoomIntoView(instances)

  const done: MainMessage = { type: 'DONE', warnings }
  figma.ui.postMessage(done)
}

// ─── Utility: apply watermark to one instance ────────────────────
async function applyWatermark(
  instance: InstanceNode,
  config: CountryConfig,
  watermarkLayerName: string,
  dateStr: string,
  dayStr: string,
  addr: string,
  weekdaySet: Set<string>,
  warnings: string[]
) {
  const wmNode = findNodeByName(instance, watermarkLayerName)
  if (!wmNode) { warnings.push(`${config.code}: 未找到水印图层 "${watermarkLayerName}"`); return }

  const DATE_NAMES    = ['date', 'Date', 'DATE', '日期']
  const WEEKDAY_NAMES = ['weekday', 'Weekday', 'WEEKDAY', 'week', 'Week', 'day', 'Day', '星期']
  const ADDRESS_NAMES = ['address', 'Address', 'ADDRESS', '地址', 'addr', 'Addr']

  let dateHandled = false, weekdayHandled = false, addressHandled = false

  for (const n of DATE_NAMES) {
    const found = findNodeByName(wmNode, n)
    if (!found) continue
    const tn = findFirstTextNode(found)
    if (tn && dateStr) { await setTextSafe(tn, dateStr, warnings, `${config.code} watermark/date`); dateHandled = true; break }
  }
  for (const n of WEEKDAY_NAMES) {
    const found = findNodeByName(wmNode, n)
    if (!found) continue
    const tn = findFirstTextNode(found)
    if (tn && dayStr) { await setTextSafe(tn, dayStr, warnings, `${config.code} watermark/weekday`); weekdayHandled = true; break }
  }
  for (const n of ADDRESS_NAMES) {
    const found = findNodeByName(wmNode, n)
    if (!found) continue
    const tn = findFirstTextNode(found)
    if (tn) { await setTextSafe(tn, addr, warnings, `${config.code} watermark/address`); addressHandled = true; break }
  }

  if (!dateHandled || !weekdayHandled || !addressHandled) {
    const allTexts: TextNode[] = []
    collectAllTextNodes(wmNode, allTexts)
    for (const tn of allTexts) {
      const kind = classifyWatermarkText(tn.characters, weekdaySet)
      if (kind === 'weekday' && !weekdayHandled && dayStr) {
        await setTextSafe(tn, dayStr, warnings, `${config.code} watermark/weekday`); weekdayHandled = true
      } else if (kind === 'date' && !dateHandled && dateStr) {
        await setTextSafe(tn, dateStr, warnings, `${config.code} watermark/date`); dateHandled = true
      } else if (kind === 'address' && !addressHandled) {
        await setTextSafe(tn, addr, warnings, `${config.code} watermark/address`); addressHandled = true
      }
    }
  }

  if (!dateHandled)    warnings.push(`${config.code}: 水印中未识别到日期节点`)
  if (!weekdayHandled) warnings.push(`${config.code}: 水印中未识别到星期节点`)
  if (!addressHandled) warnings.push(`${config.code}: 水印中未识别到地址节点`)
}

// ─── Handler: SCAN_ALL_TEXTS ──────────────────────────────────────
function collectBatchTexts(node: BaseNode, pathKey: string, excludeNames: string[], results: { pathKey: string; content: string }[]) {
  if (excludeNames.includes(node.name)) return
  if (node.type === 'TEXT') {
    const content = (node as TextNode).characters.trim()
    if (content) results.push({ pathKey, content })
    return
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      collectBatchTexts(child, `${pathKey}|${child.name}`, excludeNames, results)
    }
  }
}

function handleScanAllTexts(excludeLayerNames: string[]) {
  const component = resolveComponentFromSelection()
  if (!component) {
    figma.ui.postMessage({ type: 'ERROR', message: '请先选中 Main Component 再扫描' } as MainMessage)
    return
  }
  const results: { pathKey: string; content: string }[] = []
  for (const child of component.children) {
    collectBatchTexts(child, child.name, excludeLayerNames, results)
  }
  figma.ui.postMessage({ type: 'ALL_COMPONENT_TEXTS', texts: results } as MainMessage)
}

// ─── Handler: BATCH_TRANSLATE ─────────────────────────────────────
async function handleBatchTranslate(msg: Extract<UIMessage, { type: 'BATCH_TRANSLATE' }>) {
  const component = resolveComponentFromSelection()
  if (!component) {
    figma.ui.postMessage({ type: 'ERROR', message: '请先选中 Main Component' } as MainMessage)
    return
  }
  const { configs } = msg

  const N = configs.length
  const instanceW = component.width
  const instanceH = component.height
  const dim = instanceW > instanceH * 1.1 ? 'Hor' : instanceH > instanceW * 1.1 ? 'Ver' : 'Sq'
  const totalWidth = N * instanceW + (N - 1) * 40
  const startX = figma.viewport.center.x - totalWidth / 2
  const startY = figma.viewport.center.y - instanceH / 2

  const warnings: string[] = []
  const instances: InstanceNode[] = []

  for (let i = 0; i < N; i++) {
    const config = configs[i]
    const instance = component.createInstance()
    instance.x = startX + i * (instanceW + 40)
    instance.y = startY
    const langCode = COUNTRY_LANG_CODE[config.code] ?? config.code
    const suffix = msg.nameSuffix?.trim() || 'Msg'
    instance.name = `${langCode}-${dim}-${suffix}`

    // Apply translated texts
    const countryTr = msg.translations.find(t => t.code === config.code)
    if (countryTr) {
      for (const { pathKey, content } of countryTr.texts) {
        const node = findNodeByPathKey(instance, pathKey)
        if (node?.type === 'TEXT') {
          await setTextSafe(node as TextNode, content, warnings, `${config.code} ${pathKey}`, true)
          // Re-apply headline fills (setTextSafe resets ALL character-level styling)
          if (pathKey === msg.headlinePathKey && msg.headlineHighlights) {
            const tn = node as TextNode
            try {
              // Step 1: flood the whole text with the dominant (base) fill so the
              // base colour is correct regardless of what setTextSafe reset to.
              if (msg.headlineDominantFills?.length) {
                tn.setRangeFills(0, content.length, msg.headlineDominantFills as Paint[])
              }
              // Step 2: overlay the accent (highlight) fill on the detected subrange.
              if (msg.headlineHighlightFills?.length) {
                const range = msg.headlineHighlights[config.code]
                if (range && range.end > range.start && range.end <= content.length) {
                  tn.setRangeFills(range.start, range.end, msg.headlineHighlightFills as Paint[])
                }
              }
            } catch (e) {
              warnings.push(`${config.code}: 高亮色彩应用失败 — ${(e as Error).message}`)
            }
          }
        }
      }
    }

    // Apply watermark (overrides date/weekday/address that were already set via pathKey above)
    if (msg.watermarkConfig) {
      const wt = msg.watermarkTexts?.[config.code]
      const weekdaySet = new Set<string>(msg.weekdayNames ?? [])
      const pool = SAMPLE_ADDRESSES[config.code] ?? SAMPLE_ADDRESSES['US']
      await applyWatermark(
        instance, config,
        msg.watermarkConfig.watermarkLayerName,
        wt?.dateStr ?? '', wt?.weekdayStr ?? '',
        pool[Math.floor(Math.random() * pool.length)],
        weekdaySet, warnings
      )
    }

    instances.push(instance)
    figma.ui.postMessage({ type: 'PROGRESS', current: i + 1, total: N } as MainMessage)
  }

  figma.viewport.scrollAndZoomIntoView(instances)
  figma.ui.postMessage({ type: 'DONE', warnings } as MainMessage)
}

// ─── Main message router ──────────────────────────────────────────
export default async function () {
  figma.showUI(__html__, { width: 360, height: 560 })

  // Load saved settings and send to UI on startup
  const savedSettings = await figma.clientStorage.getAsync('plugin_settings') as Partial<PluginSettings> | undefined
  const oldKey = await figma.clientStorage.getAsync('api_key') as string | undefined
  if (savedSettings || oldKey) {
    const settings: Partial<PluginSettings> = { ...savedSettings }
    if (oldKey && !settings.apiKey) settings.apiKey = oldKey
    const msg: MainMessage = { type: 'SETTINGS', settings }
    figma.ui.postMessage(msg)
  }

  figma.ui.onmessage = async (raw: UIMessage) => {
    try {
      switch (raw.type) {
        case 'READ_HEADLINE_STYLE':
          handleReadHeadlineStyle()
          break
        case 'SCAN_TEXTS':
          handleScanTexts(raw.mockupLayerNames)
          break
        case 'GET_INDUSTRIES':
          handleGetIndustries()
          break
        case 'LOAD_SCHEMES':
          await handleLoadSchemes()
          break
        case 'SAVE_SCHEME':
          await handleSaveScheme(raw.name, raw.data)
          break
        case 'SAVE_SETTINGS':
          await figma.clientStorage.setAsync('plugin_settings', raw.settings)
          figma.notify('✓ 设置已保存')
          break
        case 'GENERATE':
          await handleGenerate(raw)
          break
        case 'SCAN_ALL_TEXTS':
          handleScanAllTexts(raw.excludeLayerNames)
          break
        case 'BATCH_TRANSLATE':
          await handleBatchTranslate(raw)
          break
        default:
          console.error('Timemark Batch: unknown message type:', (raw as { type: string }).type)
          break
      }
    } catch (e) {
      const err: MainMessage = { type: 'ERROR', message: `插件内部错误: ${(e as Error).message}` }
      figma.ui.postMessage(err)
    }
  }
}
