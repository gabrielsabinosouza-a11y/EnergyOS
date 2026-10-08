import { CHART_BARS, WEEK_DAYS } from "./how-step-constants";

export function HowStepClareza() {
  return (
    <div className="how-step how-step--clareza">
      <div className="how-step__kicker">TENDÊNCIAS · Prévia ilustrativa</div>
      <h3>Energia nos últimos 7 dias</h3>
      <svg
        className="how-step__chart"
        viewBox="0 0 280 126"
        role="img"
        aria-label="Gráfico ilustrativo de energia em 7 dias"
      >
        {CHART_BARS.map((value, i) => {
          const max = 94;
          const h = (value / max) * 88;
          const x = 18 + i * 38;
          const y = 100 - h;
          const last = i === CHART_BARS.length - 1;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={22}
                height={h}
                rx={4}
                className={last ? "how-step__chart-bar is-last" : "how-step__chart-bar"}
              />
              <text
                x={x + 11}
                y={116}
                textAnchor="middle"
                className="how-step__chart-label"
              >
                {WEEK_DAYS[i]}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="how-step__insight">
        Você rende mais nos dias de sono acima de 7h.
      </p>
    </div>
  );
}
