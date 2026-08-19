from pathlib import Path
import shutil
import subprocess
import serial.tools.list_ports
import typer
from rich.console import Console
from .board import load_board
from .generator import generate_motor_config
from .project import Project
from .generator import generate_project_config

app = typer.Typer(
    name="robocek",
    help="ROBOCEK Embedded Robotics Development Platform"
)

console = Console()


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEMPLATES_DIR = PROJECT_ROOT / "templates"


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
    project_name: str = typer.Argument(
        ...,
        help="Name of the project to create."
    )
):
    """Create a new ROBOCEK project."""

    destination = Path.cwd() / project_name
    template = TEMPLATES_DIR / "esp32-basic"

    if destination.exists():
        console.print(
            f"[bold red]Error:[/bold red] "
            f"Project '{project_name}' already exists."
        )
        raise typer.Exit(code=1)

    if not template.exists():
        console.print(
            "[bold red]Error:[/bold red] "
            "ESP32 template not found."
        )
        raise typer.Exit(code=1)

    console.print(
        f"Creating ROBOCEK project "
        f"[bold cyan]{project_name}[/bold cyan]..."
    )

    shutil.copytree(template, destination)

    console.print()
    console.print("[bold green]✓ Project created successfully![/bold green]")
    console.print()
    console.print(f"  Project : {project_name}")
    console.print("  Board   : ESP32")
    console.print("  Framework: Arduino")
    console.print()
    console.print("Next:")
    console.print(f"  cd {project_name}")
    console.print("  robocek build")

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
            f"{board.name}"
        )

        console.print(
            f"[bold green]✓ Configuration:[/bold green] "
            f"{output}"
        )

    except Exception as error:

        console.print(
            "[bold red]Configuration failed:[/bold red]"
        )

        console.print(
            f"  {error}"
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
            f"{board.name}"
        )

    except Exception as error:

        console.print(
            "[bold red]Configuration failed:[/bold red]"
        )

        console.print(
            f"  {error}"
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

    generate_motor_config(
        board,
        output
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
    
if __name__ == "__main__":
    app()   