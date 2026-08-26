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

/// Locate the robocek-platform root directory containing boards/, sdk/, etc.
/// Strategy:
///   1. Walk up from cwd          — works in `tauri dev`
///   2. Walk up from exe location — fallback for dev
///   3. Check Tauri resource dir  — works in packaged .exe / .deb builds
fn find_platform_root() -> Option<PathBuf> {
    // Strategy 1: Walk up from current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let mut current = cwd;
        for _ in 0..10 {
            let pkg_dir = current.join("robocek-cli").join("robocek");
            if pkg_dir.join("boards").exists() && pkg_dir.join("sdk").exists() {
                return Some(pkg_dir);
            }
            if let Some(parent) = current.parent() {
                current = parent.to_path_buf();
            } else {
                break;
            }
        }
    }

    // Strategy 2: Walk up from executable location
    if let Ok(exe) = std::env::current_exe() {
        if let Some(start) = exe.parent() {
            let mut current = start.to_path_buf();
            for _ in 0..10 {
                let pkg_dir = current.join("robocek-cli").join("robocek");
                if pkg_dir.join("boards").exists() && pkg_dir.join("sdk").exists() {
                    return Some(pkg_dir);
                }
                if let Some(parent) = current.parent() {
                    current = parent.to_path_buf();
                } else {
                    break;
                }
            }
        }
    }

    // Strategy 3: Tauri resource directory (packaged builds)
    // boards/sdk/templates/examples are bundled under resources/platform/robocek-cli/robocek
    if let Ok(exe) = std::env::current_exe() {
        // In packaged Tauri apps the resources sit next to (or inside) the exe bundle.
        // Common locations: <exe_dir>/../Resources/platform (macOS),
        //                   <exe_dir>/resources/platform (Windows/Linux)
        let candidates = [
            exe.parent().map(|p| p.join("resources").join("platform")),
            exe.parent().and_then(|p| p.parent()).map(|p| p.join("Resources").join("platform")),
            exe.parent().map(|p| p.join("platform")),
        ];
        for candidate in candidates.into_iter().flatten() {
            let pkg_dir = candidate.join("robocek-cli").join("robocek");
            if pkg_dir.join("boards").exists() && pkg_dir.join("sdk").exists() {
                return Some(pkg_dir);
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

fn get_robocek_env_paths() -> Option<(PathBuf, PathBuf, PathBuf)> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()
        .map(PathBuf::from)?;
    let robocek_dir = home.join(".robocek");
    let penv_dir = robocek_dir.join("penv");
    #[cfg(target_os = "windows")]
    let bin_dir = penv_dir.join("Scripts");
    #[cfg(not(target_os = "windows"))]
    let bin_dir = penv_dir.join("bin");
    Some((robocek_dir, penv_dir, bin_dir))
}

fn check_python_installed() -> bool {
    if let Ok(output) = Command::new("python").arg("--version").output() {
        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout);
            if parse_and_check_python_version(&version_str) {
                return true;
            }
        }
    }
    if let Ok(output) = Command::new("python3").arg("--version").output() {
        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout);
            if parse_and_check_python_version(&version_str) {
                return true;
            }
        }
    }
    false
}

