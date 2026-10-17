import React, { useState, useRef, useCallback, useEffect } from 'react'

interface SplitPaneProps {
  left: React.ReactNode
  right: React.ReactNode
  defaultLeftWidthPercent?: number
  minLeftWidth?: number
  minRightWidth?: number
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  defaultLeftWidthPercent = 45,
  minLeftWidth = 320,
  minRightWidth = 380
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState<number | null>(null)
  const isDragging = useRef(false)

  // Initialize width on mount
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      setLeftWidth((containerWidth * defaultLeftWidthPercent) / 100)
    }
  }, [defaultLeftWidthPercent])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newLeft = moveEvent.clientX - rect.left

      if (newLeft >= minLeftWidth && rect.width - newLeft >= minRightWidth) {
        setLeftWidth(newLeft)
      }
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [minLeftWidth, minRightWidth])

  return (
    <div ref={containerRef} className="flex-1 flex h-full w-full overflow-hidden relative">
      {/* Left Pane */}
      <div
        style={{ width: leftWidth ? `${leftWidth}px` : `${defaultLeftWidthPercent}%` }}
        className="h-full overflow-hidden flex flex-col shrink-0"
      >
        {left}
      </div>

      {/* Draggable Divider Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary transition-colors flex items-center justify-center shrink-0 border-l border-r border-border/40 group select-none"
        title="드래그하여 좌우 크기 조절"
      >
        <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary transition-colors" />
      </div>

      {/* Right Pane */}
      <div className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
        {right}
      </div>
    </div>
  )
}
