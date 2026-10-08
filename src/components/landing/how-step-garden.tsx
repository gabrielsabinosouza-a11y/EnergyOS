"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ENERGY_CONFIGS, type EnergyType } from "@/lib/energy-assets";

const CAPACITY = 40;
const START: { slot: number; type: EnergyType; label: string; minutes: number; day: string }[] = [
  { slot: 2, type: "flame", label: "Energia de foco", minutes: 45, day: "qua" },
  { slot: 6, type: "water", label: "Energia de descanso", minutes: 30, day: "ter" },
  { slot: 11, type: "wind", label: "Energia de movimento", minutes: 25, day: "seg" },
  { slot: 17, type: "earth", label: "Energia de estudo", minutes: 60, day: "dom" },
  { slot: 23, type: "ice", label: "Energia de foco", minutes: 35, day: "sáb" },
  { slot: 29, type: "cosmic", label: "Energia de pausa", minutes: 20, day: "sex" },
];

export function HowStepGarden() {
  const [plants, setPlants] = useState(START);
  const slots = useMemo(() => Array.from({ length: CAPACITY }, (_, index) => ({ index, plant: plants.find((item) => item.slot === index) })), [plants]);
  const focusMinutes = plants.reduce((total, plant) => total + plant.minutes, 0);
  function plant(index: number) {
    if (plants.some((item) => item.slot === index) || plants.length >= CAPACITY) return;
    const types: EnergyType[] = ["flame", "water", "wind", "earth", "ice", "cosmic"];
    const type = types[plants.length % types.length];
    setPlants((current) => [...current, { slot: index, type, label: "Energia de foco", minutes: 25, day: "hoje" }]);
  }
  return <div className="how-step how-step--garden">
    <div className="how-step__kicker">REGISTROS · Prévia ilustrativa</div><h3>Seu jardim de energias</h3>
    <div className="garden-demo-stats"><span><b>{plants.length}</b> energias plantadas</span><span><b>{focusMinutes}</b> min de foco</span></div>
    <div className="garden-demo-grid" aria-label="Jardim demonstrativo">
      {slots.map(({ index, plant: entry }) => {
        const config = entry ? ENERGY_CONFIGS[entry.type] : null;
        return <button key={index} type="button" className={`garden-demo-slot${entry ? " is-planted" : ""}`} onClick={() => plant(index)} disabled={Boolean(entry) || plants.length >= CAPACITY} aria-label={entry ? `${entry.label} · ${entry.minutes} min · ${entry.day}` : "Plantar uma energia neste espaço"} title={entry ? `${entry.label} · ${entry.minutes} min · ${entry.day}` : "Plantar energia"} style={{ "--plant-glow": config?.glow ?? "transparent" } as React.CSSProperties}>
          {entry && config ? <Image src={config.assets.full} alt={config.label} width={38} height={38} unoptimized /> : <span aria-hidden="true" />}
        </button>;
      })}
    </div>
    <footer className="garden-demo-footer"><span>{plants.length === CAPACITY ? "Seu jardim está completo. Que bela coleção!" : "Selecione um espaço vazio para plantar."}</span><button type="button" onClick={() => setPlants(START)}>Limpar</button></footer>
  </div>;
}
