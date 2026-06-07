import bpy, math, os, mathutils

GLB = r"C:\Users\sakyo\FitMealTracker (Web)\public\models\fitness_avatar_complete.glb"
OUT = r"C:\Users\sakyo\FitMealTracker (Web)\scripts\_render"
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
bpy.ops.import_scene.gltf(filepath=GLB)
arm = next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type=='MESH')
zs=[ (mesh.matrix_world@v.co).z for v in mesh.data.vertices]; zc=(min(zs)+max(zs))/2

# print world-space rest axes of key bones
print("=== BONE WORLD AXES (rest) ===")
for nm in ["LeftUpperArm","LeftLowerArm","LeftUpperLeg","LeftLowerLeg","Spine","Chest"]:
    b = arm.data.bones[nm]
    M = (arm.matrix_world @ b.matrix_local).to_3x3()
    ax = lambda i: tuple(round(c,2) for c in M.col[i])
    print(f"  {nm}: localX_world={ax(0)} localY_world={ax(1)} localZ_world={ax(2)}")

scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'; scene.render.resolution_x=360; scene.render.resolution_y=560
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='SINGLE'; scene.display.shading.single_color=(0.5,0.6,0.8)
if scene.world is None: scene.world=bpy.data.worlds.new("W")
scene.world.use_nodes=False; scene.world.color=(1,1,1)

def cam(loc):
    cd=bpy.data.cameras.new("c"); cd.type='ORTHO'; cd.ortho_scale=2.4
    c=bpy.data.objects.new("c",cd); scene.collection.objects.link(c); c.location=loc
    d=mathutils.Vector((0,0,zc))-mathutils.Vector(loc); c.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
    return c
front=cam((0,-6,zc)); side=cam((6,0,zc))

def reset():
    for pb in arm.pose.bones:
        pb.rotation_mode='XYZ'; pb.rotation_euler=(0,0,0); pb.location=(0,0,0)

def setrot(name, ax, deg):
    pb=arm.pose.bones[name]; pb.rotation_mode='XYZ'
    e=[0,0,0]; e[{'X':0,'Y':1,'Z':2}[ax]]=math.radians(deg); pb.rotation_euler=e

def render(tag, c):
    scene.camera=c; scene.render.filepath=os.path.join(OUT,f"probe_{tag}.png"); bpy.ops.render.render(write_still=True); print("R",tag)

bpy.context.view_layer.objects.active=arm
# 1 arm local X
reset(); setrot("LeftUpperArm",'X',50); setrot("RightUpperArm",'X',50); bpy.context.view_layer.update(); render("armX_side",side)
# 2 arm local Z
reset(); setrot("LeftUpperArm",'Z',50); setrot("RightUpperArm",'Z',-50); bpy.context.view_layer.update(); render("armZ_front",front)
# 3 leg local X
reset(); setrot("LeftUpperLeg",'X',50); setrot("RightUpperLeg",'X',50); bpy.context.view_layer.update(); render("legX_side",side)
# 4 leg local Z
reset(); setrot("LeftUpperLeg",'Z',30); setrot("RightUpperLeg",'Z',-30); bpy.context.view_layer.update(); render("legZ_front",front)
print("PROBE DONE")
