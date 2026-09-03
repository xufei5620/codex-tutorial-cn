#!/usr/bin/env python3
"""Strict, non-mutating release checks for the generated tutorial artifacts."""

import argparse
import hashlib
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parent.parent
STATUS_ZH = {"draft": "草稿", "outline": "大纲", "reviewed": "已复核"}
EXCLUDED_PUBLIC_PARTS = {".git", "src", "downloads", "__pycache__"}
RUNTIME_TAGS = {"link", "img", "script", "iframe", "source", "audio", "video", "track", "object", "embed"}
EXTERNAL_SCHEMES = ("http://", "https://", "mailto:", "tel:")


def configure_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(errors="backslashreplace")


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def safe_relative(value: str) -> bool:
    normalized = value.replace("\\", "/")
    parts = normalized.split("/")
    return (
        bool(normalized)
        and not normalized.startswith("/")
        and not re.match(r"^[A-Za-z]:", normalized)
        and all(part not in ("", ".", "..") for part in parts)
    )


def checksum_records(payload: str) -> dict[str, str]:
    records = {}
    for line in payload.splitlines():
        if not line:
            continue
        try:
            digest, relative = line.split("  ", 1)
        except ValueError:
            raise ValueError(f"invalid checksum line: {line!r}") from None
        if relative in records:
            raise ValueError(f"duplicate checksum path: {relative}")
        records[relative] = digest
    return records


def public_html_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.html"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def check_site_tree(root: Path, chapter_config: dict | None = None) -> tuple[list[str], int, int]:
    errors = []
    pages = public_html_files(root)
    ids_cache: dict[Path, list[str]] = {}

    def ids_of(path: Path) -> list[str]:
        if path not in ids_cache:
            ids_cache[path] = re.findall(r'\bid="([^"]+)"', path.read_text(encoding="utf-8"))
        return ids_cache[path]

    link_total = 0
    for path in pages:
        source = path.read_text(encoding="utf-8")
        relative = path.relative_to(root).as_posix()
        if re.search(r"<script\b", source, re.I):
            errors.append(f"{relative}: contains script")
        if re.search(r"\sstyle\s*=", source, re.I):
            errors.append(f"{relative}: contains inline style attribute")
        for match in re.finditer(
            r'<([A-Za-z][\w:-]*)\b[^>]*\b(href|src|data|poster)="([^"]+)"',
            source,
            re.I,
        ):
            tag = match.group(1).lower()
            value = html.unescape(match.group(3)).strip()
            if tag in RUNTIME_TAGS and value.startswith(("http://", "https://", "//")):
                errors.append(f"{relative}: remote runtime resource in {tag}")
        for match in re.finditer(r'\bhref="([^"]+)"', source, re.I):
            href = html.unescape(match.group(1)).strip()
            if not href or href.startswith(EXTERNAL_SCHEMES):
                continue
            link_total += 1
            link_path, _, fragment = href.partition("#")
            if not link_path:
                target = path
            elif link_path == "/":
                target = root / "index.html"
            elif link_path.startswith("/"):
                target = root / link_path.lstrip("/")
            else:
                target = path.parent / link_path
            try:
                resolved = target.resolve()
                resolved.relative_to(root.resolve())
            except ValueError:
                errors.append(f"{relative}: local link escapes public root: {href}")
                continue
            if resolved.is_dir():
                resolved = resolved / "index.html"
            if not resolved.exists():
                errors.append(f"{relative}: broken local link: {href}")
                continue
            if fragment and resolved.suffix.lower() == ".html" and fragment not in ids_of(resolved):
                errors.append(f"{relative}: missing anchor: {href}")

        ids = ids_of(path)
        duplicates = sorted({value for value in ids if ids.count(value) > 1})
        if duplicates:
            errors.append(f"{relative}: duplicate ids: {duplicates}")
        navigation = re.search(r'<nav class="section-nav".*?</nav>', source, re.S)
        if navigation:
            targets = re.findall(r'href="#([^"]+)"', navigation.group(0))
            sections = re.findall(r'<section\b[^>]*\bid="([^"]+)"', source)
            if targets != sections:
                errors.append(f"{relative}: section navigation does not match section ids")

        if chapter_config and path.parent == root:
            chapter_match = re.fullmatch(r"ch(\d{2})\.html", path.name)
            if chapter_match:
                chapter_id = f"ch{chapter_match.group(1)}"
                wanted = chapter_config["chapters"][chapter_id]["status"]
                badge = re.search(
                    r'<p class="kicker">第 \d+ 章 <span class="badge (\w+)">([^<]+)</span>',
                    source,
                )
                if not badge:
                    errors.append(f"{relative}: chapter badge missing")
                elif badge.group(1) != wanted or badge.group(2) != STATUS_ZH.get(wanted, wanted):
                    errors.append(f"{relative}: chapter badge differs from chapters.json")
    return errors, len(pages), link_total


