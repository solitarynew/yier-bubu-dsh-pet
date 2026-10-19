# 素材来源与效果比较

核对日期：2026-10-19。结论：以 YierPet 的表情帧序列作为主素材，运行框架使用原版 dsh-pet 0.3.7。

## 来源与比较

| 来源 | 取得方式与证据 | 实际观察 | 本项目选择 |
|---|---|---|---|
| [YierPet](https://github.com/xiaojieshi-bot/YierPet) | README 说经典图集由静态图经 ChatGPT 生成；表情版由 Live Photo 抠图、裁剪。仓库保留透明 PNG 帧与 meta.json。原始 Live Photo 的发布链接及拍摄/取得过程未提供，无法继续确认。 | 表情版更接近日常表情包，动作丰富；8 fps，部分提取边缘、残影与小标记仍可见。经典版与表情版的身形不同。 | 采用表情版；不混入经典版。 |
| [gbn666/codex-pets-bubuyier](https://github.com/gbn666/codex-pets-bubuyier) | 提供生成后的参考图、动作提示词、精灵图和 QA 文件；README 声明两只宠物已生成，未见能复现全部结果的生成执行日志。 | 身体更修长，偏像素，动作齐全；与常见表情包有风格差异。 | 用于对照，不导入。 |
| [skye-luo/yier-bubu-codex-pets](https://github.com/skye-luo/yier-bubu-codex-pets) | 提供动作图集、六帧工作行和重组脚本；脚本明确只重组已生成图片。没有找到完整的原始图像取得与生成过程。 | 轮廓清晰，工作姿势完善，当前一二/布布是 8 列 × 11 行 v2 图集，不能按旧 9 行尺寸均分。 | 用于对照，不导入。 |

比较依据：逐动作首/中/末帧、行走/互动等动作行，以及本地 WebM 动画回放。美观判断为本次主观选择，不是作者优劣排名。对比图见 review/atlas-comparison.jpg、review/*-sticker-review.jpg。

## dsh-pet 上游的素材路线

[上游 README](https://github.com/PC2005-cloud/dsh-pet#从零生成你自己的宠物完整流程) 说明：豆包按提示词生成约 10 秒的绿幕视频 → 抠像 → 人物位置/尺寸归一化 → 透明 VP9 WebM。作者另外明确，实际发布的全部动作采用 Premiere Pro 手工抠像；自动 HSV 脚本只是可复现的兜底方案。原始绿幕视频通过 Releases 压缩包提供。

## 本地转换

- 当前 meta.json：一二 24 组、布布 15 组、双人 11 组；README 双人 12 组与实际不符。
- 排除一二 s18_huabanche：自带道路场景，不适合作为透明桌宠。最终 23 + 15 + 11 = 49 组。
- 保留源序列的 8 fps，不插帧、不重新生成姿势。每组使用共同包围框，一组内使用同一缩放和位移，避免逐帧缩放导致抖动。
- 输出 640×360 RGBA/VP9-alpha，中心 x=320、脚底 y=330；主体适配 dsh-pet 的固定命中矩形。短动作重复原序列至约 4–8 秒，以降低随机动作切换频率。
- 每个源动作与输出 WebM 的映射、变换、帧数、循环次数和 SHA256 记录在 assets-manifest.json。
- 原表情的姿势/镜头尺度并不完全一致，本版没有宣称不同动作能无缝衔接。
- 双人同框是独立的 duo 实例，不是两只独立宠物靠近后自动合体。
- 漫游使用骑车、骑木马、玩具车等已有动作；未伪造原素材不存在的行走或悬空挣扎。

## 固定版本

- [YierPet](https://github.com/xiaojieshi-bot/YierPet)：`d7cfa5848c8f80701bec2ff8f8b6f451bc7f5236`
- [gbn](https://github.com/gbn666/codex-pets-bubuyier)：`cc9ef9ce97c86b25326d468170e61fc28249bb81`
- [skye](https://github.com/skye-luo/yier-bubu-codex-pets)：`2c924b2aa0345457cced778ee720d445f39a8be8`

框架：npm dsh-pet@0.3.7，package-lock.json 固定依赖；角色包走原生机制；右键控制与靠近互动通过版本锁定的桌面扩展补丁接入，原文件保存在运行时的 `.yier-originals` 中。宿主与物理计算沿用上游。

## 素材许可边界

保留 YierPet 的 README 与 MIT LICENSE。角色形象不因代码 MIT 许可而自动获得授权；本次没有找到一二布布权利人的素材再分发授权证据。本项目为非官方粉丝体验版。角色素材不包含在本项目代码 MIT 许可中，详见 ASSET-NOTICE.md；未查到权利人的再分发授权证据，不宣称可商用或可自由再分发。
