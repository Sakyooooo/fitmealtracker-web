"""FBX の中身（オブジェクト/リグ/ボーン名/スキン）を調べる。
使い方: blender -b --factory-startup -P scripts/inspect_fbx.py -- <path>
"""
import bpy
import sys

path = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=path)

for o in bpy.data.objects:
    print(f"OBJ type={o.type} name='{o.name}' parent={o.parent.name if o.parent else None} scale={tuple(round(s,3) for s in o.scale)}")
    if o.type == 'MESH':
        print(f"   verts={len(o.data.vertices)} mats={[m.name if m else None for m in o.data.materials]}")
        for mod in o.modifiers:
            print(f"   modifier {mod.type} -> {getattr(mod, 'object', None)}")
        vg = [g.name for g in o.vertex_groups]
        print(f"   vgroups={len(vg)} sample={vg[:10]}")
    if o.type == 'ARMATURE':
        bones = [b.name for b in o.data.bones]
        print(f"   bones={len(bones)}")
        print(f"   bone names: {bones[:20]}")
        # 身長の目安（バウンディングボックス）
print("ACTIONS:", [a.name for a in bpy.data.actions])
