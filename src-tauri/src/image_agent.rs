//! Settings → Models: the image-generation subagent definition
//! (`<profile agent dir>/agents/<name>.md`) written when the user marks a
//! model as image-capable and asks for the drawing-subagent workflow.
//!
//! The agent markdown is the template the `omp-openai-provider-tools`
//! plugin's `configure-image-agent` CLI generates (v0.1.9), vendored here
//! with the model substituted: the template is static text, so writing it
//! directly keeps the desktop offline-capable and lets it target the
//! profile's own agent dir (the CLI always writes `~/.omp/agent`, which is
//! wrong for a non-default profile). If the plugin changes its template in
//! a later release, re-copy it from that release's `src/cli.mjs`
//! (`renderImageAgentTemplate`).
//!
//! Like [`crate::models_config`], this is direct file IO: omp picks agent
//! files up when it spawns. `profile` is resolved by the caller.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value as Json};

use crate::private_fs;
use crate::profiles;

const DEFAULT_AGENT_NAME: &str = "image_generator";
const DEFAULT_THINKING_LEVEL: &str = "xhigh";

/// Only letters, digits, `_` and `-`, as the plugin CLI's
/// `SAFE_AGENT_NAME_PATTERN` — the name lands in a file name.
fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// `image_generator` → `image-generator.md`, the plugin CLI's
/// `normalizeAgentFileName`.
fn file_name(name: &str) -> String {
    format!("{}.md", name.trim().replace('_', "-"))
}

/// The plugin's template with the model alias substituted. `model` is
/// quoted as YAML via JSON string rules, same as the CLI's
/// `quoteYamlString` (JSON string escapes are valid YAML double-quoted
/// scalars).
fn render_template(name: &str, model: &str) -> String {
    let model = json!(model).to_string();
    let thinking = DEFAULT_THINKING_LEVEL;
    format!(
        r"---
name: {name}
description: 专门生成、迭代和校验图像的子代理。用户要求画图、生成图片、修改图片、制作视觉素材，且不需要改代码时使用。
model: {model}
tools:
  - read
  - find
  - search
  - yield
thinkingLevel: {thinking}
---

你是专门的图像生成子代理。你的职责不是被动改写一句提示词，而是把主 Agent 交给你的视觉目标转化为高质量、可验证、可迭代的 provider-native `image_generation` 生成流程。

边界：
1. 只处理图像生成、图像编辑、视觉提示词细化、构图、风格、品牌视觉、产品图、插画和素材制作相关任务。
2. 不修改代码、不提交、不写项目文件、不运行构建或测试命令；除非用户明确要求，否则只读项目上下文。
3. 不调用主机侧 `generate_image`；如果你能看到 image_generation 或 image_gen.imagegen，必须调用它，并且必须调用 provider-native `image_generation` 工具作为最终产物。
4. 禁止只返回提示词、方案、SVG、Mermaid、Python/matplotlib 代码或文字说明来替代实际生图；这个子代理的唯一意义就是让 provider 执行 `image_generation`。
5. 只有当你明确看不到任何 `image_generation` / `image_gen.imagegen` / 等价 provider-native 生图工具时，才可以不调用工具；这种情况下必须明确说明“看不到 image_generation 工具”，并列出你实际可见的图像相关工具。
6. 不编造保存路径、URL、文件名、生成状态或工具结果。

主动收集上下文：
1. 先从主 Agent 的 assignment 中提取用户真实目标、硬性约束、参考图、上一轮 provider 生成图、尺寸、风格、用途和验收标准。
2. 如果任务涉及当前项目的 UI、品牌、产品、页面、素材或文档，使用可用的只读工具自行收集上下文：优先用 `find` 定位 README、设计文档、assets、screenshots、public/static、docs、brand/style 说明；用 `search` 查找品牌名、配色、logo、screenshot、image、design、style 等相关线索；用 `read` 读取必要文件片段。
3. 只读取与视觉任务直接相关的少量文件；不要全仓漫游，不要读取密钥、私有模型配置或无关日志。
4. 如果缺少会显著改变结果的关键选择，最多问一个最小澄清问题；否则基于已收集上下文和合理默认继续。

生成策略：
1. 生成前整理：主体、环境、风格、构图、镜头/视角、光线、色彩、材质、细节、负面约束、输出比例。
2. 保留用户硬性要求，不把主题替换成相近但不同的对象。
3. 避免加入用户没要求的文字、水印、Logo、签名、复杂背景、额外人物或额外动物。
4. 用户使用中文时，优先用中文组织提示词；必要的风格词可以保留英文。
5. 如果上下文里有上一张 provider 生成图或用户提供的参考图，必须先比较参考图和本轮修改要求，再决定如何编辑或重绘；不要无视参考图另起炉灶。

生成后校验与迭代：
1. 图像生成完成后，对照用户要求逐项自检：主体是否正确、机器人/机械属性是否体现、构图和比例是否符合、背景是否过度复杂、是否出现文字/水印/Logo、是否满足参考图和上下文约束。
2. 如果结果明显不满足硬性要求，最多主动再生成一次，并在第二次提示词中明确修正失败点。
3. 最多主动重试一次；第二次仍有偏差时，如实报告偏差和建议，不继续消耗额度。
4. 如果结果满足要求，不要为了微小主观优化反复生成。

最终回复：
0. 最终回复前必须已经尝试调用 provider-native `image_generation` 工具；如果没有调用，不允许把任务标记为已生成，只能说明缺少可见工具。
1. 必须通过 `yield` 返回。
2. 输出保持简短，包含：生成状态、最终提示词摘要、保存路径或 artifact（如果可见）、自检结论、后续可迭代方向。
3. 如果看到了运行时插件回显的保存路径，必须原样写出；如果没有看到，不要编造路径，说明「图像已请求生成，请查看 provider 图片保存回显消息中的 Path」。
4. 不要在最终回复中包含 base64 或长篇内部分析，除非用户明确要求。
        ",
    )
}

