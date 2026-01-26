use serde::{Deserialize, Serialize};
use std::path::PathBuf;

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

/// Build ffmpeg arguments for export
pub fn build_ffmpeg_args(
    project: &Project,
    options: &ExportOptions,
    output_path: &PathBuf,
) -> Vec<String> {
    // Check if camera video exists
    let camera_path = project.camera_video_path.as_ref().and_then(|p| {
        let path = std::path::Path::new(p);
        if path.exists() { Some(p.clone()) } else { None }
    });
    
    let mut args = Vec::new();
    
    // Input file - screen recording
    args.push("-i".to_string());
    args.push(project.screen_video_path.clone());
    
    // Input file - camera recording (if exists)
    if let Some(ref cam_path) = camera_path {
        args.push("-i".to_string());
        args.push(cam_path.clone());
    }
    
    match options.format {
        ExportFormat::Mp4 => {
            // Build filter complex for camera overlay and edits
            if camera_path.is_some() {
                // Overlay camera in bottom-right corner (picture-in-picture)
                // Camera is scaled to 1/4 of screen width, positioned with 20px margin
                let overlay_filter = format!(
                    "[1:v]scale=iw/4:-1[cam];[0:v][cam]overlay=W-w-20:H-h-20"
                );
                
                // Combine with any edit filters
                let edit_filter = build_filter_complex(project, options);
                let full_filter = if edit_filter.is_empty() {
                    overlay_filter
                } else {
                    format!("{};{}", overlay_filter, edit_filter)
                };
                
                args.push("-filter_complex".to_string());
                args.push(full_filter);
            } else {
                // No camera, just apply edit filters if any
                let filter = build_filter_complex(project, options);
                if !filter.is_empty() {
                    args.push("-filter_complex".to_string());
                    args.push(filter);
                }
            }
            
            // Video codec
            args.push("-c:v".to_string());
            args.push("libx264".to_string());
            
            // CRF
            args.push("-crf".to_string());
            args.push(options.compression.crf().to_string());
            
            // Preset
            args.push("-preset".to_string());
            args.push(options.compression.preset().to_string());
            
            // Audio codec
            args.push("-c:a".to_string());
            args.push("aac".to_string());
            
            // Audio bitrate
            args.push("-b:a".to_string());
            args.push(format!("{}k", options.compression.audio_bitrate()));
            
            // Frame rate
            args.push("-r".to_string());
            args.push(options.frame_rate.to_string());
            
            // Resolution (only if no filter_complex with camera overlay)
            if camera_path.is_none() {
                args.push("-vf".to_string());
                args.push(format!("scale=-2:{}", options.resolution.height()));
            }
            
            // Pixel format for compatibility
            args.push("-pix_fmt".to_string());
            args.push("yuv420p".to_string());
        }
        ExportFormat::Gif => {
            // For GIF, camera overlay with palette generation
            if camera_path.is_some() {
                args.push("-filter_complex".to_string());
                args.push(format!(
                    "[1:v]scale=iw/4:-1[cam];[0:v][cam]overlay=W-w-20:H-h-20,fps={},scale=-1:{}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
                    options.frame_rate.min(30),
                    options.resolution.height().min(720)
                ));
            } else {
                // Generate palette for better quality
                args.push("-vf".to_string());
                args.push(format!(
                    "fps={},scale=-1:{}:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
                    options.frame_rate.min(30), // GIFs don't benefit from >30fps
                    options.resolution.height().min(720) // Cap GIF resolution
                ));
            }
        }
    }
    
    // Overwrite output
    args.push("-y".to_string());
    
    // Output file
    args.push(output_path.to_string_lossy().to_string());
    
    args
}

/// Build ffmpeg filter complex for applying edits
fn build_filter_complex(project: &Project, _options: &ExportOptions) -> String {
    let edits = &project.edits;
    let mut filters = Vec::new();
    
    // Handle cuts (segments)
    let enabled_segments: Vec<_> = edits.segments.iter()
        .filter(|s| s.enabled)
        .collect();
    
    if enabled_segments.len() > 1 {
        // Multiple segments need concat
        let mut segment_filters = Vec::new();
        for (i, seg) in enabled_segments.iter().enumerate() {
            segment_filters.push(format!(
                "[0:v]trim=start={}:end={},setpts=PTS-STARTPTS[v{}];[0:a]atrim=start={}:end={},asetpts=PTS-STARTPTS[a{}]",
                seg.start_time, seg.end_time, i,
                seg.start_time, seg.end_time, i
            ));
        }
        
        // Concat all segments
        let v_streams: String = (0..enabled_segments.len()).map(|i| format!("[v{}]", i)).collect();
        let a_streams: String = (0..enabled_segments.len()).map(|i| format!("[a{}]", i)).collect();
        segment_filters.push(format!(
            "{}{}concat=n={}:v=1:a=1[outv][outa]",
            v_streams, a_streams, enabled_segments.len()
        ));
        
        filters.push(segment_filters.join(";"));
    } else if enabled_segments.len() == 1 {
        let seg = enabled_segments[0];
        if seg.start_time > 0.0 || seg.end_time < project.duration {
            filters.push(format!(
                "[0:v]trim=start={}:end={},setpts=PTS-STARTPTS[outv];[0:a]atrim=start={}:end={},asetpts=PTS-STARTPTS[outa]",
                seg.start_time, seg.end_time,
                seg.start_time, seg.end_time
            ));
        }
    }
    
    // Handle zoom effects
    for zoom in &edits.zoom {
        // Zoom is implemented as crop + scale
        // The crop extracts a zoomed region, then scale restores resolution
        filters.push(format!(
            "crop=iw/{}:ih/{}:{}:{}",
            zoom.scale, zoom.scale, zoom.x, zoom.y
        ));
    }
    
    // Handle speed effects
    for speed in &edits.speed {
        if (speed.speed - 1.0).abs() > 0.01 {
            // Video speed
            filters.push(format!("setpts={}*PTS", 1.0 / speed.speed));
            // Audio speed
            filters.push(format!("atempo={}", speed.speed.clamp(0.5, 2.0)));
        }
    }
    
    filters.join(";")
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
    };
    
    let filename = format!(
        "{}_{}_{}.{}",
        project.name.replace(' ', "_"),
        chrono::Local::now().format("%Y%m%d_%H%M%S"),
        format!("{:?}", options.resolution).to_lowercase(),
        extension
    );
    
    downloads_dir.join(filename)
}
