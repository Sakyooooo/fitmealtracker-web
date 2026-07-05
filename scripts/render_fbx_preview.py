"""FBX を正面と斜めからワークベンチレンダリングして形状・ポーズを確認する。
使い方: blender -b --factory-startup -P scripts/render_fbx_preview.py -- <fbx> <out_prefix>
"""
import bpy
import sys
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
path, out_prefix = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=path)

# ── バウンディングボックスと総頂点数 ──
mins = [1e18] * 3
maxs = [-1e18] * 3
total_verts = 0
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    total_verts += len(o.data.vertices)
    for c in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(c)
        for i in range(3):
            mins[i] = min(mins[i], w[i])
            maxs[i] = max(maxs[i], w[i])
center = mathutils.Vector([(a + b) / 2 for a, b in zip(mins, maxs)])
size = max(b - a for a, b in zip(mins, maxs))
print(f"TOTAL_VERTS={total_verts}")
print(f"BBOX size={size:.3f} dims={[round(b-a,3) for a,b in zip(mins,maxs)]}")

# ── ライト ──
sun = bpy.data.lights.new("s", 'SUN')
so = bpy.data.objects.new("sun", sun)
bpy.context.scene.collection.objects.link(so)
so.rotation_euler = (0.9, 0.2, 0.6)

# ── カメラ2方向（正面 / 斜め） ──
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x = 640
sc.render.resolution_y = 840

cam = bpy.data.cameras.new("c")
co = bpy.data.objects.new("cam", cam)
bpy.context.scene.collection.objects.link(co)
sc.camera = co

def shoot(offset, name):
    co.location = center + mathutils.Vector(offset)
    direction = center - co.location
    co.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f"{out_prefix}_{name}.png"
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {sc.render.filepath}")

shoot((0, -size * 1.8, 0), "front")
shoot((size * 1.3, -size * 1.3, size * 0.35), "quarter")
