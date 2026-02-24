import os
import sys

def should_skip_directory(dirname):
    """Проверяем, нужно ли пропускать директорию"""
    skip_dirs = {
        '__pycache__', '.git', '.idea', '.vscode', 'venv', 'env',
        'node_modules', '.pytest_cache', '.mypy_cache', 'dist',
        'build', '.eggs', '*.egg-info', 'htmlcov', '.coverage'
    }
    return dirname in skip_dirs or dirname.startswith('.')

def get_file_content(filepath, max_lines=10000):
    """Получаем содержимое файла с ограничением по строкам"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = []
            for i, line in enumerate(f):
                if i >= max_lines:
                    lines.append(f"... и еще {sum(1 for _ in f)} строк ...")
                    break
                lines.append(line.rstrip('\n'))
            return lines
    except Exception as e:
        return [f"[Ошибка чтения файла: {e}]"]

def generate_structure(root_dir, output_file='project_structure.txt'):
    """Генерирует структуру проекта с содержимым файлов"""
    
    if not os.path.exists(root_dir):
        print(f"Директория {root_dir} не существует!")
        return
    
    with open(output_file, 'w', encoding='utf-8') as f:
        # Заголовок
        f.write(f"СТРУКТУРА ПРОЕКТА: {os.path.basename(root_dir)}\n")
        f.write("=" * 50 + "\n\n")
        
        # Рекурсивный обход директорий
        for root, dirs, files in os.walk(root_dir):
            # Фильтруем директории для пропуска
            dirs[:] = [d for d in dirs if not should_skip_directory(d)]
            
            # Вычисляем относительный путь для отображения
            rel_path = os.path.relpath(root, root_dir)
            if rel_path == '.':
                level = 0
                path_display = os.path.basename(root_dir) + '/'
            else:
                level = rel_path.count(os.sep) + 1
                path_display = '    ' * (level - 1) + '├── ' + os.path.basename(root) + '/'
            
            if level > 0:  # Не печатаем корневую директорию отдельно
                f.write(path_display + '\n')
            
            # Выводим файлы в текущей директории
            for i, filename in enumerate(sorted(files)):
                # Пропускаем некоторые файлы
                if filename.endswith('.pyc') or filename in ['.DS_Store', 'Thumbs.db']:
                    continue
                    
                filepath = os.path.join(root, filename)
                rel_filepath = os.path.relpath(filepath, root_dir)
                
                # Определяем символ для последнего файла
                is_last_file = (i == len(files) - 1) and (len([d for d in dirs if not should_skip_directory(d)]) == 0)
                prefix = '    ' * level + ('└── ' if is_last_file else '├── ')
                
                # Добавляем комментарий для некоторых типов файлов
                comment = ''
                if filename == 'text.py':
                    comment = ' # Сам бот'
                elif filename == 'config.py':
                    comment = ' # Конфиг'
                elif filename == 'db.py':
                    comment = ' # База данных'
                elif filename == 'requirements.txt':
                    comment = ' # Зависимости'
                
                f.write(f"{prefix}{filename}{comment}\n")
                
                # Записываем содержимое файла
                f.write(f"\n{'    ' * (level + 1)}[СОДЕРЖИМОЕ {filename}]:\n")
                content = get_file_content(filepath)
                for line in content:
                    f.write(f"{'    ' * (level + 2)}{line}\n")
                f.write('\n')
        
        f.write("\n" + "=" * 50 + "\n")
        f.write("Структура сгенерирована автоматически\n")

if __name__ == "__main__":
    # Определяем директорию для сканирования
    target_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    output_filename = f"{os.path.basename(os.path.abspath(target_dir))}_structure.txt"
    
    print(f"Генерация структуры для: {target_dir}")
    print(f"Результат будет сохранен в: {output_filename}")
    
    generate_structure(target_dir, output_filename)
    
    print(f"Готово! Структура сохранена в файл: {output_filename}")