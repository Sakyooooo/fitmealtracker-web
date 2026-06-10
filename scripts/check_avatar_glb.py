"""
Validate public/models/Avatar.glb: re-import fresh, list contents, render
key poses of every clip (verifies the IK/constraint bake survived export).

Run:
  & "...blender.exe" --background --python scripts\\check_avatar_glb.py
Output: scripts/_render/avatar_glb/
"""
import bpy, os, mathutils

GLB = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\Avatar.glb"
OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render\avatar_glb"
os.makedirs(OUT, exist_ok=True)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=GLB)

print("OBJECTS:")
for o in bpy.data.objects:
    extra = f" verts={len(o.data.vertices)}" if o.type == 'MESH' else ""
    print(f"  {o.type} '{o.name}'{extra}")
print("ACTIONS:", sorted(a.name for a in bpy.data.actions))

rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
print("BONES:", len(rig.data.bones), sorted(b.name for b in rig.data.bones))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 300
scene.render.resolution_y = 400
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'VERTEX'
scene.display.shading.show_shadows = False
if scene.world is None:
    scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = False
scene.world.color = (0.94, 0.95, 0.96)

def shoot(tag, loc, target, ortho):
    cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = ortho
    cam = bpy.data.objects.new("c", cd)
    scene.collection.objects.link(cam)
    cam.location = loc
    d = mathutils.Vector(target) - mathutils.Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, f"{tag}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", tag)

def assign(ob, name):
    """Find this object's imported action for a clip (importer may suffix).
    Bone actions have pose.bones paths; object actions use plain 'location'."""
    if not ob.animation_data:
        ob.animation_data_create()
    want_bones = ob.type == 'ARMATURE'
    for a in bpy.data.actions:
        if a.name == name or a.name.startswith(name + "_") or a.name.startswith(name + "."):
            has_bones = any(fc.data_path.startswith("pose.bones") for fc in a.fcurves)
            if has_bones == want_bones:
                ob.animation_data.action = a
                return a
    ob.animation_data.action = None
    return None

eq = {o.name: o for o in bpy.data.objects if o.type == 'MESH'}
def show_only(*names):
    for nm, o in eq.items():
        if nm != 'Avatar':
            o.hide_render = nm not in names

bar = next((o for o in bpy.data.objects if o.name.startswith('Barbell')), None)

# (clip, frame, equipment names, camera)
SHOTS = [
    ('Idle', 90, (), ((6, 0, 0.92), (0, 0, 0.92), 2.05)),
    ('Walk', 8, (), ((6, 0, 0.92), (0, 0, 0.92), 2.05)),
    ('Run', 10, (), ((6, 0, 0.92), (0, 0, 0.92), 2.05)),
    ('BenchPress', 30, ('Bench', 'Barbell'), ((6, 0.25, 0.6), (0, 0.25, 0.55), 2.3)),
    ('Squat', 30, ('Barbell',), ((6, 0, 0.92), (0, 0, 0.92), 2.05)),
    ('PullUp', 30, ('PullUpBar',), ((6, 0, 1.35), (0, 0, 1.35), 2.7)),
]
for clip, frame, equips, (loc, tgt, ortho) in SHOTS:
    a1 = assign(rig, clip)
    if bar:
        assign(bar, clip)
    show_only(*[n for o in equips for n in eq if n.startswith(o)])
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    print(f"CLIP {clip}: armature action={'OK' if a1 else 'MISSING'}")
    shoot(f"glb_{clip}_f{frame}", loc, tgt, ortho)

print("CHECK DONE")
