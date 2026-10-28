# 角色素材与第三方声明

这是非官方粉丝项目，与角色作者、权利人及 DeepSeek 均无合作或授权关系声明。

## 桌宠框架

使用 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 的原生角色包和动作 API，npm 依赖固定为 0.3.7。本项目为该固定版本增加了桌面右键菜单和靠近互动扩展，保留原版物理与宿主逻辑。框架和随框架依赖取得的资源适用上游各自的许可；本项目不对其重新授权。

## 一二、布布素材

- 本仓库的转换后 WebM 和预览图片来自 [xiaojieshi-bot/YierPet](https://github.com/xiaojieshi-bot/YierPet) 的 `Assets/Packs/`，固定源 commit 见 sources.json。
- 上游 README 将角色形象归于黄小B，并说明表情帧由 Live Photo 抠图裁剪而来；没有提供原始 Live Photo 的公开来源或角色权利人的再分发授权证明。
- 保留上游仓库的 MIT LICENSE 原文于 `third_party/YierPet/LICENSE`，这不表示角色形象权利自动属于代码 MIT 范围。
- 本仓库自己的 MIT 代码许可不覆盖一二/布布的名称、角色形象、动画、帧图和预览素材。本项目不授予额外角色使用权，不宣称这些素材可商用或可自由再分发。
- 如果你是相关素材的权利人，请通过仓库 Issue 联系，提供对应文件与权利依据，以便及时处理。

## 来源与变换记录

双只键盘模式直接使用 [Li-Jiangjiu/YierBubu](https://github.com/Li-Jiangjiu/YierBubu) 的二维原始同框图层；上游代码 MIT 许可原文保留于 `third_party/Li-Jiangjiu-YierBubu/LICENSE`。静止爪子的剪影坐标移植自上游 `windows/YierBubu.Windows/SceneRenderer.cs`，保留原始人物与姿势。本项目实现 Win32 键位状态流、32 键投影和桌宠模式接入。

三张上游原始 PNG 不收录于本源码仓库。Windows 首次安装时从 [v0.4.0-beta.3 的公开 Mac 包](https://github.com/Li-Jiangjiu/YierBubu/releases/download/v0.4.0-beta.3/YierBubu-macOS-Universal-v0.4.0-beta.3.zip) 提取，仅用于本机运行缓存；不会执行其中的应用。固定包 SHA256 为 `e4aa6030330ec0fdbb31bd63d6739793f1086cacf82b4eea1e4187ed8ddaed6b`，来源、文件名及校验在 `scripts/keyboard-artwork.mjs` 中固定。

单只模式的 `desktop/keyboard-art/characters-cutout.png` 是内置 imagegen 以同一原图为编辑目标，做透明背景提取和被遮挡部位修复得到的派生素材。处理记录与完整提示见同目录 `RESTORATION.md`。原始 alpha 保留，运行时用 SVG alpha 映射消除半透明光晕；没有栅格重绘代码。这份派生素材及其角色权利同样不包含在代码 MIT 许可内。

上游 [第三方声明](https://github.com/Li-Jiangjiu/YierBubu/blob/main/THIRD_PARTY_NOTICES.md) 明确：角色及 PNG 权利不在代码 MIT 许可内，公开分发授权尚未确认。下载校验与本机引用不授予额外素材使用或再分发权；本项目不将这些素材重新授权。

SOURCE_REVIEW.md 记录选材理由、原始来源的证据边界与已知缺陷；assets-manifest.json 记录源动作 ID、转换参数和成品 SHA256。没有将上游残留小标记处理成自己的署名。
