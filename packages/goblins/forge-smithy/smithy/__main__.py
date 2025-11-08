"""Allow `python -m smithy ...` to invoke the Typer CLI."""

from smithy.cli import app


def main() -> None:
    app()


if __name__ == "__main__":
    main()
