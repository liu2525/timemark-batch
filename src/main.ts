// src/main.ts
import { UIMessage, MainMessage, CountryConfig, SchemeData, SchemesStore } from './types'

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
  const selection = figma.currentPage.selection
  if (!selection.length || selection[0].type !== 'COMPONENT') {
    const err: MainMessage = {
      type: 'ERROR',
      message: selection.length === 0
        ? '请先在画布上选中广告图模板 Component'
        : '请选中 Main Component，而非 Instance 或其他图层'
    }
    figma.ui.postMessage(err)
    return
  }
  const component = selection[0] as ComponentNode

  // Step 2: resolve bg imageHash
  let resolvedBgHash: string | null = bgImageHash ?? null

  if (!resolvedBgHash && bgBytes) {
    const img = figma.createImage(new Uint8Array(bgBytes))
    resolvedBgHash = img.hash
  }

  if (!resolvedBgHash) {
    const library = findBgLibrary()
    if (!library) {
      const err: MainMessage = {
        type: 'ERROR',
        message: '未找到背景图库，请确认 Figma 文件中有名为 __bg_library__ 的 Frame'
      }
      figma.ui.postMessage(err)
      return
    }
    const bgNode = library.children.find(n => n.name === industry)
    if (bgNode && bgNode.type === 'RECTANGLE') {
      const fills = bgNode.fills as Paint[]
      const imgPaint = fills.find(f => f.type === 'IMAGE') as ImagePaint | undefined
      resolvedBgHash = imgPaint?.imageHash ?? null
    }
    // if still null: warning emitted per-instance below
  }

  // Step 3: resolve photo imageHash
  let resolvedPhotoHash: string | null = null
  if (photoBytes) {
    const img = figma.createImage(new Uint8Array(photoBytes))
    resolvedPhotoHash = img.hash
  }

  // Step 4: calculate layout origin
  const N = configs.length
  const instanceW = component.width
  const instanceH = component.height

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
    instance.name = `${config.code}_ad`

    // Set text + variant properties
    try {
      // setPropertiesAsync is not exposed in the installed @figma/plugin-typings version;
      // setProperties (synchronous) is used instead.
      instance.setProperties({
        headline: config.headline,
        subheadline: config.subheadline,
        cta_text: config.cta_text,
        watermark: config.watermark,
      })
    } catch (e) {
      warnings.push(`${config.code}: setProperties 失败 — ${(e as Error).message}`)
    }

    // Replace bg fill
    if (resolvedBgHash) {
      const bgLayer = findNodeByName(instance, 'bg')
      if (bgLayer && bgLayer.type === 'RECTANGLE') {
        const rect = bgLayer as RectangleNode
        rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: resolvedBgHash }]
      } else {
        warnings.push(`${config.code}: 未找到 bg 图层`)
      }
    } else {
      warnings.push(`${config.code}: 行业背景 "${industry}" 在 __bg_library__ 中无对应图层，bg 保持原样`)
    }

    // Replace photo fill
    if (resolvedPhotoHash) {
      const photoLayer = findNodeByName(instance, 'mockup/photo')
      if (photoLayer && photoLayer.type === 'RECTANGLE') {
        const rect = photoLayer as RectangleNode
        rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: resolvedPhotoHash }]
      } else {
        warnings.push(`${config.code}: 未找到 mockup/photo 图层`)
      }
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

// ─── Main message router ──────────────────────────────────────────
figma.showUI(__html__, { width: 360, height: 560 })

figma.ui.onmessage = async (raw: UIMessage) => {
  try {
    switch (raw.type) {
      case 'GET_INDUSTRIES':
        handleGetIndustries()
        break
      case 'LOAD_SCHEMES':
        await handleLoadSchemes()
        break
      case 'SAVE_SCHEME':
        await handleSaveScheme(raw.name, raw.data)
        break
      case 'GENERATE':
        await handleGenerate(raw)
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