def check_manifest(root: Path) -> list[str]:
    errors = []
    try:
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        sums = checksum_records((root / "SHA256SUMS.txt").read_text(encoding="utf-8"))
    except Exception as error:
        return [f"manifest/checksum cannot be read: {error}"]
    records = manifest.get("files")
    if not isinstance(records, list):
        return ["manifest files must be an array"]
    declared = []
    for record in records:
        relative = record.get("path") if isinstance(record, dict) else None
        if not isinstance(relative, str) or not safe_relative(relative):
            errors.append(f"manifest has unsafe path: {relative!r}")
            continue
        declared.append(relative)
        target = root.joinpath(*relative.split("/"))
        if not target.is_file():
            errors.append(f"manifest file missing: {relative}")
            continue
        payload = target.read_bytes()
        digest = sha256(payload)
        if record.get("size") != len(payload) or record.get("sha256") != digest:
            errors.append(f"manifest size/hash mismatch: {relative}")
        if sums.get(relative) != digest:
            errors.append(f"checksum mismatch: {relative}")
    if len(declared) != len(set(declared)):
        errors.append("manifest contains duplicate paths")
    if set(sums) != set(declared):
        errors.append("manifest and SHA256SUMS path sets differ")
    return errors


def check_registry(root: Path, strict: bool) -> tuple[list[str], list[str]]:
    errors, warnings = [], []
    try:
        import jsonschema
    except ImportError:
        message = "jsonschema is unavailable; install requirements-dev.txt"
        (errors if strict else warnings).append(message)
        return errors, warnings
    try:
        registry = json.loads((root / "registry/framework-v1.json").read_text(encoding="utf-8"))
        schema = json.loads((root / "schemas/framework-v1.schema.json").read_text(encoding="utf-8"))
        jsonschema.Draft202012Validator(schema).validate(registry)
    except Exception as error:
        errors.append(f"registry schema validation failed: {getattr(error, 'message', error)}")
    return errors, warnings


