"""筋肉人型モデル(静的・高ポリ・多パーツ)を Mixamo 自動リガー用に前処理する。

  1. 全メッシュを結合（トランスフォーム適用済み）
  2. ボクセルリメッシュで多シェルを1枚の水密サーフェスに統合
  3. デシメートで目標頂点数まで軽量化
  4. マテリアル除去（アプリ側は matcap で上書きするため不要）→ FBX 出力

使い方:
  blender -b --factory-startup -P scripts/prep_muscle_for_mixamo.py -- <src.fbx> <out.fbx>
"""
import bpy
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
TARGET_TRIS = 80_000  # 目標三角形数（≒頂点4万前後）

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)

# ── 1. メッシュだけ残して結合 ──────────────────────────────────────────────
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"[prep] meshes={len(meshes)}")
for o in bpy.data.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.make_single_user(object=True, obdata=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
body = bpy.context.active_object
body.name = 'MuscleBody'

# メッシュ以外（Empty等）を削除
for o in list(bpy.data.objects):
    if o is not body:
        bpy.data.objects.remove(o, do_unlink=True)

v0 = len(body.data.vertices)
print(f"[prep] joined verts={v0}")

# ── 2. ボクセルリメッシュ（多シェル → 1枚の水密メッシュ） ───────────────────
dims = body.dimensions
height = max(dims)
body.data.remesh_voxel_size = height / 220  # 身長の1/220 ≒ 細部を保ちつつ結合
bpy.ops.object.voxel_remesh()
v1 = len(body.data.vertices)
print(f"[prep] remeshed verts={v1} (voxel={height/220:.4f})")

# ── 3. デシメート ────────────────────────────────────────────────────────────
tris = len(body.data.polygons) * 2  # remesh後はクアッド主体
ratio = min(1.0, TARGET_TRIS / max(1, tris))
mod = body.modifiers.new('dec', 'DECIMATE')
mod.ratio = ratio
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.shade_smooth()
v2 = len(body.data.vertices)
print(f"[prep] decimated verts={v2} (ratio={ratio:.3f})")

# ── 4. マテリアル除去 → FBX 出力 ────────────────────────────────────────────
body.data.materials.clear()
bpy.ops.export_scene.fbx(
    filepath=OUT,
    use_selection=False,
    add_leaf_bones=False,
    path_mode='STRIP',
)
import os
print(f"[done] {OUT} ({os.path.getsize(OUT)/1024/1024:.1f} MB, verts={v2})")
