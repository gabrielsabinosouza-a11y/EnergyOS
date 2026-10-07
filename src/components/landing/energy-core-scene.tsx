"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useRef } from "react";
import * as THREE from "three";

function ClearAlpha() {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.setClearColor(0x000000, 0);
    scene.background = null;
  }, [gl, scene]);
  return null;
}

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
        <meshStandardMaterial color="#6dd3ff" emissive="#4bcaff" emissiveIntensity={1.6} metalness={0.35} roughness={0.32} />
      </mesh>
      <pointLight color="#6dd3ff" intensity={2.4} distance={3.4} position={[0.9, 0.6, 1.2]} />
      <pointLight color="#2c74a1" intensity={1.4} distance={3} position={[-1, -0.6, -0.8]} />
    </group>
  );
}

export default function EnergyCoreScene({ active }: { active: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "demand"}
      camera={{ position: [0, 0, 4.2], fov: 38 }}
      gl={{ alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "low-power" }}
      style={{ background: "transparent" }}
      aria-label="Prévia 3D do núcleo de energia energyOS"
    >
      <ClearAlpha />
      <ambientLight intensity={0.55} />
      <directionalLight color="#d8f5ff" intensity={1.6} position={[2, 3, 4]} />
      <CoreModel active={active} />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom luminanceThreshold={0.88} intensity={0.55} mipmapBlur levels={5} />
      </EffectComposer>
    </Canvas>
  );
}
