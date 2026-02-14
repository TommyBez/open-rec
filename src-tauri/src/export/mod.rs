use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::AppError;
use crate::project::Project;

/// Export options from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub format: ExportFormat,
    pub frame_rate: u32,
    pub compression: CompressionPreset,
    pub resolution: ResolutionPreset,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Mp4,
    Gif,
    Mov,
    Wav,
    Mp3,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CompressionPreset {
    Minimal,
    Social,
    Web,
    Potato,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ResolutionPreset {
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "4k")]
    P4K,
}

impl CompressionPreset {
    /// Get CRF value for H.264 encoding
    pub fn crf(&self) -> u32 {
        match self {
            CompressionPreset::Minimal => 18,
            CompressionPreset::Social => 23,
            CompressionPreset::Web => 28,
            CompressionPreset::Potato => 35,
        }
    }

    /// Get encoding preset (speed vs quality tradeoff)
    pub fn preset(&self) -> &'static str {
        match self {
            CompressionPreset::Minimal => "slow",
            CompressionPreset::Social => "medium",
            CompressionPreset::Web => "fast",
            CompressionPreset::Potato => "veryfast",
        }
    }

    /// Get audio bitrate in kbps
    pub fn audio_bitrate(&self) -> u32 {
        match self {
            CompressionPreset::Minimal => 320,
            CompressionPreset::Social => 192,
            CompressionPreset::Web => 128,
            CompressionPreset::Potato => 96,
        }
    }
}

impl ResolutionPreset {
    /// Get target height
    pub fn height(&self) -> u32 {
        match self {
            ResolutionPreset::P720 => 720,
            ResolutionPreset::P1080 => 1080,
            ResolutionPreset::P4K => 2160,
        }
    }
}

impl ResolutionPreset {
    fn label(&self) -> &'static str {
        match self {
            ResolutionPreset::P720 => "720p",
            ResolutionPreset::P1080 => "1080p",
            ResolutionPreset::P4K => "4k",
        }
    }
}

fn target_video_bitrate_kbps(options: &ExportOptions) -> u32 {
    let base = match options.resolution {
        ResolutionPreset::P720 => 5_000.0,
        ResolutionPreset::P1080 => 8_000.0,
        ResolutionPreset::P4K => 24_000.0,
    };
    let multiplier = match options.compression {
        CompressionPreset::Minimal => 1.6,
        CompressionPreset::Social => 1.0,
        CompressionPreset::Web => 0.72,
        CompressionPreset::Potato => 0.5,
    };

    (base * multiplier).round() as u32
}

#[derive(Debug, Clone)]
struct ActiveZoom {
    scale: f64,
    x: f64,
    y: f64,
}

#[derive(Debug, Clone)]
struct TimelinePiece {
    start: f64,
    end: f64,
    speed: f64,
    zoom: Option<ActiveZoom>,
}

fn has_audio_stream(path: &str) -> bool {
    let output = std::process::Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("a:0")
        .arg("-show_entries")
        .arg("stream=index")
        .arg("-of")
        .arg("csv=p=0")
        .arg(path)
        .output();

    match output {
        Ok(out) if out.status.success() => !String::from_utf8_lossy(&out.stdout).trim().is_empty(),
        _ => false,
    }
}

pub fn validate_export_inputs(project: &Project, options: &ExportOptions) -> Result<(), AppError> {
    let screen_path = std::path::Path::new(&project.screen_video_path);
    if !screen_path.exists() {
        return Err(AppError::Message(format!(
            "Screen recording file does not exist: {}",
            project.screen_video_path
        )));
    }

    if let Some(camera_path) = &project.camera_video_path {
        if !std::path::Path::new(camera_path).exists() {
            return Err(AppError::Message(format!(
                "Camera recording file does not exist: {}",
                camera_path
            )));
        }
    }

    if let Some(mic_path) = &project.microphone_audio_path {
        if !std::path::Path::new(mic_path).exists() {
            return Err(AppError::Message(format!(
                "Microphone recording file does not exist: {}",
                mic_path
            )));
        }
    }

    if project.edits.segments.iter().all(|s| !s.enabled) {
        return Err(AppError::Message(
            "No enabled timeline segments to export".to_string(),
        ));
    }

    if matches!(options.format, ExportFormat::Wav | ExportFormat::Mp3) {
        let has_screen_audio = has_audio_stream(&project.screen_video_path);
        let has_microphone_audio = project
            .microphone_audio_path
            .as_ref()
            .map(|mic_path| std::path::Path::new(mic_path).exists())
            .unwrap_or(false);
        if !has_screen_audio && !has_microphone_audio {
            return Err(AppError::Message(
                "Audio export requires at least one audio source (system or microphone)"
                    .to_string(),
            ));
        }
    }

    Ok(())
}

