"""
Render N frames of ONE animation across its loop into a strip, to review motion.
Usage:
  blender --background --python render_anim_strip.py -- <AnimName> [frames]
"""
import bpy, sys, os, mathutils

argv = sys.argv
args = argv[argv.index("--") + 1:] if "--" in argv else []
NAME = args[0] if args else "Idle"
NF = int(args[1]) if len(args) > 1 else 6
VIEW = args[2] if len(args) > 2 else "34"   # "34" (3/4) or "front"

GLB = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\fitness_avatar_complete.glb"
OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render\strip"
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 240; scene.render.resolution_y = 320
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'SINGLE'
scene.display.shading.single_color = (1.0, 0.44, 0.26)
if scene.world is None: scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = False; scene.world.color = (0.97, 0.97, 0.99)

cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = 2.5
cam = bpy.data.objects.new("c", cd); scene.collection.objects.link(cam)
if VIEW == "front":
    cam.location = (0.0, -6.0, 0.9)
elif VIEW == "side":
    cam.location = (6.0, 0.0, 0.6)
else:
    cam.location = (3.0, -4.0, 1.5)
d = mathutils.Vector((0, 0, 0.45)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

# find action whose base name matches NAME (import adds _Armature suffix)
act = None
for a in bpy.data.actions:
    if a.name == NAME or a.name.split('_')[0] == NAME or a.name.startswith(NAME):
        act = a; break
if not act:
    print("ANIM NOT FOUND:", NAME, "available:", [a.name for a in bpy.data.actions]); raise SystemExit
if not arm.animation_data: arm.animation_data_create()
arm.animation_data.action = act
f0, f1 = act.frame_range
print(f"STRIP '{NAME}' range={f0}..{f1} frames={NF}")
for i in range(NF):
    t = i / (NF - 1) if NF > 1 else 0
    fr = int(f0 + t * (f1 - f0 - 1))  # avoid exact last == first
    scene.frame_set(fr); bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(OUT, f"{NAME}_{i}.png")
    bpy.ops.render.render(write_still=True)
print("STRIP DONE", NAME)
