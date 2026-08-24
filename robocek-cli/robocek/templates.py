from pathlib import Path
import yaml


class Template:

    def __init__(
        self,
        template_id: str,
        path: Path,
        data: dict
    ):
        self.id = template_id
        self.path = path
        self.data = data

    @property
    def name(self):
        return self.data.get(
            "name",
            self.id
        )

    @property
    def description(self):
        return self.data.get(
            "description",
            ""
        )

    @property
    def features(self):
        return self.data.get(
            "features",
            []
        )


def load_template(
    template_id: str,
    templates_dir: Path
):

    template_dir = (
        templates_dir
        / template_id
    )

    metadata = (
        template_dir
        / "template.yaml"
    )

    if not metadata.exists():
        raise FileNotFoundError(
            f"Template '{template_id}' not found."
        )

    with metadata.open(
        "r",
        encoding="utf-8"
    ) as file:

        data = yaml.safe_load(file)

    if not isinstance(data, dict):
        raise ValueError(
            f"Invalid template: {template_id}"
        )

    return Template(
        template_id,
        template_dir,
        data
    )