fn atempo_chain(speed: f64) -> Option<String> {
    if !speed.is_finite() || speed <= 0.0 || (speed - 1.0).abs() < 0.01 {
        return None;
    }

    let mut remaining = speed;
    let mut parts = Vec::new();

    while remaining > 2.0 {
        parts.push("atempo=2.0".to_string());
        remaining /= 2.0;
    }
    while remaining < 0.5 {
        parts.push("atempo=0.5".to_string());
        remaining /= 0.5;
    }

    parts.push(format!("atempo={:.5}", remaining));
    Some(parts.join(","))
}

fn enabled_segments(project: &Project) -> Vec<(f64, f64)> {
    let mut segments: Vec<(f64, f64)> = project
        .edits
        .segments
        .iter()
        .filter(|segment| segment.enabled)
        .map(|segment| (segment.start_time, segment.end_time))
        .collect();

    if segments.is_empty() {
        segments.push((0.0, project.duration));
    }

    segments.sort_by(|a, b| a.0.total_cmp(&b.0));
    segments
}

fn build_timeline_pieces(project: &Project) -> Vec<TimelinePiece> {
    let segments = enabled_segments(project);
    let mut pieces = Vec::new();

    for (seg_start, seg_end) in segments {
        if seg_end <= seg_start {
            continue;
        }

        let mut breakpoints = vec![seg_start, seg_end];
        for effect in &project.edits.speed {
            if effect.start_time > seg_start && effect.start_time < seg_end {
                breakpoints.push(effect.start_time);
            }
            if effect.end_time > seg_start && effect.end_time < seg_end {
                breakpoints.push(effect.end_time);
            }
        }
        for zoom in &project.edits.zoom {
            if zoom.start_time > seg_start && zoom.start_time < seg_end {
                breakpoints.push(zoom.start_time);
            }
            if zoom.end_time > seg_start && zoom.end_time < seg_end {
                breakpoints.push(zoom.end_time);
            }
        }

        breakpoints.sort_by(|a, b| a.total_cmp(b));
        breakpoints.dedup_by(|a, b| (*a - *b).abs() < f64::EPSILON);

        for pair in breakpoints.windows(2) {
            let start = pair[0];
            let end = pair[1];
            if end <= start {
                continue;
            }

            let speed = project
                .edits
                .speed
                .iter()
                .find(|effect| start >= effect.start_time && start < effect.end_time)
                .map(|effect| effect.speed)
                .unwrap_or(1.0);

            let zoom = project
                .edits
                .zoom
                .iter()
                .find(|effect| start >= effect.start_time && start < effect.end_time)
                .and_then(|effect| {
                    if effect.scale > 1.0 {
                        Some(ActiveZoom {
                            scale: effect.scale,
                            x: effect.x,
                            y: effect.y,
                        })
                    } else {
                        None
                    }
                });

            pieces.push(TimelinePiece {
                start,
                end,
                speed,
                zoom,
            });
        }
    }

    if pieces.is_empty() {
        pieces.push(TimelinePiece {
            start: 0.0,
            end: project.duration,
            speed: 1.0,
            zoom: None,
        });
    }

    pieces
}

fn timeline_is_edited(project: &Project, pieces: &[TimelinePiece]) -> bool {
    if pieces.len() != 1 {
        return true;
    }
    let piece = &pieces[0];
    piece.start > 0.001
        || (piece.end - project.duration).abs() > 0.001
        || (piece.speed - 1.0).abs() > 0.01
        || piece.zoom.is_some()
}

