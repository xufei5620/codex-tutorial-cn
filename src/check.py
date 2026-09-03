#!/usr/bin/env python3
"""Strict, non-mutating release checks for the generated tutorial artifacts."""

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile


ROOT = Path(__file__).resolve().parent.parent
STATUS_ZH = {"draft": "草稿", "outline": "大纲", "reviewed": "已复核"}
EXCLUDED_PUBLIC_PARTS = {".git", ".github", ".venv", "src", "tests", "downloads", "__pycache__"}
URL_ATTRIBUTES = {
    "archive",
    "background",
    "cite",
    "code",
    "codebase",
    "data",
    "href",
    "icon",
    "longdesc",
    "manifest",
    "poster",
    "profile",
    "src",
    "srcset",
    "usemap",
    "xlink:href",
}
EXTERNAL_SCHEMES = ("http://", "https://", "mailto:", "tel:")
EMBEDDED_SCHEMES = ("data:",)
UNSAFE_SCHEMES = ("javascript:", "vbscript:")
EXTERNAL_NAVIGATION = {("a", "href")}
FORBIDDEN_ELEMENTS = {"applet", "base", "embed", "fencedframe", "frame", "frameset", "iframe", "object", "portal", "script"}
FORBIDDEN_ATTRIBUTES = {"action", "formaction", "ping", "srcdoc"}
DATA_URL_MEDIA = {
    ("audio", "src"),
    ("image", "href"),
    ("image", "xlink:href"),
    ("img", "src"),
    ("source", "src"),
    ("track", "src"),
    ("video", "src"),
}
MANAGED_ROOT_FILES = {
    "404.html",
    "README.md",
    "index.html",
    "maintenance-release.html",
    "notion-workflow.html",
    "robots.txt",
    "source-research.html",
}
MANAGED_ROOT_DIRECTORIES = {"assets", "deploy", "registry", "schemas", "specs", "templates"}
MANAGED_METADATA = {"manifest.json", "SHA256SUMS.txt"}
DEVELOPER_ROOT_ENTRIES = {
    ".dockerignore",
    ".git",
    ".gitattributes",
    ".github",
    ".gitignore",
    ".venv",
    "__pycache__",
    "requirements-dev.txt",
    "src",
    "tests",
}


def is_remote_url(value: str) -> bool:
    return value.strip().lower().startswith(("http://", "https://", "//"))


def srcset_urls(value: str) -> list[str]:
    return [candidate.strip().split()[0] for candidate in value.split(",") if candidate.strip()]


def normalize_css(source: str) -> str:
    source = re.sub(r"/\*.*?\*/", "", source, flags=re.S)

    def decode_escape(match: re.Match) -> str:
        if match.group(1):
            try:
                return chr(int(match.group(1), 16))
            except (ValueError, OverflowError):
                return ""
        return match.group(2) or ""

    return re.sub(r"\\(?:([0-9a-fA-F]{1,6})\s?|([^\r\n\f]))", decode_escape, source)


def css_urls(source: str) -> list[str]:
    source = normalize_css(source)
    values = []
    for match in re.finditer(
        r"url\(\s*(?:([\"'])(.*?)\1|([^\"')\s]+))\s*\)",
        source,
        flags=re.I | re.S,
    ):
        values.append(match.group(2) or match.group(3))
    return values


def contains_external_url(value: str) -> bool:
    return re.search(r"(?i)https?://|(?:^|[\s\"'(=,;])//|(?:mailto|tel):", value) is not None


class HTMLAuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.references: list[tuple[str, str, str]] = []
        self.embedded_styles: list[str] = []
        self._style_chunks: list[str] | None = None
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._audit_tag(tag, attrs)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._audit_tag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "style" and self._style_chunks is not None:
            self.embedded_styles.append("".join(self._style_chunks))
            self._style_chunks = None

    def close(self) -> None:
        super().close()
        if self._style_chunks is not None:
            self.embedded_styles.append("".join(self._style_chunks))
            self.errors.append("contains unclosed style element")
            self._style_chunks = None

    def handle_data(self, data: str) -> None:
        if self._style_chunks is not None:
            self._style_chunks.append(data)

    def handle_pi(self, data: str) -> None:
        if re.match(r"(?i)\s*xml-stylesheet\b", data):
            self.errors.append("contains xml-stylesheet processing instruction")

    def _audit_tag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {
            raw_name.lower(): html.unescape(raw_value or "").strip()
            for raw_name, raw_value in attrs
        }
        if tag in FORBIDDEN_ELEMENTS:
            self.errors.append(f"contains forbidden {tag} element")
        if tag == "style":
            self._style_chunks = []
        if tag == "meta" and attributes.get("http-equiv", "").lower() == "refresh":
            self.errors.append("contains meta refresh")
        for raw_name, raw_value in attrs:
            name = raw_name.lower()
            value = html.unescape(raw_value or "").strip()
            if name == "id" and value:
                self.ids.append(value)
            if name in URL_ATTRIBUTES - {"srcset"}:
                self.references.append((tag, name, value))
            elif name == "srcset":
                self.references.extend((tag, name, candidate) for candidate in srcset_urls(value))
            if name == "style":
                self.errors.append("contains inline style attribute")
            if name.startswith("on"):
                self.errors.append(f"contains inline event handler: {name}")
            if name in FORBIDDEN_ATTRIBUTES:
                self.errors.append(f"contains forbidden attribute {tag}[{name}]")
            if not name.startswith("xmlns") and contains_external_url(value):
                direct_external_navigation = (
                    (tag, name) in EXTERNAL_NAVIGATION
                    and (is_remote_url(value) or value.lower().startswith(("mailto:", "tel:")))
                )
                if not direct_external_navigation:
                    self.errors.append(f"external URL is not allowed in {tag}[{name}]")
            if name in URL_ATTRIBUTES:
                candidates = srcset_urls(value) if name == "srcset" else [value]
                for candidate in candidates:
                    lower = candidate.lower()
                    if lower.startswith(EMBEDDED_SCHEMES) and (tag, name) not in DATA_URL_MEDIA:
                        self.errors.append(f"data URL is not allowed in {tag}[{name}]")


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
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".htm", ".xhtml"}:
            continue
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def public_css_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.css"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def public_svg_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*.svg"):
        relative = path.relative_to(root)
        if any(part in EXCLUDED_PUBLIC_PARTS for part in relative.parts):
            continue
        files.append(path)
    return sorted(files)


def parse_html(path: Path) -> HTMLAuditParser:
    parser = HTMLAuditParser()
    parser.feed(path.read_text(encoding="utf-8"))
    parser.close()
    return parser


