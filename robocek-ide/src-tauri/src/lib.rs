use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};

// ============================================================
// Data Types (serialized to JSON for the frontend)
// ============================================================

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Template {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Board {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SerialDevice {
    pub port: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectInfo {
    pub name: String,
    pub board: String,
    pub template: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CommandOutput {
    pub line: String,
    pub is_error: bool,
    pub is_done: bool,
    pub exit_code: Option<i32>,
}

// ============================================================
// Serial Monitor State
// ============================================================

/// Shared state for the active serial monitor session.
/// Holds an Arc<Mutex<Box<dyn serialport::SerialPort>>> so both
/// the reader thread and the write/stop commands can access the port.
pub struct SerialState {
    /// The live port handle; None when monitor is not running.
    pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
    /// Signal flag — set to true to ask the reader thread to exit.
    pub stop_flag: Arc<std::sync::atomic::AtomicBool>,
}

impl SerialState {
    fn new() -> Self {
        Self {
            port: Mutex::new(None),
            stop_flag: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        }
    }
}

// ============================================================
// Platform Root Detection
// ============================================================

fn find_platform_root() -> Option<PathBuf> {
    // Try current directory and its parents (works in `tauri dev`)
    if let Ok(cwd) = std::env::current_dir() {
        let mut current = cwd;
        for _ in 0..10 {
            if current.join("boards").exists() && current.join("sdk").exists() {
                return Some(current);
            }
            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // Try from executable location upwards (works in installed builds)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(start) = exe.parent() {
            let mut current = start.to_path_buf();
            for _ in 0..10 {
                if current.join("boards").exists() && current.join("sdk").exists() {
                    return Some(current);
                }
                if let Some(parent) = current.parent() {
                    current = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    None
}

// ============================================================
// Helper: Recursive directory copy
// ============================================================

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

// ============================================================
// Helper: Recursive file tree listing
// ============================================================

fn list_dir_recursive(dir: &Path, max_depth: usize) -> Result<Vec<FileNode>, String> {
    if max_depth == 0 {
        return Ok(Vec::new());
    }

    let mut nodes = Vec::new();

    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Skip hidden directories and PlatformIO build cache
        if name.starts_with('.') || name == ".pio" || name == "target" {
            continue;
        }

        if path.is_dir() {
            let children = list_dir_recursive(&path, max_depth - 1)?;
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children,
            });
        } else {
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: Vec::new(),
            });
        }
    }

    // Sort: directories first, then files, alphabetically within each group
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(nodes)
}

// ============================================================
// Helper: Generate robocek_config.h from board YAML data
// ============================================================

fn generate_config_header(board_data: &serde_yaml::Value, board_name: &str) -> String {
    let mut lines = vec![
        "#pragma once".to_string(),
        String::new(),
        "// ========================================".to_string(),
        "// Generated by ROBOCEK IDE".to_string(),
        format!("// Board: {}", board_name),
        "// ========================================".to_string(),
        String::new(),
    ];

    // Motor configuration
    if let Some(motor) = board_data.get("motor") {
        let standby = motor
            .get("standby")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        lines.push(format!("#define RC_MOTOR_STBY {}", standby));
        lines.push(String::new());

        if let Some(left) = motor.get("left") {
            lines.push("// Left motor".to_string());
            lines.push(format!(
                "#define RC_LEFT_PWM {}",
                left.get("pwm").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
            lines.push(format!(
                "#define RC_LEFT_IN1 {}",
                left.get("in1").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
            lines.push(format!(
                "#define RC_LEFT_IN2 {}",
                left.get("in2").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
        }

        if let Some(right) = motor.get("right") {
            lines.push(String::new());
            lines.push("// Right motor".to_string());
            lines.push(format!(
                "#define RC_RIGHT_PWM {}",
                right.get("pwm").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
            lines.push(format!(
                "#define RC_RIGHT_IN1 {}",
                right.get("in1").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
            lines.push(format!(
                "#define RC_RIGHT_IN2 {}",
                right.get("in2").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
        }
    }

    // Line sensor configuration
    if let Some(sensor) = board_data.get("line_sensor") {
        let active = sensor
            .get("active")
            .and_then(|v| v.as_str())
            .unwrap_or("HIGH");

        lines.push(String::new());
        lines.push("// ========================================".to_string());
        lines.push("// Line Sensor Configuration".to_string());
        lines.push("// ========================================".to_string());

        if let Some(left) = sensor.get("left") {
            lines.push(format!(
                "#define RC_LINE_SENSOR_LEFT {}",
                left.get("pin").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
        }
        if let Some(right) = sensor.get("right") {
            lines.push(format!(
                "#define RC_LINE_SENSOR_RIGHT {}",
                right.get("pin").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
        }
        lines.push(format!("#define RC_LINE_SENSOR_ACTIVE {}", active));
    }

    // Ultrasonic sensor configuration
    if let Some(ultra) = board_data.get("ultrasonic_sensor") {
        lines.push(String::new());
        lines.push("// ========================================".to_string());
        lines.push("// Ultrasonic Sensor Configuration".to_string());
        lines.push("// ========================================".to_string());

        if let Some(left) = ultra.get("left") {
            lines.push(format!(
                "#define RC_ULTRASONIC_LEFT_TRIGGER {}",
                left.get("trigger").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
            lines.push(format!(
                "#define RC_ULTRASONIC_LEFT_ECHO {}",
                left.get("echo").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
        }
        if let Some(right) = ultra.get("right") {
            lines.push(format!(
                "#define RC_ULTRASONIC_RIGHT_TRIGGER {}",
                right.get("trigger").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
            lines.push(format!(
                "#define RC_ULTRASONIC_RIGHT_ECHO {}",
                right.get("echo").and_then(|v| v.as_i64()).unwrap_or(0)
            ));
        }
    }

    lines.join("\n") + "\n"
}

// ============================================================
// Tauri Commands
// ============================================================

#[tauri::command]
fn get_platform_root() -> Result<String, String> {
    find_platform_root()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| {
            "ROBOCEK platform root not found. Make sure the IDE is inside the robocek-platform directory.".to_string()
        })
}

#[tauri::command]
fn list_templates() -> Result<Vec<Template>, String> {
    let root = find_platform_root()
        .ok_or_else(|| "Platform root not found".to_string())?;

    let mut templates = Vec::new();

    // Built-in blank template
    if root
        .join("templates")
        .join("esp32-basic")
        .join("src")
        .join("main.cpp")
        .exists()
    {
        templates.push(Template {
            id: "empty".to_string(),
            name: "Empty Project".to_string(),
            description: "Bare-bones Arduino scaffold with serial heartbeat".to_string(),
            category: "starter".to_string(),
        });
    }

    // Example-based templates
    let known: &[(&str, &str, &str, &str)] = &[
        (
            "line-follower",
            "Line Follower",
            "Two-sensor line following robot with speed control",
            "autonomous",
        ),
        (
            "obstacle-avoider",
            "Obstacle Avoider",
            "Dual ultrasonic obstacle detection and avoidance",
            "autonomous",
        ),
        (
            "motor-test",
            "Motor Test",
            "Sequential test of all motor directions and speeds",
            "diagnostic",
        ),
        (
            "line-sensor-test",
            "Line Sensor Test",
            "Read and print line sensor digital values",
            "diagnostic",
        ),
        (
            "ultrasonic-test",
            "Ultrasonic Test",
            "Read and print distance from ultrasonic sensors",
            "diagnostic",
        ),
    ];

    for (id, name, desc, cat) in known {
        let src = root
            .join("examples")
            .join(id)
            .join("src")
            .join("main.cpp");
        if src.exists() {
            templates.push(Template {
                id: id.to_string(),
                name: name.to_string(),
                description: desc.to_string(),
                category: cat.to_string(),
            });
        }
    }

    Ok(templates)
}

#[tauri::command]
fn list_boards() -> Result<Vec<Board>, String> {
    let root = find_platform_root()
        .ok_or_else(|| "Platform root not found".to_string())?;

    let boards_dir = root.join("boards");
    if !boards_dir.exists() {
        return Ok(Vec::new());
    }

    let mut boards = Vec::new();

    for entry in std::fs::read_dir(&boards_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let board_file = path.join("board.yaml");
        if !board_file.exists() {
            continue;
        }

        let content =
            std::fs::read_to_string(&board_file).map_err(|e| e.to_string())?;
        let data: serde_yaml::Value =
            serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

        let board_id = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let name = data
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&board_id)
            .to_string();

        boards.push(Board {
            id: board_id,
            name,
        });
    }

    boards.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(boards)
}

#[tauri::command]
fn list_devices() -> Vec<SerialDevice> {
    match serialport::available_ports() {
        Ok(ports) => ports
            .iter()
            .map(|p| SerialDevice {
                port: p.port_name.clone(),
                description: match &p.port_type {
                    serialport::SerialPortType::UsbPort(info) => info
                        .product
                        .clone()
                        .unwrap_or_else(|| "USB Device".to_string()),
                    _ => "Serial Port".to_string(),
                },
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
fn get_project_info(project_dir: String) -> Result<ProjectInfo, String> {
    let dir = PathBuf::from(&project_dir);
    let config_file = dir.join("robocek.yaml");

    if !config_file.exists() {
        return Err("Not a ROBOCEK project (robocek.yaml not found)".to_string());
    }

    let content =
        std::fs::read_to_string(&config_file).map_err(|e| e.to_string())?;
    let data: serde_yaml::Value =
        serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let fallback_name = dir
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    Ok(ProjectInfo {
        name: data
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(&fallback_name)
            .to_string(),
        board: data
            .get("board")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        template: data
            .get("template")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        path: project_dir,
    })
}

#[tauri::command]
fn list_project_files(project_dir: String) -> Result<Vec<FileNode>, String> {
    let dir = PathBuf::from(&project_dir);
    let mut nodes = Vec::new();

    // Show these directories in the sidebar
    for dir_name in &["src", "include", "lib", "generated"] {
        let sub = dir.join(dir_name);
        if sub.exists() {
            let children = list_dir_recursive(&sub, 3)?;
            nodes.push(FileNode {
                name: dir_name.to_string(),
                path: sub.to_string_lossy().to_string(),
                is_dir: true,
                children,
            });
        }
    }

    // Root-level config files
    for file_name in &["robocek.yaml", "platformio.ini"] {
        let f = dir.join(file_name);
        if f.exists() {
            nodes.push(FileNode {
                name: file_name.to_string(),
                path: f.to_string_lossy().to_string(),
                is_dir: false,
                children: Vec::new(),
            });
        }
    }

    Ok(nodes)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read '{}': {}", path, e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write '{}': {}", path, e))
}

#[tauri::command]
fn create_project(
    template_id: String,
    project_name: String,
    board_id: String,
    destination: String,
) -> Result<String, String> {
    let root = find_platform_root()
        .ok_or_else(|| "Platform root not found".to_string())?;

    let dest = PathBuf::from(&destination).join(&project_name);

    if dest.exists() {
        return Err(format!(
            "Directory '{}' already exists at the destination.",
            project_name
        ));
    }

    // Resolve template source directory
    let template_src = if template_id == "empty" {
        root.join("templates").join("esp32-basic")
    } else {
        root.join("examples").join(&template_id)
    };

    let template_src_dir = template_src.join("src");
    if !template_src_dir.exists() {
        return Err(format!("Template '{}' not found.", template_id));
    }

    // Load and parse board YAML
    let board_yaml = root.join("boards").join(&board_id).join("board.yaml");
    if !board_yaml.exists() {
        return Err(format!("Board '{}' not found.", board_id));
    }
    let board_content =
        std::fs::read_to_string(&board_yaml).map_err(|e| e.to_string())?;
    let board_data: serde_yaml::Value =
        serde_yaml::from_str(&board_content).map_err(|e| e.to_string())?;
    let board_name = board_data
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&board_id)
        .to_string();

    // Create project directory structure
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    for sub in &["include", "lib", "test", "generated"] {
        std::fs::create_dir_all(dest.join(sub)).map_err(|e| e.to_string())?;
    }

    // Copy template source files
    copy_dir_recursive(&template_src_dir, &dest.join("src"))
        .map_err(|e| format!("Failed to copy template: {}", e))?;

    // Copy SDK
    let sdk_src = root.join("sdk").join("roboceksdk").join("src");
    let sdk_dest = dest.join("lib").join("robocek-sdk").join("src");
    copy_dir_recursive(&sdk_src, &sdk_dest)
        .map_err(|e| format!("Failed to copy SDK: {}", e))?;

    // Write platformio.ini
    let pio = "[env:esp32dev]\nplatform = espressif32\nboard = esp32dev\nframework = arduino\nmonitor_speed = 115200\nbuild_flags =\n    -I generated\n";
    std::fs::write(dest.join("platformio.ini"), pio).map_err(|e| e.to_string())?;

    // Write robocek.yaml
    let yaml = format!(
        "name: {}\ntemplate: {}\nboard: {}\n",
        project_name, template_id, board_id
    );
    std::fs::write(dest.join("robocek.yaml"), yaml).map_err(|e| e.to_string())?;

    // Generate robocek_config.h
    let config = generate_config_header(&board_data, &board_name);
    std::fs::write(dest.join("generated").join("robocek_config.h"), config)
        .map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file().blocking_pick_folder();
    Ok(folder.map(|p| p.to_string()))
}

/// Run a shell command and stream its stdout/stderr to the frontend via Tauri events.
/// Runs entirely on a background thread so the Tauri invoke thread is never blocked.
#[tauri::command]
fn run_command(
    window: tauri::Window,
    program: String,
    args: Vec<String>,
    cwd: String,
    event_id: String,
) {
    std::thread::spawn(move || {
        let mut child = match Command::new(&program)
            .args(&args)
            .current_dir(&cwd)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = window.emit(
                    &event_id,
                    CommandOutput {
                        line: format!("Failed to start '{}': {}", program, e),
                        is_error: true,
                        is_done: true,
                        exit_code: Some(-1),
                    },
                );
                return;
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        // Channel to know when both reader threads finish
        let (tx, rx) = std::sync::mpsc::channel::<()>();
        let tx2 = tx.clone();

        // Spawn stdout reader thread
        if let Some(out) = stdout {
            let w = window.clone();
            let ev = event_id.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let _ = w.emit(
                            &ev,
                            CommandOutput {
                                line,
                                is_error: false,
                                is_done: false,
                                exit_code: None,
                            },
                        );
                    }
                }
                let _ = tx.send(());
            });
        } else {
            let _ = tx.send(());
        }

        // Spawn stderr reader thread
        if let Some(err) = stderr {
            let w = window.clone();
            let ev = event_id.clone();
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines() {
                    if let Ok(line) = line {
                        let _ = w.emit(
                            &ev,
                            CommandOutput {
                                line,
                                is_error: true,
                                is_done: false,
                                exit_code: None,
                            },
                        );
                    }
                }
                let _ = tx2.send(());
            });
        } else {
            let _ = tx2.send(());
        }

        // Wait for the process to exit
        let code = child.wait().map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);

        // Wait for both reader threads to drain their buffers
        rx.recv().ok();
        rx.recv().ok();

        // Notify the frontend that the command has completed
        let _ = window.emit(
            &event_id,
            CommandOutput {
                line: String::new(),
                is_error: false,
                is_done: true,
                exit_code: Some(code),
            },
        );
    });
}

// ============================================================
// Native Serial Monitor Commands
// ============================================================

/// Open a serial port and stream every incoming line to the frontend
/// via Tauri events named `event_id`. Sends `{ line, is_done: true }`
/// when the port is closed (stop requested or disconnected).
#[tauri::command]
fn start_serial_monitor(
    window: tauri::Window,
    serial_state: State<'_, SerialState>,
    port_name: String,
    baud_rate: u32,
    event_id: String,
) -> Result<(), String> {
    // Close any existing monitor first
    {
        let mut guard = serial_state.port.lock().unwrap();
        *guard = None;
    }

    let port = serialport::new(&port_name, baud_rate)
        .timeout(std::time::Duration::from_millis(500))
        .open()
        .map_err(|e| format!("Cannot open {}: {}", port_name, e))?;

    // Clone for the reader thread
    let port_clone = port.try_clone()
        .map_err(|e| format!("Cannot clone port: {}", e))?;

    let ev = event_id.clone();
    let stop_flag = serial_state.stop_flag.clone();
    stop_flag.store(false, std::sync::atomic::Ordering::Relaxed);
    let stop_flag_clone = stop_flag.clone();

    // Store the port in state so write/stop commands can use it
    {
        let mut guard = serial_state.port.lock().unwrap();
        *guard = Some(port);
    }

    std::thread::spawn(move || {
        let mut reader = BufReader::new(port_clone);
        loop {
            if stop_flag_clone.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => break, // EOF / port closed
                Ok(_) => {
                    let trimmed = line.trim_end_matches(|c| c == '\r' || c == '\n').to_string();
                    let _ = window.emit(&ev, CommandOutput {
                        line: trimmed,
                        is_error: false,
                        is_done: false,
                        exit_code: None,
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                    // Read timeout — normal on idle port, keep looping
                    continue;
                }
                Err(_) => break, // Real error (port closed/disconnected)
            }
        }
        // Signal done
        let _ = window.emit(&ev, CommandOutput {
            line: String::new(),
            is_error: false,
            is_done: true,
            exit_code: Some(0),
        });
    });

    Ok(())
}

/// Stop the active serial monitor by setting the stop flag and dropping the port handle.
#[tauri::command]
fn stop_serial_monitor(serial_state: State<'_, SerialState>) {
    serial_state.stop_flag.store(true, std::sync::atomic::Ordering::Relaxed);
    let mut guard = serial_state.port.lock().unwrap();
    *guard = None; // dropping closes the port, causing the reader thread to get an error/EOF
}

/// Write a string to the active serial port (for interactive monitor send).
#[tauri::command]
fn write_serial(
    serial_state: State<'_, SerialState>,
    data: String,
) -> Result<(), String> {
    let mut guard = serial_state.port.lock().unwrap();
    if let Some(port) = guard.as_mut() {
        port.write_all(data.as_bytes())
            .map_err(|e| format!("Write failed: {}", e))?;
        port.flush().map_err(|e| format!("Flush failed: {}", e))?;
        Ok(())
    } else {
        Err("No serial monitor is running".to_string())
    }
}

// ============================================================
// App Entry Point
// ============================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(SerialState::new())
        .invoke_handler(tauri::generate_handler![
            get_platform_root,
            list_templates,
            list_boards,
            list_devices,
            get_project_info,
            list_project_files,
            read_file,
            write_file,
            create_project,
            open_folder_dialog,
            run_command,
            start_serial_monitor,
            stop_serial_monitor,
            write_serial,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
