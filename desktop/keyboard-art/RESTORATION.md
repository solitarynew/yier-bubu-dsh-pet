# 原图人物提取记录

处理方式：内置 image_gen，背景提取 / 角色保留编辑，透明背景。

编辑目标：[Li-Jiangjiu/YierBubu](https://github.com/Li-Jiangjiu/YierBubu) 固定 `v0.4.0-beta.3` 公开包中的 `compact-scene.png`。原始包 SHA256 与本机下载逻辑见 `scripts/keyboard-artwork.mjs`。

成品：`characters-cutout.png`，1536 × 1024 RGBA；左列一二，右列布布。用于单只模式。双只模式直接使用上游原图，人物和同框位置均未重画。爪子沿用上游原图及 `compact-paws.png`，没有新画手臂。

目标是保留原图五官、配色、比例和侧向角度，去掉桌面、键盘、鼠标及背景，只修复原图中被遮挡的身体部分。原图与派生素材的角色权利不在代码 MIT 范围内，见 `ASSET-NOTICE.md`。

## 完整提示

```text
Use case: background-extraction / identity-preserve. Edit target: the attached ORIGINAL two-dimensional Yier and Bubu drawing. Create ONE transparent character cutout sprite sheet, 1536x1024, two equal columns. LEFT column: extract the exact white Yier bear with dark brown ears, original head tilt down-left, original oval dark eyes, tiny w mouth, pink cheeks, original little brown neck bow, short white torso. RIGHT column: extract the exact caramel Bubu bear with original round ears, head tilt down-left, oval dark eyes, tiny w mouth, pale yellow cheeks, short caramel torso. Keep the original visible character drawing, head proportions, face, ink outline, color and perspective as faithfully as a precise image extraction. Complete ONLY areas previously occluded by the other bear or desk in the input. No reinterpretation or redesign. Both bears end at the original chest/desk edge, with NO arms or paws attached: moving paws will be composited separately from the original. REMOVE keyboard, mouse, desk, background, glow and all other objects. Each bear centered in its own column, complete silhouette, similar head size, generous transparent margins, no overlap. Actual transparent alpha background. Absolutely preserve the original flat 2D cartoon style: no 3D, no fur texture, no rendered gloss, no photorealism, no long arms, no feet, no new accessories, no text. This is restoration and extraction of the supplied characters, NOT a new illustration.
```
