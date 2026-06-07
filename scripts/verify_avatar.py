import bpy, math, os, mathutils

GLB = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\fitness_avatar_complete.glb"
OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render"
os.makedirs(OUT, exist_ok=True)

# clean scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.import_scene.gltf(filepath=GLB)

arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
mesh = next((o for o in bpy.data.objects if o.type == 'MESH'), None)
print("IMPORT bones:", [b.name for b in arm.data.bones] if arm else None)
print("IMPORT anims:", [a.name for a in bpy.data.actions])
# height
vs = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
ys = [v.y for v in vs]
print(f"IMPORT mesh verts={len(vs)} y(height up in gltf)=[{min(ys):.2f},{max(ys):.2f}]")

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 420; scene.render.resolution_y = 620
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'SINGLE'
scene.display.shading.single_color = (0.5, 0.6, 0.8)
if scene.world is None: scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = False; scene.world.color = (1,1,1)

# glTF importer converts back to Blender Z-up: height is along Z again.
zs = [v.z for v in vs]
zc = (min(zs)+max(zs))/2
print(f"IMPORT Z-height=[{min(zs):.2f},{max(zs):.2f}]")
def add_cam(name, loc):
    cd = bpy.data.cameras.new(name); cd.type='ORTHO'; cd.ortho_scale=2.4
    c = bpy.data.objects.new(name, cd); scene.collection.objects.link(c)
    c.location = loc
    d = mathutils.Vector((0,0,zc)) - mathutils.Vector(loc)
    c.rotation_euler = d.to_track_quat('-Z','Y').to_euler()
    return c
front = add_cam("front",(0,-6,zc)); side = add_cam("side",(6,0,zc))

def render(tag):
    for nm,c in (("front",front),("side",side)):
        scene.camera=c; scene.render.filepath=os.path.join(OUT,f"rig_{tag}_{nm}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDERED", tag)

# rest pose
render("rest")

# deform test: rotate arms up + legs apart + bend knees
def rot_bone(name, axis, deg):
    pb = arm.pose.bones.get(name)
    if not pb:
        print("missing bone", name); return
    pb.rotation_mode = 'XYZ'
    r = math.radians(deg)
    pb.rotation_euler = (r if axis=='X' else 0, r if axis=='Y' else 0, r if axis=='Z' else 0)

bpy.context.view_layer.objects.active = arm
rot_bone("LeftUpperArm",'Z', 70)
rot_bone("RightUpperArm",'Z', -70)
rot_bone("LeftLowerArm",'X', -50)
rot_bone("RightLowerArm",'X', -50)
rot_bone("LeftUpperLeg",'Z', 18)
rot_bone("RightUpperLeg",'Z', -18)
rot_bone("LeftLowerLeg",'X', 40)
bpy.context.view_layer.update()
render("posed")
print("VERIFY DONE")
