from pathlib import Path
import sys
import os

# Ensure the virtual environment's Scripts/bin directory is in PATH for subprocesses
bindir = str(Path(sys.executable).parent)
if bindir not in os.environ.get("PATH", ""):
    os.environ["PATH"] = bindir + os.pathsep + os.environ.get("PATH", "")

import shutil
import subprocess
import serial.tools.list_ports
import typer
from rich.console import Console
from rich.markup import escape
from .board import load_board
from .generator import generate_motor_config
from .project import Project
from .generator import generate_project_config

app = typer.Typer(
    name="robocek",
    help="ROBOCEK Embedded Robotics Development Platform"
)
board_app = typer.Typer(
    name="board",
    help="ROBOCEK Board Management"
)
template_app = typer.Typer(
    help="Manage ROBOCEK project templates."
)

app.add_typer(
    template_app,
    name="template"
)
app.add_typer(board_app)

# Ensure stdout/stderr use UTF-8 on Windows (default is CP1252 which cannot
# encode unicode characters like ✓ used in Rich output).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

console = Console(highlight=False, legacy_windows=False)


PROJECT_ROOT = Path(__file__).resolve().parent
TEMPLATES_DIR = PROJECT_ROOT / "templates"
EXAMPLES_DIR = PROJECT_ROOT / "examples"

TEMPLATE_ALIASES = {
    "empty": TEMPLATES_DIR / "esp32-basic"
}


def _available_templates() -> list[Path]:
    templates = []

    if EXAMPLES_DIR.exists():
        for item in EXAMPLES_DIR.iterdir():
            if not item.is_dir():
                continue

            main_cpp = item / "src" / "main.cpp"

            if main_cpp.exists():
                templates.append(item)

    # Expose built-in aliases as virtual template entries.
    for alias, alias_path in TEMPLATE_ALIASES.items():
        main_cpp = alias_path / "src" / "main.cpp"
        if main_cpp.exists():
            templates.append(Path(alias))

    return sorted(
        templates,
        key=lambda path: path.name
    )


def _resolve_template(template_name: str) -> Path:
    alias_path = TEMPLATE_ALIASES.get(template_name)

    if alias_path is not None:
        main_cpp = alias_path / "src" / "main.cpp"

        if not alias_path.exists() or not main_cpp.exists():
            raise FileNotFoundError(
                f"Template '{template_name}' not found."
            )

        return alias_path

    template_dir = EXAMPLES_DIR / template_name

    main_cpp = template_dir / "src" / "main.cpp"

    if not template_dir.exists() or not main_cpp.exists():
        raise FileNotFoundError(
            f"Template '{template_name}' not found."
        )

    return template_dir


def _write_platformio_ini(destination: Path):
    content = """[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
build_flags =
    -I generated
"""

    (destination / "platformio.ini").write_text(
        content,
        encoding="utf-8"
    )


def _write_robocek_yaml(
    destination: Path,
    project_name: str,
    template_name: str,
    board_id: str
):
    content = f"""name: {project_name}
template: {template_name}
board: {board_id}
"""

    (destination / "robocek.yaml").write_text(
        content,
        encoding="utf-8"
    )


def _copy_sdk(destination: Path):
    sdk_src = PROJECT_ROOT / "sdk" / "roboceksdk" / "src"

    if not sdk_src.exists():
        raise FileNotFoundError(
            "SDK source not found."
        )

    sdk_dest = destination / "lib" / "robocek-sdk" / "src"

    shutil.copytree(
        sdk_src,
        sdk_dest
    )


@app.command()
def version():
    """Show ROBOCEK Platform version."""
    console.print("[bold green]ROBOCEK Platform[/bold green] v0.1.0")


@app.command()
def hello():
    """Test the ROBOCEK CLI."""
    console.print("[bold cyan]ROBOCEK Platform is working![/bold cyan]")


