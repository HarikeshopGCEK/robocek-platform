from pathlib import Path
import yaml


class Board:

    def __init__(self, board_id: str, data: dict):
        self.id = board_id
        self.data = data

    @property
    def name(self):
        return self.data.get("name", self.id)

    @property
    def mcu(self):
        return self.data.get("mcu", {})

    @property
    def motor(self):
        return self.data.get("motor", {})


def load_board(board_id: str, boards_dir: Path) -> Board:

    board_file = boards_dir / board_id / "board.yaml"

    if not board_file.exists():
        raise FileNotFoundError(
            f"Board '{board_id}' not found."
        )

    with open(board_file, "r", encoding="utf-8") as file:
        data = yaml.safe_load(file)

    return Board(board_id, data)