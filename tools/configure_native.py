"""Validate the existing Android host and themes without regenerating the UI.

Usage (from any working directory):
    python tools/configure_native.py          # Read-only validation (default).
    python tools/configure_native.py --check  # The same read-only validation.
    python tools/configure_native.py --format # Validate, then format existing XML.

The former generator overwrote hand-edited layouts with an obsolete five-tab
host. This script never generates views, labels, colors, or theme definitions.
It exits with status 1 for a missing/invalid resource or a broken host contract.
"""
# Chỉ kiểm tra host và theme Android đã có, không sinh lại giao diện.

import argparse
from pathlib import Path
import sys
import tempfile
from xml.dom import Node, minidom
from xml.parsers.expat import ExpatError


ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "app/src/main/res"
ANDROID_NS = "http://schemas.android.com/apk/res/android"
RESOURCE_PATHS = (
    RES / "layout/activity_main.xml",
    RES / "values/themes.xml",
    RES / "values-night/themes.xml",
)
TABS = ("home", "explore", "messages", "profile")
HOST_IDS = (
    "main", "top_app_bar", "back_button", "top_logo", "top_title",
    "top_actions", "screen_container", "bottom_nav_container",
    "bottom_navigation", "nav_create", "top_btn_friends",
    "top_btn_notifications", "top_btn_scanner",
) + tuple(f"nav_{tab}{suffix}" for tab in TABS for suffix in ("", "_icon", "_label", "_dot"))
DESTINATIONS = {
    **{f"nav_{tab}": tab for tab in TABS},
    "nav_create": "create_post",
    "top_btn_friends": "friends",
    "top_btn_notifications": "notifications",
    "top_btn_scanner": "scanner",
}


def validate_host(document):
    """Check views used directly and dynamically by MainActivity."""
    errors = []
    views = {}
    for element in document.getElementsByTagName("*"):
        resource_id = element.getAttributeNS(ANDROID_NS, "id")
        if not resource_id.startswith(("@+id/", "@id/")):
            continue
        name = resource_id.partition("/")[2]
        if name in views:
            errors.append(f"duplicate view ID: {name}")
        views[name] = element
    missing = sorted(set(HOST_IDS) - views.keys())
    if missing:
        errors.append("missing host IDs: " + ", ".join(missing))
    for name, destination in DESTINATIONS.items():
        if name in views and views[name].getAttributeNS(ANDROID_NS, "tag") != f"screen:{destination}":
            errors.append(f"{name} must have android:tag=\"screen:{destination}\"")
    for name in ("top_title",) + tuple(f"nav_{tab}_label" for tab in TABS):
        if name in views and views[name].tagName.rsplit(".", 1)[-1] not in ("TextView", "MaterialTextView", "AppCompatTextView"):
            errors.append(f"{name} must be a TextView")
    for tab in TABS:
        name = f"nav_{tab}_icon"
        if name in views and views[name].tagName.rsplit(".", 1)[-1] not in ("ImageView", "AppCompatImageView"):
            errors.append(f"{name} must be an ImageView")
    return errors


def validate_theme(document):
    errors = []
    if document.documentElement.tagName != "resources":
        return ["theme root must be <resources>"]
    styles = [node.getAttribute("name") for node in document.getElementsByTagName("style")]
    for name in ("Base.Theme.RecyclingShareApp", "Theme.RecyclingShareApp"):
        if styles.count(name) != 1:
            errors.append(f"expected exactly one style named {name}")
    return errors


def format_xml(document):
    """Keep elements, attributes, namespaces, comments, and resource text."""
    document = document.cloneNode(deep=True)

    def remove_indentation(node):
        # Resource values with meaningful text are left intact, including spaces.
        if any(child.nodeType in (Node.TEXT_NODE, Node.CDATA_SECTION_NODE)
               and child.data.strip() for child in node.childNodes):
            return
        for child in list(node.childNodes):
            if child.nodeType == Node.TEXT_NODE and not child.data.strip():
                node.removeChild(child)
                child.unlink()
            else:
                remove_indentation(child)

    remove_indentation(document)
    return document.toprettyxml(indent="    ", encoding="utf-8")


def write_if_changed(path, content):
    if path.read_bytes() == content:
        return False
    # Replace each complete file atomically rather than truncate it in place.
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return True


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Validate only; do not modify files (default).")
    mode.add_argument("--format", action="store_true", help="Validate, then format the three existing XML files.")
    args = parser.parse_args(argv)
    documents = {}
    errors = []
    for path in RESOURCE_PATHS:
        label = path.relative_to(ROOT).as_posix()
        try:
            document = minidom.parseString(path.read_bytes())
            documents[path] = document
            validator = validate_host if path.name == "activity_main.xml" else validate_theme
            errors.extend(f"{label}: {error}" for error in validator(document))
        except (OSError, ExpatError) as error:
            errors.append(f"{label}: {error}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    if args.format:
        try:
            changed = sum(write_if_changed(path, format_xml(document)) for path, document in documents.items())
        except OSError as error:
            print(f"ERROR: could not format XML: {error}", file=sys.stderr)
            return 1
        print(f"Native resources valid; formatted {changed} file(s).")
    else:
        print("Native resources valid; 3 XML files checked, no files changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
