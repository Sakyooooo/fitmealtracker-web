'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const URL = '/models/exercise_avatar.glb';

/** GLB に焼き込んだアニメーションクリップ名（scripts/build_exercise_avatar_glb.py と対応） */
export type ExerciseClip = 'idle' | 'situps' | 'crunch' | 'pushup' | 'squat' | 'run' | 'walk';

// AvatarViewer と同じプロシージャルmatcap（ライト・テクスチャ不要で軽い）
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

function Model({ clip }: { clip: ExerciseClip }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(URL);
  const { actions } = useAnimations(animations, group);
  const [normalized, setNormalized] = useState<{ scale: number; yOffset: number } | null>(null);

  // マテリアル差し替え: 本体=明るいグレー / 関節=ダークトーン（Y Bot の2メッシュ構成）
  useMemo(() => {
    const matcap = makeMatcap();
    const surface = new THREE.MeshMatcapMaterial({ matcap, color: '#cdd3dc' });
    const joints = new THREE.MeshMatcapMaterial({ matcap, color: '#4a5568' });
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = m.name.includes('Joints') ? joints : surface;
        m.frustumCulled = false;
      }
    });
  }, [scene]);

  // 背丈から実寸(1.6m)へ正規化する。
  // このGLBはバインド姿勢が「腰原点(足が-8.2)」、アニメ姿勢が「接地(足が0.77)」と
  // 座標系が大きくズレているため、バインドで測ると必ず浮く。アニメーションが
  // 完全に適用された(フェードイン完了)フレームのボーンのワールドY範囲で一度だけ測る。
  // メッシュのBox3ではなくボーンで測るのは、描画結果を直接決めるのがボーン位置だから。
  useFrame(() => {
    if (normalized) return;
    const active = Object.values(actions).find((a) => a && a.isRunning());
    if (!active || active.getEffectiveWeight() < 0.99) return;
    scene.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let minY = Infinity;
    let maxY = -Infinity;
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        for (const bone of m.skeleton.bones) {
          const y = bone.getWorldPosition(v).y;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    });
    const height = maxY - minY;
    if (!isFinite(height) || height <= 0) return;
    // この時点で group は scale=1/offset=0 なのでボーン座標はモデル素の座標系
    const scale = 1.6 / height;
    setNormalized({ scale, yOffset: -minY * scale });
  });

  // クリップ切替: クロスフェード（AvatarViewer と同パターン）
  useEffect(() => {
    const action = actions[clip] ?? actions.idle;
    if (!action) return;
    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.25);
    };
  }, [clip, actions]);

  return (
    <group
      ref={group}
      visible={normalized !== null}
      scale={normalized?.scale ?? 1}
      position={[0, normalized?.yOffset ?? 0, 0]}
    >
      <primitive object={scene} />
    </group>
  );
}

type Props = {
  clip?: ExerciseClip;
  className?: string;
};

/** ジムセッション中の種目実演ステージ。選択中の種目をアバターが実演する。 */
export default function ExerciseAvatarStage({ clip = 'idle', className = 'w-full h-full' }: Props) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [1.9, 1.4, 3.0], fov: 34 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <Model clip={clip} />
          <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={4.5} blur={2.4} far={1.6} />
        </Suspense>
        <OrbitControls
          target={[0, 0.75, 0]}
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI * 0.55}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload(URL);