fn build_audio_timeline_filter(
    input_label: &str,
    pieces: &[TimelinePiece],
    prefix: &str,
) -> (Vec<String>, String) {
    if pieces.len() == 1 {
        let piece = &pieces[0];
        if piece.start <= 0.001 && (piece.speed - 1.0).abs() < 0.01 {
            return (Vec::new(), input_label.to_string());
        }
    }

    let mut filters = Vec::new();
    let mut labels = Vec::new();
    for (idx, piece) in pieces.iter().enumerate() {
        let label = format!("[{}{}]", prefix, idx);
        let mut filter = format!(
            "{}atrim=start={:.6}:end={:.6},asetpts=PTS-STARTPTS",
            input_label, piece.start, piece.end
        );
        if let Some(chain) = atempo_chain(piece.speed) {
            filter.push(',');
            filter.push_str(&chain);
        }
        filter.push_str(&label);
        filters.push(filter);
        labels.push(label);
    }

    if labels.len() == 1 {
        return (filters, labels[0].clone());
    }

    let output_label = format!("[{}out]", prefix);
    filters.push(format!(
        "{}concat=n={}:v=0:a=1{}",
        labels.join(""),
        labels.len(),
        output_label
    ));

    (filters, output_label)
}

fn apply_audio_offset(input_label: &str, offset_ms: i64, prefix: &str) -> (Vec<String>, String) {
    if offset_ms == 0 {
        return (Vec::new(), input_label.to_string());
    }

    let output_label = format!("[{}offset]", prefix);
    if offset_ms > 0 {
        (
            vec![format!(
                "{}adelay={}|{}{}",
                input_label, offset_ms, offset_ms, output_label
            )],
            output_label,
        )
    } else {
        let trim_start = (offset_ms.unsigned_abs() as f64) / 1000.0;
        (
            vec![format!(
                "{}atrim=start={:.6},asetpts=PTS-STARTPTS{}",
                input_label, trim_start, output_label
            )],
            output_label,
        )
    }
}

fn apply_audio_gain(
    filter_parts: &mut Vec<String>,
    input_label: String,
    volume: f64,
    output_label: &str,
) -> String {
    let gain = volume.clamp(0.0, 2.0);
    if (gain - 1.0).abs() < 0.01 {
        return input_label;
    }
    let output = format!("[{output_label}]");
    filter_parts.push(format!("{}volume={:.3}{}", input_label, gain, output));
    output
}

fn append_zoom_piece_filter(filter: &mut String, zoom: &ActiveZoom, width: u32, height: u32) {
    let scale = zoom.scale.max(1.01);
    let crop_width = format!("iw/{scale:.6}");
    let crop_height = format!("ih/{scale:.6}");
    let crop_x = format!("(iw-{crop_width})/2+{:.3}", zoom.x);
    let crop_y = format!("(ih-{crop_height})/2+{:.3}", zoom.y);
    filter.push_str(&format!(
        ",crop=w={crop_width}:h={crop_height}:x='{crop_x}':y='{crop_y}',scale={width}:{height}"
    ));
}

fn build_camera_overlay_coordinates(project: &Project) -> String {
    let margin = project.edits.camera_overlay.margin;
    match project.edits.camera_overlay.position {
        crate::project::CameraOverlayPosition::TopLeft => format!("{margin}:{margin}"),
        crate::project::CameraOverlayPosition::TopRight => format!("W-w-{margin}:{margin}"),
        crate::project::CameraOverlayPosition::BottomLeft => format!("{margin}:H-h-{margin}"),
        crate::project::CameraOverlayPosition::BottomRight => format!("W-w-{margin}:H-h-{margin}"),
        crate::project::CameraOverlayPosition::Custom => format!(
            "(W-w)*{:.6}:(H-h)*{:.6}",
            project.edits.camera_overlay.custom_x.clamp(0.0, 1.0),
            project.edits.camera_overlay.custom_y.clamp(0.0, 1.0)
        ),
    }
}

