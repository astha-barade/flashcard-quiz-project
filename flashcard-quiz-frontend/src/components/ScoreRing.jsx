// A circular score display built with CSS only.
export default function ScoreRing({ percent, children }) {
  return (
    <div className="score-ring" style={{ '--pct': `${percent}%` }}>
      <div className="score-ring-inner">{children}</div>
    </div>
  )
}
