# -*- coding: utf-8 -*-
"""
Генератор structura.txt — снимок содержимого папки.
- Пропускает картинки/бинарники (по расширению и по содержимому).
- Пропускает служебные папки (venv, node_modules, .git, ...).
- Файлы *.obf.js не читаются: вместо содержимого пишется заглушка.
- В конце — дерево «СТРУКТУРА САЙТА».
"""
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Users\User\Desktop\Файлы бориса\BHSWEB")
OUTPUT = ROOT / "structura.txt"

# Что не включаем в отчёт (расширения)
SKIP_EXT = {
    # картинки
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
    '.tif', '.tiff', '.psd', '.heic', '.avif', '.raw', '.cr2', '.nef',
    # медиа
    '.mp3', '.wav', '.flac', '.ogg', '.mp4', '.avi', '.mov', '.mkv', '.webm',
    # архивы
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
    # бинарники / сборка
    '.exe', '.dll', '.so', '.dylib', '.bin', '.iso', '.dmg',
    '.pyc', '.pyo', '.class', '.o', '.a', '.lib',
    # документы
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    # шрифты
    '.ttf', '.otf', '.woff', '.woff2',
}

# Папки, которые не обходим
SKIP_DIRS = {
    'venv', '.venv', 'env', '.env', '__pycache__',
    'node_modules', '.git', '.idea', '.vscode',
    'dist', 'build', '.pytest_cache', '.mypy_cache',
}

# Файлы, которые не пересканируем (в т.ч. сам отчёт)
SKIP_FILES = {OUTPUT.name}

SEP = "=" * 80
LINE = "-" * 80

# Заглушка для обфусцированных файлов
OBF_SUFFIX = ".obf.js"
OBF_STUB = (
    "Дальше зашифровано не стал писать т.к. код будет огромный "
    "лучше посмотри исходник в мусорке\n"
)


def is_obfuscated(path: Path) -> bool:
    return path.name.endswith(OBF_SUFFIX)


def is_binary(path: Path) -> bool:
    """Грубая, но надёжная проверка: есть ли нулевой байт в начале."""
    try:
        with open(path, 'rb') as f:
            return b'\x00' in f.read(4096)
    except OSError:
        return True


def should_skip(path: Path) -> bool:
    if path.name in SKIP_FILES:
        return True
    if path.suffix.lower() in SKIP_EXT:
        return True
    return is_binary(path)


def fmt_size(n: int) -> str:
    units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
    s = float(n)
    for u in units:
        if s < 1024 or u == units[-1]:
            return f"{int(s)} {u}" if u == 'Б' else f"{s:.1f} {u}"
        s /= 1024
    return f"{n} Б"


def write_tree(f, folder: Path, prefix: str = ""):
    try:
        items = sorted(folder.iterdir(),
                       key=lambda p: (p.is_file(), p.name.lower()))
    except PermissionError:
        return

    items = [i for i in items
             if i.name not in SKIP_DIRS and i.name not in SKIP_FILES]
    items = [i for i in items if i.is_dir() or not should_skip(i)]

    for idx, item in enumerate(items):
        last = idx == len(items) - 1
        branch = "└── " if last else "├── "
        pad = "    " if last else "│   "
        if item.is_dir():
            f.write(f"{prefix}{branch}📁 {item.name}/\n")
            write_tree(f, item, prefix + pad)
        else:
            try:
                size = fmt_size(item.stat().st_size)
            except OSError:
                size = "?"
            f.write(f"{prefix}{branch}📄 {item.name}  ({size})\n")


def main() -> int:
    if not ROOT.exists():
        print(f"Папка не найдена: {ROOT}", file=sys.stderr)
        return 1

    with open(OUTPUT, 'w', encoding='utf-8') as f:
        # Шапка
        f.write(SEP + "\n")
        f.write(f"ПАПКА: {ROOT}\n")
        f.write(SEP + "\n\n")

        # Содержимое файлов
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
            files = sorted(fn for fn in filenames
                           if not should_skip(Path(dirpath) / fn))
            for fn in files:
                full = Path(dirpath) / fn
                f.write(f"ФАЙЛ: {full}\n")
                f.write(LINE + "\n")

                if is_obfuscated(full):
                    # Не читаем обфусцированный файл — пишем заглушку
                    content = OBF_STUB
                else:
                    try:
                        with open(full, 'r', encoding='utf-8',
                                  errors='replace') as src:
                            content = src.read()
                    except OSError as e:
                        content = f"[не удалось прочитать: {e}]\n"

                f.write(content)
                if not content.endswith('\n'):
                    f.write('\n')
                f.write(LINE + "\n\n")

        # Красивое дерево внизу
        f.write("\n" + SEP + "\n")
        f.write("СТРУКТУРА САЙТА\n")
        f.write(SEP + "\n\n")
        f.write(f"{ROOT.name}/\n")
        write_tree(f, ROOT)
        f.write("\n" + SEP + "\n")

    print(f"Готово: {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())