@app.command()
def create(
    template_name: str = typer.Argument(
        ...,
        help="Template to use, for example: line-follower"
    ),
    project_name: str = typer.Argument(
        ...,
        help="Name of the project to create."
    ),
    board: str = typer.Option(
        "robocek-esp32-v1",
        "--board",
        "-b",
        help="Board ID."
    )
):
    """Create a new ROBOCEK project from a template."""

    destination = Path.cwd() / project_name

    if destination.exists():
        console.print(
            f"[bold red]Error:[/bold red] "
            f"Project '{project_name}' already exists."
        )
        raise typer.Exit(code=1)

    try:
        template = _resolve_template(template_name)

    except FileNotFoundError as error:
        console.print(
            "[bold red]Error:[/bold red] "
            f"{error}"
        )
        raise typer.Exit(code=1)

    try:
        board_obj = load_board(
            board,
            PROJECT_ROOT / "boards"
        )

    except FileNotFoundError:
        console.print(
            "[bold red]Error:[/bold red] "
            f"Board '{board}' not found."
        )
        raise typer.Exit(code=1)

    console.print(
        f"Creating ROBOCEK project "
        f"[bold cyan]{project_name}[/bold cyan]..."
    )

    console.print("  [cyan]load template[/cyan]")

    destination.mkdir(parents=True, exist_ok=False)

    console.print("  [cyan]create directory[/cyan]")

    (destination / "include").mkdir()
    (destination / "lib").mkdir()
    (destination / "test").mkdir()
    (destination / "generated").mkdir()

    shutil.copytree(
        template / "src",
        destination / "src"
    )

    console.print("  [cyan]copy template source[/cyan]")

    _copy_sdk(destination)

    console.print("  [cyan]copy lib src[/cyan]")

    _write_platformio_ini(destination)

    console.print("  [cyan]generate platformio.ini[/cyan]")

    _write_robocek_yaml(
        destination,
        project_name,
        template_name,
        board
    )

    console.print("  [cyan]generate robocek.yaml[/cyan]")

    generate_project_config(destination, board_obj)

    console.print("  [cyan]generate robocek_config.h[/cyan]")

    console.print()
    console.print("[bold green]✓ Project created successfully![/bold green]")
    console.print()
    console.print(f"  Project : {project_name}")
    console.print(f"  Template: {template_name}")
    console.print(f"  Board   : {board}")
    console.print("  Framework: Arduino")
    console.print()
    console.print("Next:")
    console.print(f"  cd {project_name}")
    console.print("  robocek build")


@template_app.command("list")
def template_list():
    """List available project templates."""

    templates = _available_templates()

    console.print()
    console.print("[bold cyan]Available ROBOCEK Templates[/bold cyan]")
    console.print()

    if not templates:
        console.print("[yellow]No templates found.[/yellow]")
        return

    for template in templates:
        console.print(f"[bold green]{template.name}[/bold green]")

@app.command()
def build():
    """Build the current ROBOCEK project using PlatformIO."""

    current_dir = Path.cwd()

    platformio_file = current_dir / "platformio.ini"

    if not platformio_file.exists():
        console.print(
            "[bold red]Error:[/bold red] "
            "This is not a ROBOCEK/PlatformIO project."
        )
        raise typer.Exit(code=1)

    # ----------------------------------------
    # Generate ROBOCEK hardware configuration
    # ----------------------------------------

    console.print(
        "[bold cyan]Generating hardware configuration...[/bold cyan]"
    )

    try:
        project = Project(current_dir)

        boards_dir = PROJECT_ROOT / "boards"

        board = load_board(
            project.board,
            boards_dir
        )

        output = generate_project_config(
            current_dir,
            board
        )

        console.print(
            f"[bold green]✓ Board:[/bold green] "
            f"{escape(board.name)}"
        )

        console.print(
            f"[bold green]✓ Configuration:[/bold green] "
            f"{escape(str(output))}"
        )

    except Exception as error:

        console.print(
            "[bold red]Configuration failed:[/bold red]"
        )

        console.print(
            f"  {escape(str(error))}"
        )

        raise typer.Exit(code=1)

    console.print()

    # ----------------------------------------
    # Build using PlatformIO
    # ----------------------------------------

    console.print(
        "[bold cyan]Building ROBOCEK project...[/bold cyan]"
    )

    console.print()

    result = subprocess.run(
        ["pio", "run"],
        cwd=current_dir
    )

    if result.returncode != 0:

        console.print()

        console.print(
            "[bold red]✗ Build failed.[/bold red]"
        )

        raise typer.Exit(
            code=result.returncode
        )

    console.print()

    console.print(
        "[bold green]✓ Build successful![/bold green]"
    )

