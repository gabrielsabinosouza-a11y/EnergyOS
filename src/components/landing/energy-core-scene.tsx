"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useRef } from "react";
import * as THREE from "three";

function CoreModel({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const arcAngle = Math.PI * 2 * 0.78;

  useFrame(({ clock, pointer }) => {
    if (!active || !group.current) return;
    const time = clock.getElapsedTime();
    group.current.rotation.y += (pointer.x * 0.18 - group.current.rotation.y) * 0.035;
    group.current.rotation.x += (-pointer.y * 0.12 - group.current.rotation.x) * 0.035;
    group.current.rotation.z = Math.sin(time * 0.18) * 0.025 + Math.min(window.scrollY / 5000, 0.08);
    group.current.position.y = Math.sin(time * 0.42) * 0.045;
    if (ring.current) ring.current.rotation.y = Math.sin(time * 0.22) * 0.035;
  });

  return (
    <group ref={group} rotation={[0.28, 0.1, -0.3]}>
      <mesh ref={ring} castShadow>
        <torusGeometry args={[1.05, 0.19, 20, 96]} />
        <meshPhysicalMaterial color="#090f1c" metalness={0.82} roughness={0.2} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <torusGeometry args={[1.05, 0.205, 16, 100, arcAngle]} />
        <meshStandardMaterial color="#6dd3ff" emissive="#4bcaff" emissiveIntensity={2.2} metalness={0.35} roughness={0.28} />
      </mesh>
      <mesh position={[Math.cos(arcAngle) * 1.05, Math.sin(arcAngle) * 1.05, 0.02]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color="#e9faff" />
      </mesh>
      <mesh scale={0.67}>
        <icosahedronGeometry args={[1, 2]} />
        <meshPhysicalMaterial color="#0b1b2d" metalness={0.44} roughness={0.23} clearcoat={1} emissive="#08263c" emissiveIntensity={0.28} />
      </mesh>
      <pointLight color="#6dd3ff" intensity={4} distance={3.4} position={[0.9, 0.6, 1.2]} />
      <pointLight color="#2c74a1" intensity={2} distance={3} position={[-1, -0.6, -0.8]} />
    </group>
  );
}

export default function EnergyCoreScene({ active }: { active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "demand"}
      camera={{ position: [0, 0, 4.2], fov: 38 }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      aria-label="Prévia 3D do núcleo de energia energyOS"
    >
      <ambientLight intensity={0.65} />
      <directionalLight color="#d8f5ff" intensity={2.2} position={[2, 3, 4]} />
      <CoreModel active={active} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.75} intensity={0.8} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
