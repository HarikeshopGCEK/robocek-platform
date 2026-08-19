from pathlib import Path
import yaml


class Project:

    def __init__(self, path: Path):
        self.path = path

        config_file = path / "robocek.yaml"

        if not config_file.exists():
            raise FileNotFoundError(
                "robocek.yaml not found."
            )

        with open(config_file, "r", encoding="utf-8") as file:
            self.config = yaml.safe_load(file)

    @property
    def board(self):
        return self.config["board"]