@app.command()
def devices():
    """List connected serial devices."""

    ports = list(serial.tools.list_ports.comports())

    console.print()
    console.print("[bold cyan]ROBOCEK DEVICES[/bold cyan]")
    console.print()

    if not ports:
        console.print("[yellow]No serial devices detected.[/yellow]")
        return

    for port in ports:
        console.print(f"[bold green]{port.device}[/bold green]")

        description = port.description or "Unknown device"
        manufacturer = port.manufacturer or "Unknown manufacturer"

        console.print(f"  Description : {description}")
        console.print(f"  Manufacturer: {manufacturer}")
        console.print()

@app.command()
def upload():
    """Build and upload the current ROBOCEK project."""

    current_dir = Path.cwd()

    platformio_file = current_dir / "platformio.ini"

    if not platformio_file.exists():
        console.print(
            "[bold red]Error:[/bold red] "
            "This is not a ROBOCEK/PlatformIO project."
        )
        raise typer.Exit(code=1)

    # ----------------------------------------
    # Generate configuration
    # ----------------------------------------

    console.print(
        "[bold cyan]Generating hardware configuration...[/bold cyan]"
    )

    try:
        project = Project(current_dir)

        board = load_board(
            project.board,
            PROJECT_ROOT / "boards"
        )

        generate_project_config(
            current_dir,
            board
        )

        console.print(
            f"[bold green]✓ Board:[/bold green] "
            f"{escape(board.name)}"
        )

    except Exception as error:

        console.print(
            "[bold red]Configuration failed:[/bold red]"
        )

        console.print(
            f"  {escape(str(error))}"
        )

        raise typer.Exit(code=1)

    # ----------------------------------------
    # Upload
    # ----------------------------------------

    console.print()

    console.print(
        "[bold cyan]Uploading firmware...[/bold cyan]"
    )

    result = subprocess.run(
        [
            "pio",
            "run",
            "--target",
            "upload"
        ],
        cwd=current_dir
    )

    if result.returncode != 0:

        console.print()

        console.print(
            "[bold red]✗ Upload failed.[/bold red]"
        )

        raise typer.Exit(
            code=result.returncode
        )

    console.print()

    console.print(
        "[bold green]✓ Firmware uploaded successfully![/bold green]"
    )

@app.command()
def monitor():
    """Open a serial monitor to the connected board."""

    current_dir = Path.cwd()
    platformio_file = current_dir / "platformio.ini"

    if not platformio_file.exists():
        console.print(
            "[bold red]Error:[/bold red] "
            "This is not a ROBOCEK/PlatformIO project."
        )
        raise typer.Exit(code=1)

    ports = list(serial.tools.list_ports.comports())

    if not ports:
        console.print(
            "[bold red]Error:[/bold red] "
            "No serial device detected."
        )
        console.print(
            "Connect your ROBOCEK board and try again."
        )
        raise typer.Exit(code=1)

    console.print(
        "[bold cyan]ROBOCEK board detected.[/bold cyan]"
    )

    for port in ports:
        console.print(
            f"  {port.device} - {port.description}"
        )

    console.print()
    console.print(
        "[bold cyan]Opening serial monitor...[/bold cyan]"
    )
    console.print()

    result = subprocess.run(
        ["pio", "device", "monitor"],
        cwd=current_dir
    )

    if result.returncode != 0:
        console.print()
        console.print(
            "[bold red]✗ Serial monitor failed.[/bold red]"
        )
        raise typer.Exit(code=result.returncode)

@app.command()
def config():
    """Generate hardware configuration for the current ROBOCEK project."""

    project_dir = Path.cwd()

    try:
        project = Project(project_dir)

    except FileNotFoundError:
        console.print(
            "[bold red]Error:[/bold red] "
            "robocek.yaml not found."
        )
        raise typer.Exit(code=1)

    boards_dir = PROJECT_ROOT / "boards"

    try:
        board = load_board(
            project.board,
            boards_dir
        )

    except FileNotFoundError:
        console.print(
            f"[bold red]Error:[/bold red] "
            f"Board '{project.board}' not found."
        )
        raise typer.Exit(code=1)

    output = (
        project_dir
        / "generated"
        / "robocek_config.h"
    )

    generate_project_config(
        project_dir,
        board
    )

    console.print(
        f"[bold green]✓ Configuration generated[/bold green]"
    )

    console.print(
        f"  Board: {board.name}"
    )

    console.print(
        f"  File : {output}"
    )
