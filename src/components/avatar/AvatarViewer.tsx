'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarClip, CLIP_EQUIPMENT, EQUIPMENT_NODES } from './clips';

const URL = '/models/Avatar.glb';

// procedural matcap (soft studio sphere) — no texture assets, no lights needed
function makeMatcap(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(96, 84, 20, 128, 128, 150);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.35, '#eceef2');
  grad.addColorStop(0.72, '#bcc1cb');
  grad.addColorStop(1.0, '#878d9b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Model({ clip }: { clip: AvatarClip }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions } = useAnimations(animations, group);

  // matcap × vertex colors (#ECECEC body / #00C2FF accents from the GLB)
  useMemo(() => {
    const mat = new THREE.MeshMatcapMaterial({ matcap: makeMatcap(), vertexColors: true });
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.frustumCulled = false;
      }
    });
  }, [scene]);

  // per-clip equipment visibility
  useEffect(() => {
    const visible = CLIP_EQUIPMENT[clip] ?? [];
    for (const name of EQUIPMENT_NODES) {
      const node = scene.getObjectByName(name);
      if (node) node.visible = visible.includes(name);
    }
  }, [scene, clip]);

  // crossfade: outgoing effect fades the old action while the new fades in
  useEffect(() => {
    const action = actions[clip] ?? actions.Idle;
    if (!action) return;
    action.reset().fadeIn(0.3).play();
    return () => {
      action.fadeOut(0.3);
    };
  }, [clip, actions]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

type Props = {
  clip?: AvatarClip;
  className?: string;
  controls?: boolean;
  shadow?: boolean;
};

export default function AvatarViewer({
  clip = 'Idle',
  className = 'w-full h-[420px]',
  controls = true,
  shadow = true,
}: Props) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [2.4, 1.6, 3.4], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Model clip={clip} />
          {shadow && (
            <ContactShadows position={[0, 0, 0]} opacity={0.32} scale={4} blur={2.6} far={1.6} />
          )}
        </Suspense>
        {controls && (
          <OrbitControls
            target={[0, 1.0, 0]}
            enablePan={false}
            minDistance={1.6}
            maxDistance={7}
            maxPolarAngle={Math.PI * 0.55}
          />
        )}
      </Canvas>
    </div>
  );
}

useGLTF.preload(URL);