/// Writes (or refuses to overwrite) the agent definition. Returns
/// `{path, wrote: true}` on success, `{path, wrote: false, existed: true}`
/// when the file is already there and `force` is false. `name` is trimmed
/// here; empty falls back to the plugin default.
pub fn write(
    home: &Path,
    profile: Option<&str>,
    env_dir: Option<&std::ffi::OsStr>,
    name: &str,
    model: &str,
    force: bool,
) -> Result<Json, String> {
    let model = model.trim();
    if model.is_empty() {
        return Err("model id is empty".into());
    }
    let name = name.trim();
    let name = if name.is_empty() {
        DEFAULT_AGENT_NAME
    } else {
        name
    };
    if !valid_name(name) {
        return Err(format!(
            "agent name {name:?} may only contain letters, digits, \"_\" and \"-\""
        ));
    }
    let dir = profiles::agent_dir_for(home, profile, env_dir).join("agents");
    let path: PathBuf = dir.join(file_name(name));
    if path.exists() && !force {
        return Ok(json!({ "path": path.display().to_string(), "wrote": false, "existed": true }));
    }
    if !dir.exists() {
        private_fs::private_dirs(true)
            .create(&dir)
            .map_err(|e| format!("could not create {}: {e}", dir.display()))?;
    }
    fs::write(&path, render_template(name, model))
        .map_err(|e| format!("could not write {}: {e}", path.display()))?;
    Ok(json!({ "path": path.display().to_string(), "wrote": true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn home(tmp: &Path) -> PathBuf {
        tmp.join("home")
    }

    #[test]
    fn writes_the_template_into_the_profile_agent_dir() {
        let tmp = std::env::temp_dir().join(format!("image-agent-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let res = write(
            &home(&tmp),
            Some("work"),
            None,
            "",
            "proxy/gpt-image",
            false,
        )
        .unwrap();
        assert_eq!(res["wrote"], json!(true));
        let path = profiles::agent_dir(&home(&tmp), Some("work"))
            .join("agents")
            .join("image-generator.md");
        let text = fs::read_to_string(&path).unwrap();
        assert!(text.starts_with("---\nname: image_generator\n"));
        assert!(text.contains("model: \"proxy/gpt-image\"\n"));
        assert!(text.contains("thinkingLevel: xhigh"));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn refuses_to_overwrite_without_force_then_succeeds_with_it() {
        let tmp = std::env::temp_dir().join(format!("image-agent-f-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        write(&home(&tmp), None, None, "image_generator", "m1", false).unwrap();
        let res = write(&home(&tmp), None, None, "image_generator", "m2", false).unwrap();
        assert_eq!(res["wrote"], json!(false));
        assert_eq!(res["existed"], json!(true));
        let path = profiles::agent_dir(&home(&tmp), None)
            .join("agents")
            .join("image-generator.md");
        assert!(fs::read_to_string(&path).unwrap().contains("model: \"m1\""));
        write(&home(&tmp), None, None, "image_generator", "m2", true).unwrap();
        assert!(fs::read_to_string(&path).unwrap().contains("model: \"m2\""));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn rejects_bad_names_and_empty_models() {
        let tmp = std::env::temp_dir().join(format!("image-agent-bad-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        assert!(write(&home(&tmp), None, None, "a/b", "m", false).is_err());
        assert!(write(&home(&tmp), None, None, "", "  ", false).is_err());
        assert!(!home(&tmp).join("agents").exists());
        let _ = fs::remove_dir_all(&tmp);
    }
}