@board_app.command("list")
def board_list():
    """List all available ROBOCEK boards."""
    boards_dir = PROJECT_ROOT / "boards"
    if not boards_dir.exists():
        console.print(
            "[bold red]Error:[/bold red] "
            "Boards directory not found."
        )
        return
    boards = []

    for board_dir in boards_dir.iterdir():
        if not board_dir.is_dir():
            continue
        board_file = board_dir / "board.yaml"
        if board_file.exists():
            boards.append(board_dir.name)
    console.print()
    console.print("[bold cyan]Available ROBOCEK Boards[/bold cyan]")
    if not boards:
        console.print("[yellow]No boards found.[/yellow]")
        return
    for board_id in sorted(boards):
        try:
            board = load_board(
                board_id,
                boards_dir
            )

            console.print(
                f"[bold green]{board.id}[/bold green]"
            )

            console.print(
                f"  {board.name}"
            )

            console.print()

        except Exception as error:

            console.print(
                f"[red]{board_id} - Error: {error}[/red]"
            )

@board_app.command("info")
def board_info(
    board_id: str = typer.Argument(
        ...,
        help="Board ID."
    )
):
    """Show detailed information about a ROBOCEK board."""

    boards_dir = PROJECT_ROOT / "boards"

    try:

        board = load_board(
            board_id,
            boards_dir
        )

    except FileNotFoundError:

        console.print(
            f"[bold red]Error:[/bold red] "
            f"Board '{board_id}' not found."
        )

        raise typer.Exit(code=1)

    console.print()

    console.print(
        f"[bold cyan]{board.name}[/bold cyan]"
    )

    console.print(
        f"ID: {board.id}"
    )

    console.print()

    # MCU
    console.print(
        "[bold yellow]MCU[/bold yellow]"
    )

    mcu = board.mcu

    for key, value in mcu.items():

        console.print(
            f"  {key}: {value}"
        )

    console.print()

    # Motor
    motor = board.motor

    console.print(
        "[bold yellow]MOTOR[/bold yellow]"
    )

    console.print(
        f"  Driver: {motor.get('driver', 'Unknown')}"
    )

    console.print(
        f"  Standby: GPIO{motor.get('standby', 'N/A')}"
    )

    left = motor.get("left", {})
    right = motor.get("right", {})

    console.print(
        "  Left:"
    )

    console.print(
        f"    PWM: GPIO{left.get('pwm', 'N/A')}"
    )

    console.print(
        f"    IN1: GPIO{left.get('in1', 'N/A')}"
    )

    console.print(
        f"    IN2: GPIO{left.get('in2', 'N/A')}"
    )

    console.print(
        "  Right:"
    )

    console.print(
        f"    PWM: GPIO{right.get('pwm', 'N/A')}"
    )

    console.print(
        f"    IN1: GPIO{right.get('in1', 'N/A')}"
    )

    console.print(
        f"    IN2: GPIO{right.get('in2', 'N/A')}"
    )

    console.print()

    # Communication
    communication = board.data.get(
        "communication",
        {}
    )

    console.print(
        "[bold yellow]COMMUNICATION[/bold yellow]"
    )

    if communication:

        for key, value in communication.items():

            if isinstance(value, bool):
                value = "Yes" if value else "No"

            console.print(
                f"  {key}: {value}"
            )

    else:

        console.print(
            "  None configured"
        )

    console.print()

    # I2C
    i2c = board.data.get("i2c")

    if i2c:

        console.print(
            "[bold yellow]I2C[/bold yellow]"
        )

        console.print(
            f"  SDA: GPIO{i2c.get('sda', 'N/A')}"
        )

        console.print(
            f"  SCL: GPIO{i2c.get('scl', 'N/A')}"
        )

        console.print()  
if __name__ == "__main__":
    app()   