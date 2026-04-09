# Word Mover / Умный переместитель слов

[English](#english) | [Русский](#русский)

---

## English

**Word Mover** is an Obsidian plugin that lets you move a word or a selected text fragment one word left or right with a single keyboard shortcut. It intelligently detects which word to move based on the cursor position (inside a word, just after a word, or just before a word) and preserves exactly one space between words.

### Features

- **Cursor‑aware word selection** – move the word the cursor is inside, the word just before the cursor (if cursor is after a word), or the word just after the cursor (if cursor is before a word).
- **Selection support** – if text is selected, the entire selection is moved (not limited to single words).
- **Smart spacing** – automatically maintains a single space between words; no extra spaces are added.
- **Two commands**:  
  - `Move word left` – moves the word/fragment to the left (before the previous word).  
  - `Move word right` – moves it to the right (after the next word).

### Installation

#### Manual installation

1. Download the latest release.
2. Extract the folder `word-mover` into your Obsidian vault’s `.obsidian/plugins/` directory.
3. Reload Obsidian (or restart it).
4. Enable the plugin in **Settings → Community plugins**.

#### Via BRAT

1. Install the **BRAT** plugin.
2. Add this repository.
3. Enable the plugin in **Settings → Community plugins**.

### Usage

After enabling the plugin, two commands are available:

- **Move word left** – move the word or selection one word to the left.
- **Move word right** – move it one word to the right.

You can assign keyboard shortcuts to these commands in **Settings → Hotkeys**.

#### Examples
The quick brown fox jumps.
^ cursor here

text
- If cursor is inside `quick`, `quick` will be moved.
- If cursor is immediately after `quick` (before space), `quick` will be moved.
- If cursor is immediately before `brown` (after space), `brown` will be moved.

With selection:
Select any text → press hotkey → the selected text moves left or right.

### Compatibility

- Obsidian v0.15.0 or higher.
- No compilation needed – pure JavaScript.

### License

MIT

---

## Русский

**Word Mover** — плагин для Obsidian, позволяющий перемещать слово под курсором или выделенный фрагмент на одно слово влево или вправо одной горячей клавишей. Плагин интеллектуально определяет, какое слово нужно переместить, в зависимости от положения курсора (внутри слова, сразу после слова или сразу перед словом) и сохраняет ровно один пробел между словами.

### Возможности

- **Умное определение слова** – перемещается слово, на котором стоит курсор, слово перед курсором (если курсор после слова) или слово после курсора (если курсор перед словом).
- **Поддержка выделения** – если текст выделен, перемещается весь выделенный фрагмент (не ограничиваясь одним словом).
- **Интеллектуальные пробелы** – автоматически поддерживается один пробел между словами; лишние пробелы не добавляются.
- **Две команды**:  
  - `Move word left` – перемещает слово/фрагмент влево (перед предыдущим словом).  
  - `Move word right` – перемещает вправо (после следующего слова).

### Установка

#### Ручная установка

1. Скачайте последнюю версию.
2. Распакуйте папку `smart-word-mover` в каталог `.obsidian/plugins/` вашего хранилища Obsidian.
3. Перезагрузите Obsidian.
4. Включите плагин в **Настройки → Сторонние плагины**.

#### Через BRAT

1. Установите плагин **BRAT**.
2. Добавьте репозиторий.
3. Включите плагин в настройках.

### Использование

После включения плагина появятся две команды:

- **Move word left** – переместить слово или выделение на одно слово влево.
- **Move word right** – переместить на одно слово вправо.

Вы можете назначить горячие клавиши на эти команды в **Настройки → Горячие клавиши**.

#### Примеры
The quick brown fox jumps.
^ курсор здесь

text
- Если курсор внутри слова `quick`, будет перемещено `quick`.
- Если курсор сразу после `quick` (перед пробелом), будет перемещено `quick`.
- Если курсор сразу перед `brown` (после пробела), будет перемещено `brown`.

С выделением:
Выделите любой текст → нажмите горячую клавишу → выделенный текст переместится влево или вправо.

### Совместимость

- Obsidian версии 0.15.0 и выше.
- Не требует компиляции – чистый JavaScript.

### Лицензия

MIT