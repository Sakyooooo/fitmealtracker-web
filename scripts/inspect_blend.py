import bpy, bmesh, math

print("=== BLEND INSPECTION START ===")
print("objects:", len(bpy.data.objects))
for o in bpy.data.objects:
    print(f"  OBJ name='{o.name}' type={o.type} parent={o.parent.name if o.parent else None}")

# meshes
total_tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        me = o.data
        # triangulated count
        tris = sum(max(0, len(p.vertices) - 2) for p in me.polygons)
        total_tris += tris
        # bounding box in world
        coords = [o.matrix_world @ v.co for v in me.vertices]
        if coords:
            xs=[c.x for c in coords]; ys=[c.y for c in coords]; zs=[c.z for c in coords]
            bb=f"x[{min(xs):.2f},{max(xs):.2f}] y[{min(ys):.2f},{max(ys):.2f}] z[{min(zs):.2f},{max(zs):.2f}]"
        else:
            bb="(empty)"
        vg = [g.name for g in o.vertex_groups]
        sk = o.data.shape_keys.key_blocks.keys() if o.data.shape_keys else []
        mods = [(m.name, m.type) for m in o.modifiers]
        print(f"  MESH '{o.name}': verts={len(me.vertices)} tris={tris} mats={[m.name for m in me.materials]}")
        print(f"     bbox(world)={bb}")
        print(f"     vertex_groups({len(vg)})={vg[:30]}")
        print(f"     shape_keys={list(sk)} modifiers={mods}")
        print(f"     scale={tuple(round(s,3) for s in o.scale)} loc={tuple(round(s,3) for s in o.location)} rot_euler={tuple(round(math.degrees(r),1) for r in o.rotation_euler)}")

print("TOTAL TRIS:", total_tris)

# armatures
arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
print("armatures:", len(arms))
for a in arms:
    print(f"  ARMATURE '{a.name}' bones={len(a.data.bones)}")
    for b in a.data.bones:
        print(f"     bone {b.name} parent={b.parent.name if b.parent else None}")

# materials
print("materials:", len(bpy.data.materials))
for m in bpy.data.materials:
    print(f"  MAT '{m.name}' use_nodes={m.use_nodes}")

# actions/animations
print("actions:", len(bpy.data.actions))
for ac in bpy.data.actions:
    print(f"  ACTION '{ac.name}' frames={ac.frame_range[:]}")

# images
print("images:", [i.name for i in bpy.data.images if i.name != 'Render Result'])
print("=== BLEND INSPECTION END ===")
