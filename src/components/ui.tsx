import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`panel ${className}`}>{children}</section>;
}

export function Button({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`primary-button ${className}`} {...props}>{children}</button>;
}

export function Input({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return <label className="field-label">{label}<input className={`field-input ${className}`} {...props} /></label>;
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="progress-track" aria-label={`${value}% concluído`}><div className="progress-value" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div>;
}

export function Modal({ children, title, onClose }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-content"><div className="modal-header"><h2>{title}</h2><button className="text-button" onClick={onClose}>Fechar</button></div>{children}</div></div>;
}
