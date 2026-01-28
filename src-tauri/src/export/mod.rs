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
    
    // Check for single segment case - use input seeking instead of filter_complex
    // This handles files with or without audio gracefully
    // BUT: if there are zoom or speed effects, we need filter_complex
    let enabled_segments: Vec<_> = project.edits.segments.iter()
        .filter(|s| s.enabled)
        .collect();
    
    let has_effects = !project.edits.zoom.is_empty() || !project.edits.speed.is_empty();
    
    let use_input_seeking = camera_path.is_none() 
        && enabled_segments.len() == 1 
        && (enabled_segments[0].start_time > 0.0 || enabled_segments[0].end_time < project.duration)
        && !has_effects; // Don't use input seeking if we have effects to apply
    
    if use_input_seeking {
        // Use -ss and -to for seeking (more efficient and handles missing audio)
        let seg = &enabled_segments[0];
        args.push("-ss".to_string());
        args.push(format!("{}", seg.start_time));
        args.push("-to".to_string());
        args.push(format!("{}", seg.end_time));
    }
    
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
            // Build filter complex for camera overlay and edits (multi-segment only now)
            let mut has_filter_complex = false;
            
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
                has_filter_complex = true;
            } else if !use_input_seeking {
                // No camera and not using input seeking - apply edit filters
                let filter = build_filter_complex(project, options);
                if !filter.is_empty() {
                    // Check if we have multi-segment concat (which uses trim and requires video-only output)
                    let has_multi_segment = enabled_segments.len() > 1;
                    
                    // Add scaling to the filter chain before final output
                    let filter_with_scale = format!(
                        "{};[outv]scale=-2:{}[vout]",
                        filter,
                        options.resolution.height()
                    );
                    args.push("-filter_complex".to_string());
                    args.push(filter_with_scale);
                    
                    // Map video output
                    args.push("-map".to_string());
                    args.push("[vout]".to_string());
                    
                    if has_multi_segment {
                        // Multi-segment concat doesn't handle audio, strip it
                        args.push("-an".to_string());
                    } else {
                        // Single segment with effects - try to preserve audio from input
                        args.push("-map".to_string());
                        args.push("0:a?".to_string()); // ? means optional (won't fail if no audio)
                    }
                    
                    has_filter_complex = true;
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
            
            // Resolution - only use -vf if no filter_complex was used
            if !has_filter_complex {
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
fn build_filter_complex(project: &Project, options: &ExportOptions) -> String {
    let edits = &project.edits;
    let width = project.resolution.width;
    let height = project.resolution.height;
    
    // Handle cuts (segments)
    let enabled_segments: Vec<_> = edits.segments.iter()
        .filter(|s| s.enabled)
        .collect();
    
    // Determine the video input label after segment processing
    let mut current_video_label = "[0:v]".to_string();
    let mut filters = Vec::new();
    
    // Track if we need additional effects after concat
    let has_post_segment_effects = !edits.zoom.is_empty() || 
        edits.speed.iter().any(|s| (s.speed - 1.0).abs() > 0.01);
    
    if enabled_segments.len() > 1 {
        // Multiple segments need concat
        // Note: For video-only files, we only do video concat (no audio)
        let mut segment_filters = Vec::new();
        for (i, seg) in enabled_segments.iter().enumerate() {
            // Only video filters - audio handled separately to support video-only files
            segment_filters.push(format!(
                "[0:v]trim=start={}:end={},setpts=PTS-STARTPTS[v{}]",
                seg.start_time, seg.end_time, i
            ));
        }
        
        // Concat video streams only
        // Use intermediate label if we have effects to apply after
        let concat_output = if has_post_segment_effects { "[concat_out]" } else { "[outv]" };
        let v_streams: String = (0..enabled_segments.len()).map(|i| format!("[v{}]", i)).collect();
        segment_filters.push(format!(
            "{}concat=n={}:v=1:a=0{}",
            v_streams, enabled_segments.len(), concat_output
        ));
        
        filters.push(segment_filters.join(";"));
        current_video_label = concat_output.to_string();
    }
    // Note: Single segment case is now handled with -ss/-to input seeking in build_ffmpeg_args
    // This avoids filter_complex issues with files that have no audio stream
    
    // Handle zoom effects with smooth transitions using zoompan filter
    // zoompan evaluates z, x, y expressions per-frame, enabling smooth animated zoom
    // Key: fps option must be set to match frame rate, d=1 for 1:1 frame mapping, s=WxH for output size
    if !edits.zoom.is_empty() {
        // Transition duration in seconds (matches the 150ms CSS transition in the editor)
        let transition_secs: f64 = 0.15;
        
        // Build a combined zoom expression for all zoom effects
        // For each zoom: smoothly ramp from 1 to scale, hold, then ramp back to 1
        // Since zooms don't overlap, we can combine them with nested conditionals
        
        let mut zoom_expr_parts: Vec<String> = Vec::new();
        let mut x_offset_parts: Vec<String> = Vec::new();
        let mut y_offset_parts: Vec<String> = Vec::new();
        
        for zoom in &edits.zoom {
            let s = zoom.start_time;
            let e = zoom.end_time;
            let scale = zoom.scale;
            
            // Ensure transition doesn't exceed half the zoom duration
            let trans = transition_secs.min((e - s) / 2.0);
            
            // Build smooth envelope expression using 'it' (input time in seconds)
            // This creates: 0 outside range, smooth ramp up, hold at 1, smooth ramp down
            // envelope = contribution factor from 0 to 1
            // Using gte/lte for boundary conditions and clip() to ensure value stays in [0,1]
            // Ramp-up: (it - s) / t from 0 to 1
            // Ramp-down: 1 - (it - (e - t)) / t from 1 to 0
            let envelope = format!(
                "if(lt(it,{s}),0,if(lte(it,{s_t}),clip((it-{s})/{t},0,1),if(lt(it,{e_t}),1,if(lte(it,{e}),clip(1-(it-{e_t})/{t},0,1),0))))",
                s = s,
                s_t = s + trans,
                e_t = e - trans,
                e = e,
                t = trans
            );
            
            // Contribution to zoom: (scale - 1) * envelope
            // When envelope is 0, contribution is 0; when envelope is 1, contribution is (scale-1)
            zoom_expr_parts.push(format!("(({}-1)*({}))", scale, envelope));
            
            // Offset contributions (scaled by envelope)
            x_offset_parts.push(format!("({}*({}))", zoom.x, envelope));
            y_offset_parts.push(format!("({}*({}))", zoom.y, envelope));
        }
        
        // Combined zoom factor: 1 + sum of all contributions
        // At any time, only one zoom's envelope is non-zero (they don't overlap)
        let zoom_factor = format!("(1+{})", zoom_expr_parts.join("+"));
        
        // Combined offsets for x and y panning
        let x_offset = if x_offset_parts.iter().all(|x| x.starts_with("(0*")) {
            "0".to_string()
        } else {
            format!("({})", x_offset_parts.join("+"))
        };
        let y_offset = if y_offset_parts.iter().all(|y| y.starts_with("(0*")) {
            "0".to_string()
        } else {
            format!("({})", y_offset_parts.join("+"))
        };
        
        // zoompan x,y are the top-left coordinates of the visible region
        // For centered zoom: x = (iw - iw/zoom) / 2, y = (ih - ih/zoom) / 2
        // We use 'zoom' variable which references the current z value
        let pan_x = format!("iw/2-(iw/zoom/2)+{}", x_offset);
        let pan_y = format!("ih/2-(ih/zoom/2)+{}", y_offset);
        
        let output_label = "[zoomout]";
        
        // Build the zoompan filter with all required options:
        // - fps: must match frame rate (use export option)
        // - d=1: 1 output frame per input frame (essential for video, not slideshow)
        // - s=WxH: output size matching project resolution
        // - z: zoom expression using 'it' for time-based evaluation
        // - x,y: pan expressions using 'zoom' to reference current zoom value
        filters.push(format!(
            "{}zoompan=fps={}:d=1:s={}x{}:z='{}':x='{}':y='{}'{}",
            current_video_label,
            options.frame_rate,
            width,
            height,
            zoom_factor,
            pan_x,
            pan_y,
            output_label
        ));
        
        current_video_label = output_label.to_string();
    }
    
    // Handle speed effects using trim+setpts+concat for time-selective speed
    // This approach splits the video into segments with different speeds
    let active_speed_effects: Vec<_> = edits.speed.iter()
        .filter(|s| (s.speed - 1.0).abs() > 0.01)
        .collect();
    
    if !active_speed_effects.is_empty() {
        // Sort speed effects by start time
        let mut sorted_effects = active_speed_effects.clone();
        sorted_effects.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());
        
        // Build time segments: regions at normal speed and regions at modified speed
        // Each segment: (start, end, speed_multiplier)
        let mut segments: Vec<(f64, f64, f64)> = Vec::new();
        let mut current_pos = 0.0;
        let video_duration = project.duration;
        
        for effect in sorted_effects {
            // Add normal-speed segment before this effect (if any gap)
            if effect.start_time > current_pos {
                segments.push((current_pos, effect.start_time, 1.0));
            }
            
            // Add the speed-modified segment
            let effect_end = effect.end_time.min(video_duration);
            if effect_end > effect.start_time {
                segments.push((effect.start_time, effect_end, effect.speed));
            }
            
            current_pos = effect_end;
        }
        
        // Add final normal-speed segment after all effects (if any)
        if current_pos < video_duration {
            segments.push((current_pos, video_duration, 1.0));
        }
        
        // Filter out zero-duration segments
        let segments: Vec<_> = segments.into_iter()
            .filter(|(start, end, _)| end > start)
            .collect();
        
        if segments.len() == 1 && (segments[0].2 - 1.0).abs() < 0.01 {
            // Single segment at normal speed - no speed filter needed
        } else if segments.len() == 1 {
            // Single segment with speed change - simple setpts
            let speed_multiplier = 1.0 / segments[0].2;
            let output_label = "[speedout]";
            filters.push(format!(
                "{}setpts={}*PTS{}",
                current_video_label,
                speed_multiplier,
                output_label
            ));
            current_video_label = output_label.to_string();
        } else {
            // Multiple segments - use trim+setpts+concat
            let mut segment_labels = Vec::new();
            let input_label = current_video_label.clone();
            
            for (i, (start, end, speed)) in segments.iter().enumerate() {
                let seg_label = format!("[speedseg{}]", i);
                let speed_multiplier = 1.0 / speed;
                
                // Trim the segment and apply speed change, reset PTS
                filters.push(format!(
                    "{}trim=start={}:end={},setpts={}*(PTS-STARTPTS){}",
                    input_label,
                    start,
                    end,
                    speed_multiplier,
                    seg_label
                ));
                segment_labels.push(seg_label);
            }
            
            // Concat all segments
            let concat_inputs: String = segment_labels.iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join("");
            let output_label = "[speedout]";
            filters.push(format!(
                "{}concat=n={}:v=1:a=0{}",
                concat_inputs,
                segment_labels.len(),
                output_label
            ));
            current_video_label = output_label.to_string();
        }
    }
    
    // If we have filters but the final output isn't [outv], rename it
    // This ensures the build_ffmpeg_args function can reference the output correctly
    if !filters.is_empty() && current_video_label != "[outv]" {
        // The last filter's output becomes our final video output
        // We need to update the last filter to output to [outv] for consistency
        if let Some(last) = filters.last_mut() {
            *last = last.replace(&current_video_label, "[outv]");
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