def check_offline_zip(root: Path, chapter_config: dict) -> list[str]:
    errors = []
    version = chapter_config["site"]["version"]
    archive = root / "downloads" / f"codex-tutorial-cn-v{version}-offline.zip"
    checksum_path = archive.with_name(archive.name + ".sha256")
    if not archive.is_file():
        return [f"ZIP missing: {archive.name}"]
    try:
        checksum = checksum_records(checksum_path.read_text(encoding="ascii"))
    except Exception as error:
        errors.append(f"ZIP checksum cannot be read: {error}")
        checksum = {}
    if checksum.get(archive.name) != sha256(archive.read_bytes()):
        errors.append("ZIP external checksum mismatch")

    prefix = "codex-tutorial-cn/"
    try:
        with zipfile.ZipFile(archive) as package:
            names = package.namelist()
            if len(names) != len(set(names)):
                errors.append("ZIP contains duplicate paths")
            for name in names:
                if not name.startswith(prefix) or not safe_relative(name):
                    errors.append(f"ZIP has unsafe path: {name}")
            files = {
                name[len(prefix):]
                for name in names
                if name.startswith(prefix) and not name.endswith("/")
            }
            manifest = json.loads(package.read(prefix + "manifest.json").decode("utf-8"))
            sums = checksum_records(package.read(prefix + "SHA256SUMS.txt").decode("utf-8"))
            payload_paths = files - {"manifest.json", "SHA256SUMS.txt"}
            records = manifest.get("files", [])
            declared = {record.get("path") for record in records if isinstance(record, dict)}
            if declared != payload_paths or set(sums) != payload_paths:
                errors.append("manifest/checksum file set differs from ZIP payload")
            for record in records:
                relative = record.get("path")
                if relative not in payload_paths:
                    continue
                payload = package.read(prefix + relative)
                digest = sha256(payload)
                if (
                    record.get("size") != len(payload)
                    or record.get("sha256") != digest
                    or sums.get(relative) != digest
                ):
                    errors.append(f"manifest/checksum mismatch: {relative}")
            if not errors:
                with tempfile.TemporaryDirectory(prefix="codex-tutorial-check-") as directory:
                    package.extractall(directory)
                    link_errors, _, _ = check_site_tree(Path(directory) / "codex-tutorial-cn")
                    errors.extend(link_errors)
    except Exception as error:
        errors.append(f"ZIP cannot be validated: {error}")
    return errors


def generated_paths(root: Path) -> set[str]:
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    paths = {record["path"] for record in manifest["files"]}
    paths.update({"manifest.json", "SHA256SUMS.txt"})
    paths.update(path.relative_to(root).as_posix() for path in (root / "downloads").glob("*"))
    return paths


def check_generated_sync(root: Path) -> list[str]:
    errors = []
    with tempfile.TemporaryDirectory(prefix="codex-tutorial-rebuild-") as directory:
        candidate = Path(directory) / "repo"
        shutil.copytree(
            root,
            candidate,
            ignore=shutil.ignore_patterns(".git", ".venv", "__pycache__", "*.pyc", "preview.html"),
        )
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env["PYTHONUTF8"] = "1"
        result = subprocess.run(
            [sys.executable, "src/build.py"],
            cwd=candidate,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if result.returncode:
            return ["generated verification rebuild failed"]
        try:
            expected_paths = generated_paths(root)
            actual_paths = generated_paths(candidate)
        except Exception as error:
            return [f"generated file inventory cannot be read: {error}"]
        if expected_paths != actual_paths:
            errors.append("generated file sets differ from source build")
        for relative in sorted(expected_paths & actual_paths):
            expected = root.joinpath(*relative.split("/")).read_bytes()
            actual = candidate.joinpath(*relative.split("/")).read_bytes()
            if expected != actual:
                errors.append(f"generated output differs from source build: {relative}")
    return errors


def main() -> int:
    configure_output()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="require JSON Schema validation")
    parser.add_argument("--verify-generated", action="store_true", help="rebuild in a temporary copy and compare bytes")
    arguments = parser.parse_args()

    config = json.loads((ROOT / "src/chapters.json").read_text(encoding="utf-8"))
    errors, warnings = [], []
    site_errors, page_count, link_count = check_site_tree(ROOT, config)
    errors.extend(site_errors)
    errors.extend(f"manifest: {message}" for message in check_manifest(ROOT))
    registry_errors, registry_warnings = check_registry(ROOT, arguments.strict)
    errors.extend(registry_errors)
    warnings.extend(registry_warnings)
    errors.extend(f"offline: {message}" for message in check_offline_zip(ROOT, config))
    if arguments.verify_generated:
        errors.extend(check_generated_sync(ROOT))

    print(f"checked {page_count} HTML pages and {link_count} local links")
    for warning in warnings:
        print(f"[WARN] {warning}")
    for error in errors:
        print(f"[ERROR] {error}")
    if errors:
        print(f"[ERROR] release checks failed: {len(errors)} issue(s)")
        return 1
    print("[OK] all requested release checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