def check_site_tree(
    root: Path,
    chapter_config: dict | None = None,
    *,
    allow_root_relative: bool = True,
) -> tuple[list[str], int, int]:
    errors = []
    pages = public_html_files(root)
    parser_cache: dict[Path, HTMLAuditParser] = {}

    def audit_of(path: Path) -> HTMLAuditParser:
        if path not in parser_cache:
            parser_cache[path] = parse_html(path)
        return parser_cache[path]

    def validate_reference(
        source_path: Path,
        relative: str,
        reference: str,
        context: str,
        *,
        check_fragment: bool,
    ) -> bool:
        reference = html.unescape(reference).strip()
        lower = reference.lower()
        if not reference or is_remote_url(reference) or lower.startswith(EXTERNAL_SCHEMES + EMBEDDED_SCHEMES):
            return False
        if lower.startswith(UNSAFE_SCHEMES):
            errors.append(f"{relative}: unsafe URL scheme in {context}: {reference}")
            return False
        try:
            parsed = urlsplit(reference)
        except ValueError as error:
            errors.append(f"{relative}: invalid URL in {context}: {reference} ({error})")
            return False
        if parsed.scheme:
            errors.append(f"{relative}: unsupported URL scheme in {context}: {reference}")
            return False
        link_path = unquote(parsed.path)
        fragment = unquote(parsed.fragment)
        if not link_path:
            if not check_fragment or not fragment:
                return True
            target = source_path
        elif link_path.startswith("/"):
            if not allow_root_relative:
                errors.append(f"{relative}: root-relative reference is not portable offline in {context}: {reference}")
                return True
            if link_path == "/":
                target = root / "index.html"
            else:
                target = root / link_path.lstrip("/")
        else:
            target = source_path.parent / link_path
        try:
            resolved = target.resolve()
            resolved.relative_to(root.resolve())
        except ValueError:
            errors.append(f"{relative}: local reference escapes public root in {context}: {reference}")
            return True
        if resolved.is_dir():
            resolved = resolved / "index.html"
        if not resolved.is_file():
            errors.append(f"{relative}: broken local reference in {context}: {reference}")
            return True
        if (
            check_fragment
            and fragment
            and resolved.suffix.lower() in {".html", ".svg"}
            and fragment not in audit_of(resolved).ids
        ):
            errors.append(f"{relative}: missing anchor in {context}: {reference}")
        return True

    def validate_css_references(source_path: Path, relative: str, source: str, context: str) -> None:
        normalized = normalize_css(source)
        if re.search(r"(?i)@import\b", normalized):
            errors.append(f"{relative}: CSS @import is not allowed in {context}")
        if contains_external_url(normalized):
            errors.append(f"{relative}: external URL is not allowed in {context}")
        for reference in css_urls(source):
            if is_remote_url(reference):
                errors.append(f"{relative}: remote {context} resource: {reference}")
                continue
            validate_reference(
                source_path,
                relative,
                reference,
                f"{context} resource",
                check_fragment=False,
            )

    def validate_audit_resources(path: Path, relative: str, audit: HTMLAuditParser) -> int:
        errors.extend(f"{relative}: {message}" for message in audit.errors)
        for embedded_style in audit.embedded_styles:
            validate_css_references(path, relative, embedded_style, "embedded CSS")
        checked_count = 0
        for tag, attribute, reference in audit.references:
            checked = validate_reference(
                path,
                relative,
                reference,
                f"{tag}[{attribute}]",
                check_fragment=attribute in {"href", "xlink:href"},
            )
            if checked:
                checked_count += 1
        return checked_count

    link_total = 0
    for path in pages:
        source = path.read_text(encoding="utf-8")
        relative = path.relative_to(root).as_posix()
        audit = audit_of(path)
        link_total += validate_audit_resources(path, relative, audit)

        ids = audit.ids
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

    for path in public_svg_files(root):
        relative = path.relative_to(root).as_posix()
        link_total += validate_audit_resources(path, relative, audit_of(path))

    for path in public_css_files(root):
        relative = path.relative_to(root).as_posix()
        source = path.read_text(encoding="utf-8")
        validate_css_references(path, relative, source, "CSS")
    return errors, len(pages), link_total


def managed_public_paths(root: Path, chapter_config: dict) -> set[str]:
    paths = set(MANAGED_ROOT_FILES)
    paths.update(f"{chapter_id}.html" for chapter_id in chapter_config["chapters"])
    paths.update(f"{extra_id}.html" for extra_id in chapter_config["extras"])
    paths.update(
        path.name
        for path in root.glob("ch[0-9][0-9].html")
        if path.is_file()
    )
    for directory_name in MANAGED_ROOT_DIRECTORIES:
        directory = root / directory_name
        if not directory.is_dir():
            continue
        paths.update(
            path.relative_to(root).as_posix()
            for path in directory.rglob("*")
            if path.is_file()
        )
    return paths


