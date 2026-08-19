from pathlib import Path

from robocek.board import load_board


ROOT = Path(__file__).resolve().parents[1]

boards_dir = ROOT / "boards"

board = load_board(
    "robocek-esp32-v1",
    boards_dir
)

print("Board:", board.name)
print("MCU:", board.mcu)
print("Motor:", board.motor)