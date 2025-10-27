const attachPanzoom = svg => {
  const container = svg.closest('.mermaid-container')
  if (!container) return

  if (container.panzoomCleanup) {
    container.panzoomCleanup()
  }

  const clientWidth = svg.clientWidth || 1
  const clientHeight = svg.clientHeight || 1

  let bbox = { width: clientWidth, height: clientHeight }
  try {
    bbox = svg.getBBox()
  } catch (err) {
    // ignored
  }

  const rawBaseWidth = svg.viewBox.baseVal && svg.viewBox.baseVal.width
    ? svg.viewBox.baseVal.width
    : bbox.width || clientWidth
  const rawBaseHeight = svg.viewBox.baseVal && svg.viewBox.baseVal.height
    ? svg.viewBox.baseVal.height
    : bbox.height || clientHeight
  const baseWidth = rawBaseWidth || clientWidth || 1000
  const baseHeight = rawBaseHeight || clientHeight || 1000
  const baseX = svg.viewBox.baseVal && svg.viewBox.baseVal.width
    ? svg.viewBox.baseVal.x
    : 0
  const baseY = svg.viewBox.baseVal && svg.viewBox.baseVal.height
    ? svg.viewBox.baseVal.y
    : 0

  let viewBox = svg.hasAttribute('viewBox')
    ? {
        x: svg.viewBox.baseVal.x,
        y: svg.viewBox.baseVal.y,
        width: svg.viewBox.baseVal.width,
        height: svg.viewBox.baseVal.height
      }
    : {
        x: baseX,
        y: baseY,
        width: baseWidth,
        height: baseHeight
      }

  if (viewBox.width === 0 || viewBox.height === 0) {
    viewBox = {
      x: baseX,
      y: baseY,
      width: baseWidth,
      height: baseHeight
    }
  }

  const initialViewBox = { ...viewBox }

  const minWidth = baseWidth / 6
  const maxWidth = baseWidth * 6
  const aspectRatio = baseWidth === 0 ? 1 : baseHeight / baseWidth
  const minHeight = minWidth * aspectRatio
  const maxHeight = maxWidth * aspectRatio

  const updateViewBox = () => {
    svg.setAttribute(
      'viewBox',
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
    )
  }

  if (!svg.hasAttribute('viewBox')) {
    updateViewBox()
  }

  svg.style.pointerEvents = 'all'
  svg.style.cursor = 'grab'

  let isPanning = false
  let panStart = { x: 0, y: 0 }
  let panOrigin = { x: 0, y: 0 }

  const getCenter = () => ({
    x: viewBox.x + viewBox.width / 2,
    y: viewBox.y + viewBox.height / 2
  })

  const applyZoom = (scaleFactor, focusX, focusY) => {
    const targetX = typeof focusX === 'number' ? focusX : getCenter().x
    const targetY = typeof focusY === 'number' ? focusY : getCenter().y

    let newWidth = viewBox.width * scaleFactor
    let newHeight = viewBox.height * scaleFactor

    newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth)
    newHeight = Math.min(Math.max(newHeight, minHeight), maxHeight)

    const scaleX = newWidth / viewBox.width
    const scaleY = newHeight / viewBox.height

    viewBox.x = targetX - (targetX - viewBox.x) * scaleX
    viewBox.y = targetY - (targetY - viewBox.y) * scaleY
    viewBox.width = newWidth
    viewBox.height = newHeight

    updateViewBox()
  }

  const toSvgCoords = evt => {
    const point = svg.createSVGPoint()
    point.x = evt.clientX
    point.y = evt.clientY
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: evt.clientX, y: evt.clientY }
    return point.matrixTransform(matrix.inverse())
  }

  const wheelHandler = evt => {
    evt.preventDefault()
    const scaleFactor = evt.deltaY > 0 ? 1.1 : 0.9
    const pointer = toSvgCoords(evt)
    applyZoom(scaleFactor, pointer.x, pointer.y)
  }

  const mouseDown = evt => {
    if (evt.button !== 0) {
      return
    }
    isPanning = true
    panStart = { x: evt.clientX, y: evt.clientY }
    panOrigin = { x: viewBox.x, y: viewBox.y }
    svg.style.cursor = 'grabbing'
  }

  const mouseMove = evt => {
    if (!isPanning) return
    const dx = evt.clientX - panStart.x
    const dy = evt.clientY - panStart.y

    const scaleX = viewBox.width / clientWidth
    const scaleY = viewBox.height / clientHeight

    viewBox.x = panOrigin.x - dx * scaleX
    viewBox.y = panOrigin.y - dy * scaleY

    updateViewBox()
  }

  const endPan = () => {
    if (!isPanning) return
    isPanning = false
    svg.style.cursor = 'grab'
  }

  const dblClickHandler = evt => {
    evt.preventDefault()
    viewBox = { ...initialViewBox }
    updateViewBox()
  }

  const controls = document.createElement('div')
  controls.className = 'mermaid-controls'
  controls.innerHTML = `
    <button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>
    <button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>
    <button type="button" data-action="reset" aria-label="Reset view">⟳</button>
  `

  const stopProp = evt => evt.stopPropagation()
  controls.addEventListener('mousedown', stopProp)
  controls.addEventListener('wheel', stopProp)

  const zoomInHandler = evt => {
    evt.preventDefault()
    evt.stopPropagation()
    const center = getCenter()
    applyZoom(0.8, center.x, center.y)
  }

  const zoomOutHandler = evt => {
    evt.preventDefault()
    evt.stopPropagation()
    const center = getCenter()
    applyZoom(1.25, center.x, center.y)
  }

  const resetHandler = evt => {
    evt.preventDefault()
    evt.stopPropagation()
    viewBox = { ...initialViewBox }
    updateViewBox()
  }

  controls.querySelector('[data-action="zoom-in"]').addEventListener('click', zoomInHandler)
  controls.querySelector('[data-action="zoom-out"]').addEventListener('click', zoomOutHandler)
  controls.querySelector('[data-action="reset"]').addEventListener('click', resetHandler)

  container.appendChild(controls)

  svg.addEventListener('wheel', wheelHandler, { passive: false })
  svg.addEventListener('mousedown', mouseDown)
  window.addEventListener('mousemove', mouseMove)
  window.addEventListener('mouseup', endPan)
  svg.addEventListener('mouseleave', endPan)
  svg.addEventListener('dblclick', dblClickHandler)

  container.panzoomCleanup = () => {
    svg.removeEventListener('wheel', wheelHandler)
    svg.removeEventListener('mousedown', mouseDown)
    window.removeEventListener('mousemove', mouseMove)
    window.removeEventListener('mouseup', endPan)
    svg.removeEventListener('mouseleave', endPan)
    svg.removeEventListener('dblclick', dblClickHandler)
    controls.querySelector('[data-action="zoom-in"]').removeEventListener('click', zoomInHandler)
    controls.querySelector('[data-action="zoom-out"]').removeEventListener('click', zoomOutHandler)
    controls.querySelector('[data-action="reset"]').removeEventListener('click', resetHandler)
    controls.removeEventListener('mousedown', stopProp)
    controls.removeEventListener('wheel', stopProp)
    controls.remove()
    delete container.panzoomCleanup
  }
}

const renderMermaid = () => {
  if (!window.mermaid) return

  document.querySelectorAll('.mermaid-container').forEach(container => {
    if (container.panzoomCleanup) {
      container.panzoomCleanup()
    }
  })

  window
    .mermaid
    .run({ querySelector: '.mermaid' })
    .then(() => {
      document.querySelectorAll('.mermaid-container svg').forEach(svg => {
        attachPanzoom(svg)
      })
    })
    .catch(err => console.error('Mermaid render error:', err))
}

const initializeMermaid = () => {
  if (!window.mermaid) return

  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    themeVariables: {
      fontSize: '16px',
      lineHeight: '22px',
      sequenceNumberFontSize: '16px',
      actorFontSize: '16px',
      actorLineHeight: '22px',
      noteFontSize: '14px',
      messageFontSize: '16px',
      labelTextColor: '#111'
    },
    flowchart: { useMaxWidth: false },
    sequence: {
      useMaxWidth: false,
      diagramMarginX: 40,
      diagramMarginY: 20,
      actorMargin: 60
    }
  })

  renderMermaid()
}

document.addEventListener('DOMContentLoaded', initializeMermaid)

if (window.document$) {
  window.document$.subscribe(() => {
    renderMermaid()
  })
}