def check_public_root_inventory(root: Path, managed_paths: set[str]) -> list[str]:
    allowed = {relative.split("/", 1)[0] for relative in managed_paths}
    allowed.update(MANAGED_METADATA)
    allowed.add("downloads")
    errors = []
    for path in sorted(root.iterdir(), key=lambda item: item.name):
        if path.name in allowed or path.name in DEVELOPER_ROOT_ENTRIES:
            continue
        kind = "directory" if path.is_dir() else "file"
        errors.append(f"unknown publishable root entry ({kind}): {path.name}")
    return errors


def expected_download_paths(chapter_config: dict) -> set[str]:
    version = chapter_config["site"]["version"]
    archive_name = f"codex-tutorial-cn-v{version}-offline.zip"
    return {f"downloads/{archive_name}", f"downloads/{archive_name}.sha256"}


def check_download_inventory(root: Path, chapter_config: dict) -> list[str]:
    expected = expected_download_paths(chapter_config)
    downloads = root / "downloads"
    actual = set()
    if downloads.is_dir():
        actual.update(
            path.relative_to(root).as_posix()
            for path in downloads.rglob("*")
            if path.is_file()
        )
    errors = []
    for relative in sorted(actual - expected):
        errors.append(f"unexpected download artifact: {relative}")
    for relative in sorted(expected - actual):
        errors.append(f"expected download artifact missing: {relative}")
    return errors


def check_manifest(root: Path, expected_paths: set[str]) -> list[str]:
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
    declared_set = set(declared)
    if set(sums) != declared_set:
        errors.append("manifest and SHA256SUMS path sets differ")
    for relative in sorted(expected_paths - declared_set):
        errors.append(f"manifest omits managed file: {relative}")
    for relative in sorted(declared_set - expected_paths):
        errors.append(f"manifest declares unmanaged file: {relative}")
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
            online_only = payload_paths & {"404.html", "robots.txt"}
            if online_only:
                errors.append(f"ZIP contains online-only files: {sorted(online_only)}")
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
                    link_errors, _, _ = check_site_tree(
                        Path(directory) / "codex-tutorial-cn",
                        allow_root_relative=False,
                    )
                    errors.extend(link_errors)
    except Exception as error:
        errors.append(f"ZIP cannot be validated: {error}")
    return errors


def generated_paths(root: Path, chapter_config: dict) -> set[str]:
    paths = managed_public_paths(root, chapter_config)
    paths.update(MANAGED_METADATA)
    paths.update(expected_download_paths(chapter_config))
    downloads = root / "downloads"
    if downloads.is_dir():
        paths.update(
            path.relative_to(root).as_posix()
            for path in downloads.rglob("*")
            if path.is_file()
        )
    return paths


def check_generated_sync(root: Path, chapter_config: dict) -> list[str]:
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
            expected_paths = generated_paths(root, chapter_config)
            actual_paths = generated_paths(candidate, chapter_config)
        except Exception as error:
            return [f"generated file inventory cannot be read: {error}"]
        if expected_paths != actual_paths:
            errors.append("generated file sets differ from source build")
        for relative in sorted(expected_paths & actual_paths):
            expected_path = root.joinpath(*relative.split("/"))
            actual_path = candidate.joinpath(*relative.split("/"))
            if not expected_path.is_file() or not actual_path.is_file():
                errors.append(f"generated output missing from one tree: {relative}")
                continue
            expected = expected_path.read_bytes()
            actual = actual_path.read_bytes()
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
    expected_manifest_paths = managed_public_paths(ROOT, config)
    errors.extend(check_public_root_inventory(ROOT, expected_manifest_paths))
    errors.extend(check_download_inventory(ROOT, config))
    errors.extend(f"manifest: {message}" for message in check_manifest(ROOT, expected_manifest_paths))
    registry_errors, registry_warnings = check_registry(ROOT, arguments.strict)
    errors.extend(registry_errors)
    warnings.extend(registry_warnings)
    errors.extend(f"offline: {message}" for message in check_offline_zip(ROOT, config))
    if arguments.verify_generated:
        errors.extend(check_generated_sync(ROOT, config))

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
