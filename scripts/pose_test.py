"""Apply a single test pose to the avatar and render side/34/front (auto-framed).
Edit POSE below and re-run (no full rebuild needed)."""
import bpy, math, os, mathutils

GLB = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\fitness_avatar_complete.glb"
OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render"
TAG = "pose"

# ── EDIT THIS POSE ────────────────────────────────────────────────────────────
HIPS_LOC = (0, -0.72, 0.24)
POSE = {
    'Hips': (90, 0, 0),
    'Spine': (-3, 0, 0), 'Chest': (1, 0, 0), 'Neck': (-26, 0, 0), 'Head': (-8, 0, 0),
    'LeftUpperLeg': (-3, 0, 4), 'RightUpperLeg': (-3, 0, -4),
    'LeftLowerLeg': (2, 0, 0), 'RightLowerLeg': (2, 0, 0),
    'LeftFoot': (-44, 0, 0), 'RightFoot': (-44, 0, 0),
    # forearms converge so hands meet in front (clasped look)
    'LeftUpperArm': (34, 0, 66), 'RightUpperArm': (34, 0, -66),
    'LeftLowerArm': (-86, 0, 0), 'RightLowerArm': (-86, 0, 0),
}
# ──────────────────────────────────────────────────────────────────────────────

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')

for nm, val in POSE.items():
    pb = arm.pose.bones.get(nm)
    if not pb: print("missing", nm); continue
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = (math.radians(val[0]), math.radians(val[1]), math.radians(val[2]))
hb = arm.pose.bones['Hips']; hb.location = HIPS_LOC
bpy.context.view_layer.update()

# numeric joint positions (x=L/R, y=-fwd, z=up)
for bn in ['LeftLowerArm', 'RightLowerArm', 'LeftHand', 'RightHand', 'Head', 'LeftFoot']:
    pb = arm.pose.bones.get(bn)
    if pb:
        hw = arm.matrix_world @ pb.head
        tw = arm.matrix_world @ pb.tail
        print(f"  {bn}: head={tuple(round(c,3) for c in hw)} tail={tuple(round(c,3) for c in tw)}")

# auto-frame from deformed mesh
deps = bpy.context.evaluated_depsgraph_get()
ev = mesh.evaluated_get(deps)
cos = [mesh.matrix_world @ v.co for v in ev.data.vertices]
mn = mathutils.Vector((min(c.x for c in cos), min(c.y for c in cos), min(c.z for c in cos)))
mx = mathutils.Vector((max(c.x for c in cos), max(c.y for c in cos), max(c.z for c in cos)))
ctr = (mn + mx) / 2
size = max((mx - mn).x, (mx - mn).y, (mx - mn).z)
print(f"POSE bbox center={tuple(round(c,2) for c in ctr)} size={size:.2f}")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 360; scene.render.resolution_y = 300
scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'SINGLE'
scene.display.shading.single_color = (1.0, 0.44, 0.26)
if scene.world is None: scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = False; scene.world.color = (0.96, 0.96, 0.98)

def cam_at(loc):
    cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = size * 1.35
    c = bpy.data.objects.new("c", cd); scene.collection.objects.link(c); c.location = loc
    d = ctr - mathutils.Vector(loc); c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return c

R = size * 4 + 3
views = {'side': (R, 0, ctr.z + 0.2), '34': (R * 0.7, -R * 0.8, ctr.z + size * 0.4),
         'front': (0, -R, ctr.z + 0.1)}
for nm, loc in views.items():
    scene.camera = cam_at(loc)
    scene.render.filepath = os.path.join(OUT, f"{TAG}_{nm}.png")
    bpy.ops.render.render(write_still=True)
    print("R", nm)
print("POSE TEST DONE")