fn escape_drawtext_text(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace(',', "\\,")
        .replace('%', "\\%")
        .replace('\n', "\\n")
}

fn apply_video_annotations(
    filter_parts: &mut Vec<String>,
    mut current_video_label: String,
    project: &Project,
) -> String {
    for (index, annotation) in project.edits.annotations.iter().enumerate() {
        let start_time = annotation.start_time.max(0.0);
        let end_time = annotation.end_time.min(project.duration);
        if end_time - start_time <= 0.01 {
            continue;
        }

        let x = annotation.x.clamp(0.0, 1.0);
        let y = annotation.y.clamp(0.0, 1.0);
        let width = annotation.width.clamp(0.02, 1.0);
        let height = annotation.height.clamp(0.02, 1.0);
        let opacity = annotation.opacity.clamp(0.1, 1.0);
        let thickness = annotation.thickness.max(1);
        let color = annotation
            .color
            .chars()
            .filter(|character| !character.is_whitespace())
            .collect::<String>();

        let next_label = format!("[vannot{}]", index);
        filter_parts.push(format!(
            "{}drawbox=x=iw*{:.6}:y=ih*{:.6}:w=iw*{:.6}:h=ih*{:.6}:color={}@{:.3}:t={}:enable='between(t,{:.6},{:.6})'{}",
            current_video_label,
            x,
            y,
            width,
            height,
            color,
            opacity,
            thickness,
            start_time,
            end_time,
            next_label
        ));
        current_video_label = next_label;

        if let Some(text) = annotation.text.as_ref().map(|value| value.trim()) {
            if !text.is_empty() {
                let text_label = format!("[vannottxt{}]", index);
                let escaped_text = escape_drawtext_text(text);
                filter_parts.push(format!(
                    "{}drawtext=text='{}':x=iw*{:.6}+10:y=ih*{:.6}+10:fontsize=28:fontcolor=white@{:.3}:box=1:boxcolor=black@0.35:enable='between(t,{:.6},{:.6})'{}",
                    current_video_label,
                    escaped_text,
                    x,
                    y,
                    opacity,
                    start_time,
                    end_time,
                    text_label
                ));
                current_video_label = text_label;
            }
        }
    }

    current_video_label
}

fn build_annotation_drawbox_chain(project: &Project) -> String {
    project
        .edits
        .annotations
        .iter()
        .filter_map(|annotation| {
            let start_time = annotation.start_time.max(0.0);
            let end_time = annotation.end_time.min(project.duration);
            if end_time - start_time <= 0.01 {
                return None;
            }

            let x = annotation.x.clamp(0.0, 1.0);
            let y = annotation.y.clamp(0.0, 1.0);
            let width = annotation.width.clamp(0.02, 1.0);
            let height = annotation.height.clamp(0.02, 1.0);
            let opacity = annotation.opacity.clamp(0.1, 1.0);
            let thickness = annotation.thickness.max(1);
            let color = annotation
                .color
                .chars()
                .filter(|character| !character.is_whitespace())
                .collect::<String>();

            Some(format!(
                ",drawbox=x=iw*{:.6}:y=ih*{:.6}:w=iw*{:.6}:h=ih*{:.6}:color={}@{:.3}:t={}:enable='between(t,{:.6},{:.6})'",
                x, y, width, height, color, opacity, thickness, start_time, end_time
            ))
            .map(|mut chain| {
                if let Some(text) = annotation.text.as_ref().map(|value| value.trim()) {
                    if !text.is_empty() {
                        let escaped_text = escape_drawtext_text(text);
                        chain.push_str(&format!(
                            ",drawtext=text='{}':x=iw*{:.6}+8:y=ih*{:.6}+8:fontsize=20:fontcolor=white@{:.3}:box=1:boxcolor=black@0.35:enable='between(t,{:.6},{:.6})'",
                            escaped_text, x, y, opacity, start_time, end_time
                        ));
                    }
                }
                chain
            })
        })
        .collect::<Vec<_>>()
        .join("")
}

