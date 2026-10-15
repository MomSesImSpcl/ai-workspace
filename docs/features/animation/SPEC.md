# External animation, retargeting and cinematics

[Shared principles](../../PRINCIPLES.md) apply.

[Dependencies and related features](SUMMARY.md). Read affected contract sections when implementing.

## 11.3 Animation pipeline

- Allow animation authoring in specialized external applications, not only the runtime game engine. Unity remains final game runtime for Unity projects.
- Potential sources: recorded/licensed motion reference, AI-generated reference video, human video mocap, animation libraries, key-pose animation and direct authored motion.
- Optional tools include Blender, Cascadeur and **Unreal Engine as an animation DCC**: use Unreal's Control Rig, IK retargeting, Sequencer and editing tools, then bake supported skeletal motion and export an interoperable format such as FBX for Unity; do **not** assume Unreal Animation Blueprints, Control Rig graphs, motion-matching systems or Sequencer runtime logic automatically transfer.
- Treat use of Unreal animation tools as distinct from licensing of any third-party assets used inside Unreal; verify that each source asset and output can legally be exported and used in the target engine.
- Maintain a canonical skeleton/rig definition and animation naming/scale/axis rules. Validate root motion, foot contact, retargeting and exported clips in the actual Unity rig.
- For highly specific boss performances, use key poses, performance reference, mocap/AI assistance and manual or AI-assisted cleanup rather than assuming text-to-motion produces production-ready results.
- Animal/quadruped motion requires compatible pose-estimation/retargeting; don't assume human-centric mocap products support wolves or other creatures. Use appropriately licensed video assets and retain provenance.
- Support optional facial/lip-sync pipelines and blending body/face/hands where approved tools support it.

## 11.4 Cinematics

- Allow character animation authored externally while final cameras, gameplay links, VFX, audio, cutscene sequencing and performance validation happen in the actual target engine.
- User story: animated short transition between boss phases, with iteration on visual staging, weight, motion and facial performance. Deliver source clips, final exported animations, previews and known quality limitations.

**Product acceptance:** G12 in [acceptance scenarios](../../ACCEPTANCE.md).
