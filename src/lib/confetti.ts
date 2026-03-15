/**
 * Lightweight confetti effect using CSS animations.
 * No external dependencies. Creates temporary DOM elements.
 */
export function fireConfetti() {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden'
  document.body.appendChild(container)

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement('div')
    const color = colors[Math.floor(Math.random() * colors.length)]
    const x = Math.random() * 100
    const delay = Math.random() * 0.5
    const size = Math.random() * 6 + 4
    const rotation = Math.random() * 360

    particle.style.cssText = `
      position:absolute;
      top:-10px;
      left:${x}%;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
      transform:rotate(${rotation}deg);
      animation:confetti-fall ${1.5 + Math.random()}s ease-in ${delay}s forwards;
    `
    container.appendChild(particle)
  }

  // Add animation keyframes if not already present
  if (!document.getElementById('confetti-styles')) {
    const style = document.createElement('style')
    style.id = 'confetti-styles'
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `
    document.head.appendChild(style)
  }

  // Cleanup after animation
  setTimeout(() => container.remove(), 3000)
}
