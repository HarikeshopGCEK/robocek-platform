import typer
from rich.console import Console

app = typer.Typer(
    name="robocek",
    help="ROBOCEK Embedded Robotics Development Platform"
)

console = Console()


@app.command()
def version():
    """Show ROBOCEK Platform version."""
    console.print("[bold green]ROBOCEK Platform[/bold green] v0.1.0")


@app.command()
def hello():
    """Test the ROBOCEK CLI."""
    console.print("[bold cyan]ROBOCEK Platform is working![/bold cyan]")


if __name__ == "__main__":
    app()