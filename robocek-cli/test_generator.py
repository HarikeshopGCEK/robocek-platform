from pathlib import Path

from robocek.board import load_board
from robocek.generator import generate_motor_config


ROOT = Path(__file__).resolve().parent / "robocek"

boards_dir = ROOT / "boards"

board = load_board(
    "robocek-esp32-v1",
    boards_dir
)

output = ROOT / "examples" / "motor-test" / "generated" / "robocek_config.h"

generate_motor_config(
    board,
    output
)

print("Generated:", output)