fn parse_and_check_python_version(version_str: &str) -> bool {
    let parts: Vec<&str> = version_str.split_whitespace().collect();
    if parts.len() >= 2 {
        let ver = parts[1];
        let ver_parts: Vec<&str> = ver.split('.').collect();
        if ver_parts.len() >= 2 {
            if let (Ok(major), Ok(minor)) = (ver_parts[0].parse::<i32>(), ver_parts[1].parse::<i32>()) {
                return major == 3 && minor >= 10;
            }
        }
    }
    false
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct BootstrapStatus {
    pub is_ready: bool,
    pub python_ok: bool,
    pub pio_ok: bool,
    pub cli_ok: bool,
    pub message: String,
}

#[tauri::command]
fn check_bootstrap_status() -> Result<BootstrapStatus, String> {
    let paths = match get_robocek_env_paths() {
        Some(p) => p,
        None => return Err("Could not determine user home directory".to_string()),
    };
    let (_robocek_dir, _penv_dir, bin_dir) = paths;

    #[cfg(target_os = "windows")]
    let pio_exe = bin_dir.join("pio.exe");
    #[cfg(not(target_os = "windows"))]
    let pio_exe = bin_dir.join("pio");

    #[cfg(target_os = "windows")]
    let robocek_exe = bin_dir.join("robocek.exe");
    #[cfg(not(target_os = "windows"))]
    let robocek_exe = bin_dir.join("robocek");

    let pio_ok = pio_exe.exists();
    let cli_ok = robocek_exe.exists();
    let python_ok = check_python_installed();

    let is_ready = pio_ok && cli_ok;
    let message = if is_ready {
        "ROBOCEK environment is ready.".to_string()
    } else if !python_ok {
        "Python 3.10+ is required but was not found.".to_string()
    } else {
        "ROBOCEK environment needs setup.".to_string()
    };

    Ok(BootstrapStatus {
        is_ready,
        python_ok,
        pio_ok,
        cli_ok,
        message,
    })
}

#[tauri::command]
fn run_bootstrap(window: tauri::Window) {
    std::thread::spawn(move || {
        let emit_log = |msg: &str, is_error: bool| {
            let _ = window.emit("bootstrap-progress", CommandOutput {
                line: msg.to_string(),
                is_error,
                is_done: false,
                exit_code: None,
            });
        };

        emit_log("⚡ Starting environment bootstrap...", false);

        // 1. Check Python
        let mut python_path = "python".to_string();
        if !check_python_installed() {
            emit_log("Python 3.10+ not detected on your system.", false);
            #[cfg(target_os = "windows")]
            {
                emit_log("Downloading Python 3.11 installer...", false);
                let home = std::env::var("USERPROFILE").unwrap_or_default();
                let dest_installer = PathBuf::from(home).join(".robocek").join("python-installer.exe");
                
                // Ensure directory exists
                let _ = std::fs::create_dir_all(dest_installer.parent().unwrap());

                let download_script = format!(
                    "$ProgressPreference = 'SilentlyContinue'; \
                     Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '{}';",
                    dest_installer.display()
                );

                let output = Command::new("powershell")
                    .args(&["-NoProfile", "-Command", &download_script])
                    .output();

                match output {
                    Ok(out) if out.status.success() => {
                        emit_log("Installing Python silently (this may take a minute)...", false);
                        let install_output = Command::new(&dest_installer)
                            .args(&["/quiet", "InstallAllUsers=0", "PrependPath=1"])
                            .status();

                        let _ = std::fs::remove_file(&dest_installer);

                        match install_output {
                            Ok(status) if status.success() => {
                                emit_log("Python installed successfully!", false);
                                std::thread::sleep(std::time::Duration::from_secs(2));
                                python_path = "python".to_string();
                            }
                            _ => {
                                emit_log("❌ Python installation failed. Please install Python 3.10+ manually.", true);
                                return;
                            }
                        }
                    }
                    _ => {
                        emit_log("❌ Failed to download Python. Please check your internet connection.", true);
                        return;
                    }
                }
            }
            #[cfg(not(target_os = "windows"))]
            {
                emit_log("❌ Python 3.10+ is missing. Please install Python 3.10+ using your package manager.", true);
                return;
            }
        } else {
            if Command::new("python").arg("--version").output().is_ok() {
                python_path = "python".to_string();
            } else {
                python_path = "python3".to_string();
            }
        }

        // 2. Create Virtual Environment
        emit_log("📁 Creating isolated virtual environment in ~/.robocek/penv...", false);
        let paths = match get_robocek_env_paths() {
            Some(p) => p,
            None => {
                emit_log("❌ Could not determine user home directory.", true);
                return;
            }
        };
        let (robocek_dir, penv_dir, bin_dir) = paths;

        let _ = std::fs::create_dir_all(&robocek_dir);

        let venv_status = Command::new(&python_path)
            .args(&["-m", "venv", &penv_dir.to_string_lossy()])
            .status();

        match venv_status {
            Ok(status) if status.success() => {
                emit_log("Virtual environment created successfully.", false);
            }
            _ => {
                emit_log("❌ Failed to create virtual environment.", true);
                return;
            }
        }

        // Determine pip path
        #[cfg(target_os = "windows")]
        let pip_cmd = bin_dir.join("pip.exe");
        #[cfg(not(target_os = "windows"))]
        let pip_cmd = bin_dir.join("pip");

        // 3. Install PlatformIO
        emit_log("📦 Installing PlatformIO Core (this may take a minute)...", false);
        let pio_status = Command::new(&pip_cmd)
            .args(&["install", "platformio"])
            .status();

        match pio_status {
            Ok(status) if status.success() => {
                emit_log("PlatformIO Core installed successfully.", false);
            }
            _ => {
                emit_log("❌ Failed to install PlatformIO Core.", true);
                return;
            }
        }

        // 4. Install robocek-cli
        emit_log("📦 Bundling and installing robocek-cli package...", false);

        let platform_root = find_platform_root();
        if platform_root.is_none() {
            emit_log("❌ Bundled robocek-cli resources not found in app package.", true);
            return;
        }
        let cli_dir = platform_root.unwrap().parent().unwrap().to_path_buf();

        let cli_status = Command::new(&pip_cmd)
            .args(&["install", &cli_dir.to_string_lossy()])
            .status();

        match cli_status {
            Ok(status) if status.success() => {
                emit_log("robocek-cli installed successfully.", false);
            }
            _ => {
                emit_log("❌ Failed to install robocek-cli package.", true);
                return;
            }
        }

        emit_log("🎉 Bootstrap completed! ROBOCEK environment is ready to use.", false);
        
        let _ = window.emit("bootstrap-progress", CommandOutput {
            line: String::new(),
            is_error: false,
            is_done: true,
            exit_code: Some(0),
        });
    });
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
        let mut final_program = program.clone();
        if program == "pio" || program == "robocek" {
            if let Some((_robocek_dir, _penv_dir, bin_dir)) = get_robocek_env_paths() {
                #[cfg(target_os = "windows")]
                let exe_name = format!("{}.exe", program);
                #[cfg(not(target_os = "windows"))]
                let exe_name = program.clone();

                let local_path = bin_dir.join(exe_name);
                if local_path.exists() {
                    final_program = local_path.to_string_lossy().to_string();
                }
            }
        }

        let mut child = match Command::new(&final_program)
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
            check_bootstrap_status,
            run_bootstrap,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