/// Build ffmpeg arguments for export
pub fn build_ffmpeg_args(
    project: &Project,
    options: &ExportOptions,
    output_path: &PathBuf,
) -> Vec<String> {
    let _ = validate_export_inputs(project, options);

    let camera_path = project.camera_video_path.as_ref().cloned();
    let microphone_path = project.microphone_audio_path.as_ref().cloned();
    let screen_has_audio = has_audio_stream(&project.screen_video_path);
    let timeline_pieces = build_timeline_pieces(project);
    let timeline_edited = timeline_is_edited(project, &timeline_pieces);

    let mut args = Vec::new();

    let enabled_segments = enabled_segments(project);
    let only_single_segment = enabled_segments.len() == 1;
    let use_input_seeking = camera_path.is_none()
        && microphone_path.is_none()
        && only_single_segment
        && (enabled_segments[0].0 > 0.0 || enabled_segments[0].1 < project.duration)
        && !timeline_edited
        && project.edits.zoom.is_empty();

    if use_input_seeking {
        let seg = &enabled_segments[0];
        args.push("-ss".to_string());
        args.push(format!("{}", seg.0));
        args.push("-to".to_string());
        args.push(format!("{}", seg.1));
    }

    // Input file - screen recording
    args.push("-i".to_string());
    args.push(project.screen_video_path.clone());

    // Input file - camera recording (if exists)
    if let Some(ref cam_path) = camera_path {
        args.push("-i".to_string());
        args.push(cam_path.clone());
    }
    let mic_index = if let Some(ref mic_path) = microphone_path {
        args.push("-i".to_string());
        args.push(mic_path.clone());
        Some(if camera_path.is_some() { 2 } else { 1 })
    } else {
        None
    };

    match options.format {
        ExportFormat::Mp4 | ExportFormat::Mov => {
            let mut filter_parts: Vec<String> = Vec::new();
            let mut current_video_label = "[0:v]".to_string();

            if !use_input_seeking {
                let mut video_piece_labels = Vec::new();
                if timeline_edited {
                    let output_width = project.resolution.width;
                    let output_height = project.resolution.height;
                    for (idx, piece) in timeline_pieces.iter().enumerate() {
                        let label = format!("[vpiece{}]", idx);
                        let mut piece_filter = format!(
                            "[0:v]trim=start={:.6}:end={:.6},setpts=(PTS-STARTPTS)/{:.6}",
                            piece.start, piece.end, piece.speed
                        );
                        if let Some(zoom) = &piece.zoom {
                            append_zoom_piece_filter(
                                &mut piece_filter,
                                zoom,
                                output_width,
                                output_height,
                            );
                        }
                        piece_filter.push_str(&label);
                        filter_parts.push(piece_filter);
                        video_piece_labels.push(label);
                    }

                    if video_piece_labels.len() == 1 {
                        current_video_label = video_piece_labels[0].clone();
                    } else {
                        let concat_label = "[vconcat]".to_string();
                        filter_parts.push(format!(
                            "{}concat=n={}:v=1:a=0{}",
                            video_piece_labels.join(""),
                            video_piece_labels.len(),
                            concat_label
                        ));
                        current_video_label = concat_label;
                    }
                }
            }

            if camera_path.is_some() {
                let camera_offset = project.camera_offset_ms.unwrap_or(0);
                let camera_input = "[1:v]";
                let camera_label = "[cam]";
                let camera_scale = project.edits.camera_overlay.scale.max(0.1);
                let camera_scale_filter = format!("scale=iw*{camera_scale}:ih*{camera_scale}");

                if camera_offset > 0 {
                    filter_parts.push(format!(
                        "{}setpts=PTS+{:.6}/TB,{}{}",
                        camera_input,
                        camera_offset as f64 / 1000.0,
                        camera_scale_filter,
                        camera_label
                    ));
                } else if camera_offset < 0 {
                    filter_parts.push(format!(
                        "{}trim=start={:.6},setpts=PTS-STARTPTS,{}{}",
                        camera_input,
                        camera_offset.unsigned_abs() as f64 / 1000.0,
                        camera_scale_filter,
                        camera_label
                    ));
                } else {
                    filter_parts.push(format!(
                        "{}{}{}",
                        camera_input, camera_scale_filter, camera_label
                    ));
                }

                let overlay_coordinates = build_camera_overlay_coordinates(project);
                filter_parts.push(format!(
                    "{}{}overlay={}[vwithcam]",
                    current_video_label, camera_label, overlay_coordinates
                ));
                current_video_label = "[vwithcam]".to_string();
            }

            current_video_label =
                apply_video_annotations(&mut filter_parts, current_video_label, project);

            let screen_audio_label = if screen_has_audio {
                let (audio_filters, audio_label) =
                    build_audio_timeline_filter("[0:a]", &timeline_pieces, "ascreen");
                filter_parts.extend(audio_filters);
                Some(audio_label)
            } else {
                None
            };
            let screen_audio_label = screen_audio_label.map(|label| {
                apply_audio_gain(
                    &mut filter_parts,
                    label,
                    project.edits.audio_mix.system_volume,
                    "ascreenvol",
                )
            });

            let microphone_audio_label = if let Some(idx) = mic_index {
                let input_label = format!("[{}:a]", idx);
                let (offset_filters, offset_label) = apply_audio_offset(
                    &input_label,
                    project.microphone_offset_ms.unwrap_or(0),
                    "amic",
                );
                filter_parts.extend(offset_filters);
                let (mic_filters, mic_label) =
                    build_audio_timeline_filter(&offset_label, &timeline_pieces, "amicpiece");
                filter_parts.extend(mic_filters);
                Some(mic_label)
            } else {
                None
            };

            let microphone_processed_label = microphone_audio_label.map(|label| {
                let cleaned_label = "[amicclean]".to_string();
                filter_parts.push(format!("{}highpass=f=80{}", label, cleaned_label));
                apply_audio_gain(
                    &mut filter_parts,
                    cleaned_label,
                    project.edits.audio_mix.microphone_volume,
                    "amicvol",
                )
            });

            let audio_output_label = match (screen_audio_label, microphone_processed_label) {
                (Some(screen_label), Some(microphone_label)) => {
                    let ducked_label = "[aducked]".to_string();
                    let mixed_label = "[aout]".to_string();
                    filter_parts.push(format!(
                        "{}{}sidechaincompress=threshold=0.025:ratio=8:attack=20:release=300{}",
                        &screen_label, &microphone_label, ducked_label
                    ));
                    filter_parts.push(format!(
                        "{}{}amix=inputs=2:duration=longest:dropout_transition=0{}",
                        ducked_label, &microphone_label, mixed_label
                    ));
                    Some(mixed_label)
                }
                (Some(screen_label), None) => Some(screen_label),
                (None, Some(microphone_label)) => Some(microphone_label),
                (None, None) => None,
            };

            let final_video_label = if filter_parts.is_empty() {
                None
            } else {
                filter_parts.push(format!(
                    "{}scale=-2:{}[vout]",
                    current_video_label,
                    options.resolution.height()
                ));
                Some("[vout]".to_string())
            };

            // Video codec
            args.push("-c:v".to_string());
            if matches!(options.format, ExportFormat::Mov) {
                args.push("prores_ks".to_string());
                args.push("-profile:v".to_string());
                args.push("3".to_string());
                args.push("-pix_fmt".to_string());
                args.push("yuv422p10le".to_string());
            } else {
                if cfg!(target_os = "macos") {
                    args.push("h264_videotoolbox".to_string());
                    args.push("-b:v".to_string());
                    args.push(format!("{}k", target_video_bitrate_kbps(options)));
                    args.push("-allow_sw".to_string());
                    args.push("1".to_string());
                } else {
                    args.push("libx264".to_string());
                    args.push("-crf".to_string());
                    args.push(options.compression.crf().to_string());
                    args.push("-preset".to_string());
                    args.push(options.compression.preset().to_string());
                }
                args.push("-pix_fmt".to_string());
                args.push("yuv420p".to_string());
            }

            // Audio codec
            args.push("-c:a".to_string());
            if matches!(options.format, ExportFormat::Mov) {
                args.push("pcm_s16le".to_string());
            } else {
                args.push("aac".to_string());
                args.push("-b:a".to_string());
                args.push(format!("{}k", options.compression.audio_bitrate()));
            }

            // Frame rate
            args.push("-r".to_string());
            args.push(options.frame_rate.to_string());

            if let Some(video_map_label) = final_video_label {
                args.push("-filter_complex".to_string());
                args.push(filter_parts.join(";"));
                args.push("-map".to_string());
                args.push(video_map_label);
            } else {
                args.push("-vf".to_string());
                args.push(format!("scale=-2:{}", options.resolution.height()));
                args.push("-map".to_string());
                args.push("0:v".to_string());
            }

            if let Some(audio_label) = audio_output_label {
                if !filter_parts.is_empty() {
                    args.push("-map".to_string());
                    if audio_label == "[0:a]" {
                        args.push("0:a?".to_string());
                    } else if audio_label.starts_with('[')
                        && audio_label.ends_with(":a]")
                        && audio_label.len() >= 5
                    {
                        let stream = audio_label.trim_start_matches('[').trim_end_matches(']');
                        args.push(stream.to_string());
                    } else {
                        args.push(audio_label);
                    }
                } else if audio_label == "[0:a]" {
                    args.push("-map".to_string());
                    args.push("0:a?".to_string());
                } else if audio_label.starts_with('[')
                    && audio_label.ends_with(":a]")
                    && audio_label.len() >= 5
                {
                    let stream = audio_label.trim_start_matches('[').trim_end_matches(']');
                    args.push("-map".to_string());
                    args.push(stream.to_string());
                }
            } else if !filter_parts.is_empty() {
                args.push("-an".to_string());
            } else if screen_has_audio {
                args.push("-map".to_string());
                args.push("0:a?".to_string());
            }
        }
        ExportFormat::Gif => {
            let annotation_chain = build_annotation_drawbox_chain(project);
            if camera_path.is_some() {
                let camera_scale = project.edits.camera_overlay.scale.max(0.1);
                let overlay_coordinates = build_camera_overlay_coordinates(project);
                args.push("-filter_complex".to_string());
                args.push(format!(
                    "[1:v]scale=iw*{camera_scale}:ih*{camera_scale}[cam];[0:v][cam]overlay={overlay_coordinates}{annotation_chain},fps={},scale=-1:{}:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
                    options.frame_rate.min(30),
                    options.resolution.height().min(720)
                ));
            } else {
                let annotation_prefix = annotation_chain
                    .strip_prefix(',')
                    .unwrap_or(&annotation_chain);
                args.push("-vf".to_string());
                args.push(format!(
                    "{}fps={},scale=-1:{}:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle",
                    if annotation_prefix.is_empty() {
                        String::new()
                    } else {
                        format!("{annotation_prefix},")
                    },
                    options.frame_rate.min(30),
                    options.resolution.height().min(720)
                ));
            }
        }
        ExportFormat::Wav | ExportFormat::Mp3 => {
            let mut filter_parts: Vec<String> = Vec::new();

            let screen_audio_label = if screen_has_audio {
                let (audio_filters, audio_label) =
                    build_audio_timeline_filter("[0:a]", &timeline_pieces, "ascreen");
                filter_parts.extend(audio_filters);
                Some(audio_label)
            } else {
                None
            };
            let screen_audio_label = screen_audio_label.map(|label| {
                apply_audio_gain(
                    &mut filter_parts,
                    label,
                    project.edits.audio_mix.system_volume,
                    "ascreenvol",
                )
            });

            let microphone_audio_label = if let Some(idx) = mic_index {
                let input_label = format!("[{}:a]", idx);
                let (offset_filters, offset_label) = apply_audio_offset(
                    &input_label,
                    project.microphone_offset_ms.unwrap_or(0),
                    "amic",
                );
                filter_parts.extend(offset_filters);
                let (mic_filters, mic_label) =
                    build_audio_timeline_filter(&offset_label, &timeline_pieces, "amicpiece");
                filter_parts.extend(mic_filters);
                Some(mic_label)
            } else {
                None
            };

            let microphone_processed_label = microphone_audio_label.map(|label| {
                let cleaned_label = "[amicclean]".to_string();
                filter_parts.push(format!("{}highpass=f=80{}", label, cleaned_label));
                apply_audio_gain(
                    &mut filter_parts,
                    cleaned_label,
                    project.edits.audio_mix.microphone_volume,
                    "amicvol",
                )
            });

            let audio_output_label = match (screen_audio_label, microphone_processed_label) {
                (Some(screen_label), Some(microphone_label)) => {
                    let ducked_label = "[aducked]".to_string();
                    let mixed_label = "[aout]".to_string();
                    filter_parts.push(format!(
                        "{}{}sidechaincompress=threshold=0.025:ratio=8:attack=20:release=300{}",
                        &screen_label, &microphone_label, ducked_label
                    ));
                    filter_parts.push(format!(
                        "{}{}amix=inputs=2:duration=longest:dropout_transition=0{}",
                        ducked_label, &microphone_label, mixed_label
                    ));
                    Some(mixed_label)
                }
                (Some(screen_label), None) => Some(screen_label),
                (None, Some(microphone_label)) => Some(microphone_label),
                (None, None) => None,
            };

            args.push("-vn".to_string());
            match options.format {
                ExportFormat::Wav => {
                    args.push("-c:a".to_string());
                    args.push("pcm_s16le".to_string());
                }
                ExportFormat::Mp3 => {
                    args.push("-c:a".to_string());
                    args.push("libmp3lame".to_string());
                    args.push("-b:a".to_string());
                    args.push(format!("{}k", options.compression.audio_bitrate()));
                }
                _ => {}
            }

            if let Some(audio_label) = audio_output_label {
                if !filter_parts.is_empty() {
                    args.push("-filter_complex".to_string());
                    args.push(filter_parts.join(";"));
                    args.push("-map".to_string());
                    if audio_label == "[0:a]" {
                        args.push("0:a?".to_string());
                    } else if audio_label.starts_with('[')
                        && audio_label.ends_with(":a]")
                        && audio_label.len() >= 5
                    {
                        let stream = audio_label.trim_start_matches('[').trim_end_matches(']');
                        args.push(stream.to_string());
                    } else {
                        args.push(audio_label);
                    }
                } else if audio_label == "[0:a]" {
                    args.push("-map".to_string());
                    args.push("0:a?".to_string());
                } else if audio_label.starts_with('[')
                    && audio_label.ends_with(":a]")
                    && audio_label.len() >= 5
                {
                    let stream = audio_label.trim_start_matches('[').trim_end_matches(']');
                    args.push("-map".to_string());
                    args.push(stream.to_string());
                }
            }
        }
    }

    args.push("-y".to_string());
    args.push(output_path.to_string_lossy().to_string());

    args
}

/// Get default export output path
pub fn get_export_output_path(
    project: &Project,
    options: &ExportOptions,
    downloads_dir: &PathBuf,
) -> PathBuf {
    let extension = match options.format {
        ExportFormat::Mp4 => "mp4",
        ExportFormat::Gif => "gif",
        ExportFormat::Mov => "mov",
        ExportFormat::Wav => "wav",
        ExportFormat::Mp3 => "mp3",
    };

    let resolution_label = if matches!(options.format, ExportFormat::Mp3 | ExportFormat::Wav) {
        "audio".to_string()
    } else {
        options.resolution.label().to_string()
    };

    let sanitized_project_name = project
        .name
        .chars()
        .map(|character| {
            if matches!(
                character,
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
            ) {
                '_'
            } else {
                character
            }
        })
        .collect::<String>()
        .replace(' ', "_");

    let filename = format!(
        "{}_{}_{}.{}",
        sanitized_project_name,
        chrono::Local::now().format("%Y%m%d_%H%M%S"),
        resolution_label,
        extension
    );

    downloads_dir.join(filename)
}
