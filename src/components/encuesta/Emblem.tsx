export function Emblem() {
  return (
    <div className="emblem" aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <g transform="translate(200 200) scale(1.02) translate(-200 -200)">
          <path className="arc gold-arc" pathLength={1} d="M18 200A182 182 0 0 1 382 200" />
          <path className="arc blue-arc a2" pathLength={1} d="M382 200A182 182 0 0 1 327 330" />
          <path className="arc red-arc a3" pathLength={1} d="M327 330A182 182 0 0 1 73 330" />
          <path className="arc blue-arc a4" pathLength={1} d="M73 330A182 182 0 0 1 18 200" />
        </g>
      </svg>
      <div className="face" />
    </div>
  );
}
