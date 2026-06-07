'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/fitness_avatar_complete.glb';
const COLOR = '#FF7043';

// カメラをアバターへ向ける（立位・寝位どちらも収まる高さ）
function Rig() {
  const { camera } = useThree();
  useEffect(() => { camera.lookAt(0, 0.62, 0); }, [camera]);
  return null;
}

function Avatar({ clip }: { clip: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);

  // 単色マテリアルに置換（ローポリのフラットシェード）
  useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLOR), roughness: 0.6, metalness: 0, flatShading: true,
    });
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.material = mat; m.frustumCulled = false; }
    });
  }, [scene]);

  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    const name = actions[clip] ? clip : 'Idle';
    const action = actions[name];
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => { action.fadeOut(0.25); };
  }, [clip, actions]);

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

export default function AvatarPreview({ clip }: { clip: string }) {
  return (
    <div className="w-full h-[200px]">
      <Canvas
        camera={{ position: [1.5, 1.2, 3.75], fov: 30 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[3, 6, 4]} intensity={1.3} />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#ffd0b0" />
        <Rig />
        <Suspense fallback={null}>
          <Avatar clip={clip} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(URL);
