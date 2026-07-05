"""Mixamoリグ済みキャラ(T-pose, with skin)にアニメFBX群(without skin)をマージし、
全クリップ入りの単一GLBを出力する。

今後アニメを追加する手順:
  1. Mixamoで同キャラを選択した状態でアニメを "Without Skin" でダウンロード
  2. 下の CLIPS にファイル名とクリップ名を追加
  3. このスクリプトを再実行

使い方:
  blender -b --factory-startup -P scripts/build_exercise_avatar_glb.py -- \
      <master_tpose.fbx> <anim_dir> <out.glb> [render_prefix]

render_prefix を渡すと各クリップ中間フレームの検証レンダーも出力する。
"""
import bpy
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
MASTER_FBX, ANIM_DIR, OUT_GLB = argv[0], argv[1], argv[2]
RENDER_PREFIX = argv[3] if len(argv) > 3 else None

# クリップ名(GLB内のアニメ名) → アニメFBXファイル名
CLIPS = {
    "idle": "Dwarf Idle (1).fbx",
    "walk": "Walking (1).fbx",
    "run": "Standard Run (1).fbx",
    "squat": "Back Squat (1).fbx",
    "pushup": "Push Up (1).fbx",
    "situps": "Situps (1).fbx",
    "crunch": "Bicycle Crunch.fbx",
}

HIPS = "mixamorig:Hips"

bpy.ops.wm.read_factory_settings(use_empty=True)

# ── マスターキャラクター読み込み ────────────────────────────────────────────
bpy.ops.import_scene.fbx(filepath=MASTER_FBX)
master = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
master_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
print(f"[master] armature='{master.name}' meshes={len(master_meshes)} "
      f"bones={len(master.data.bones)}")
if master.animation_data:
    master.animation_data.action = None

master_objs = set(bpy.data.objects)
master_hips_z = master.data.bones[HIPS].head_local.z


def import_clip(clip_name, fbx_path):
    """アニメFBXを読み込み、Actionをマスターに移植してNLAトラックへスタッシュ。"""
    before_objs = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=fbx_path)
    new_objs = [o for o in bpy.data.objects if o not in before_objs]
    new_actions = [a for a in bpy.data.actions if a not in before_actions]
    src_arm = next(o for o in new_objs if o.type == 'ARMATURE')
    action = new_actions[0]
    action.name = clip_name
    action.use_fake_user = True

    # 体格差補正: Hipsのlocationキーをレスト時の腰高比でスケール
    # (回転はボーン名が同じならそのまま流用できるが、移動量は
    #  ダウンロード時に選択していたキャラの体格で焼かれているため)
    src_hips_z = src_arm.data.bones[HIPS].head_local.z
    ratio = master_hips_z / src_hips_z if src_hips_z else 1.0
    if not (0.5 < ratio < 2.0):
        # 座標系や体格が大きく異なるFBX(別キャラでDLした等)は補正が逆効果に
        # なるためスキップ。根本対応は同キャラで再ダウンロードすること。
        print(f"[clip:{clip_name}] hips ratio={ratio:.3f} が不正値のため補正スキップ")
    elif abs(ratio - 1.0) > 0.01:
        path = f'pose.bones["{HIPS}"].location'
        n = 0
        for fc in action.fcurves:
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    kp.co[1] *= ratio
                    kp.handle_left[1] *= ratio
                    kp.handle_right[1] *= ratio
                n += 1
        print(f"[clip:{clip_name}] hips scale ratio={ratio:.3f} ({n} fcurves)")
    else:
        print(f"[clip:{clip_name}] hips ratio={ratio:.3f} (補正なし)")

    # マスターのNLAへスタッシュ (glTFエクスポータはNLAトラック単位で
    # トラック名のアニメーションとして出力する)
    master.animation_data_create()
    track = master.animation_data.nla_tracks.new()
    track.name = clip_name
    track.strips.new(clip_name, int(action.frame_range[0]), action)
    track.mute = True

    # 取り込んだ一時オブジェクトを削除
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    f0, f1 = action.frame_range
    print(f"[clip:{clip_name}] frames {f0:.0f}-{f1:.0f}")
    return action


for clip_name, fname in CLIPS.items():
    path = os.path.join(ANIM_DIR, fname)
    if not os.path.exists(path):
        print(f"[warn] missing: {path} (skip)")
        continue
    import_clip(clip_name, path)

master.animation_data.action = None

# ── マテリアル除去(アプリ側でmatcapを当てる) ────────────────────────────────
for m in master_meshes:
    m.data.materials.clear()

# ── GLB出力 ──────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action='DESELECT')
master.select_set(True)
for m in master_meshes:
    m.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_yup=True,
    export_skins=True,
    export_materials='NONE',
)
print(f"[done] {OUT_GLB} ({os.path.getsize(OUT_GLB)/1024/1024:.2f} MB)")

# ── 検証レンダー: 各クリップの中間フレーム ──────────────────────────────────
if RENDER_PREFIX:
    import mathutils

    mat = bpy.data.materials.new('preview_mat')
    mat.diffuse_color = (0.75, 0.76, 0.78, 1.0)
    for m in master_meshes:
        m.data.materials.append(mat)

    sun = bpy.data.lights.new("s", 'SUN')
    so = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (0.9, 0.2, 0.6)

    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.render.resolution_x = 640
    sc.render.resolution_y = 900

    cam_data = bpy.data.cameras.new("c")
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam

    def bbox_center_size():
        pts = []
        for m in master_meshes:
            pts += [m.matrix_world @ mathutils.Vector(c) for c in m.bound_box]
        mins = mathutils.Vector((min(p[i] for p in pts) for i in range(3)))
        maxs = mathutils.Vector((max(p[i] for p in pts) for i in range(3)))
        return (mins + maxs) / 2, max(maxs[i] - mins[i] for i in range(3))

    center, size = bbox_center_size()

    def shoot(offset, name):
        cam.location = center + mathutils.Vector(offset)
        d = center - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f"{RENDER_PREFIX}_{name}.png"
        bpy.ops.render.render(write_still=True)
        print(f"RENDERED {sc.render.filepath}")

    for clip_name in CLIPS:
        action = bpy.data.actions.get(clip_name)
        if not action:
            continue
        master.animation_data.action = action
        f0, f1 = action.frame_range
        sc.frame_set(int(f0 + (f1 - f0) * 0.5))
        bpy.context.view_layer.update()
        shoot((size * 1.2, -size * 1.4, size * 0.3), f"{clip_name}_mid")
    master.animation_data.action = None
