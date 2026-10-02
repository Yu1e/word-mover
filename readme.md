# Word Mover

[Русский](#русский) | [English](#english)

## Русский

Плагин для Obsidian. Перемещает слово под курсором или выделенный фрагмент на одно слово влево или вправо и на одну экранную строку вверх или вниз. Также дублирует и удаляет строки, удаляет слово и переключает подчёркивание.

### Перемещение

Без выделения перемещается слово, в котором стоит курсор или к которому он примыкает, с выделением — выделенный фрагмент в пределах строки. Между словами остаётся один пробел.

- **Влево / вправо** — через соседнее слово. На краю строки фрагмент переходит в конец предыдущей или в начало следующей непустой строки.
- **Вверх / вниз** — на экранную строку выше или ниже, в ближайший промежуток между словами. Учитываются переносы внутри абзаца, пустые строки пропускаются, маркеры списков, цитат и заголовков остаются на месте.

### Команды

| Команда | Клавиша по умолчанию | Действие |
|---|---|---|
| Move word left / right / up / down | — | Перемещение слова или фрагмента |
| Duplicate line | `Ctrl+D` | Копия строки (или строк выделения) ниже |
| Delete line (no clipboard) | — | Удаление строки без записи в буфер |
| Delete word at cursor | — | Удаление слова под курсором с соседним пробелом |
| Toggle underline | `Ctrl+U` | Оборачивает слово или выделение в `<u>…</u>`; внутри подчёркивания снимает его |

Клавиши назначаются в **Настройки → Горячие клавиши**. `Ctrl+D` в Obsidian по умолчанию занят командой «Удалить абзац», с неё клавишу нужно снять.

### Установка

- **Вручную:** скопировать `main.js` и `manifest.json` в `.obsidian/plugins/yule-word-mover/`, включить плагин в **Настройки → Сторонние плагины**.
- **Через BRAT:** добавить репозиторий `Yu1e/word-mover`.

Obsidian 0.15.0 и выше, чистый JavaScript без сборки. Лицензия MIT.

## English

An Obsidian plugin. Moves the word under the cursor or the selected fragment one word left or right and one visual line up or down. Also duplicates and deletes lines, deletes a word and toggles underline.

### Moving

Without a selection, the word containing or touching the cursor is moved; with a selection, the selected fragment within the line. Words stay separated by a single space.

- **Left / right** — past the neighbouring word. At the line edge the fragment goes to the end of the previous or the start of the next non-empty line.
- **Up / down** — to the visual line above or below, into the nearest gap between words. Wrapped lines are respected, empty lines are skipped, list, quote and heading markers stay in place.

### Commands

| Command | Default hotkey | Action |
|---|---|---|
| Move word left / right / up / down | — | Move the word or fragment |
| Duplicate line | `Ctrl+D` | Copy the line (or selected lines) below |
| Delete line (no clipboard) | — | Delete the line without touching the clipboard |
| Delete word at cursor | — | Delete the word at the cursor with an adjacent space |
| Toggle underline | `Ctrl+U` | Wrap the word or selection in `<u>…</u>`; inside an underline, remove it |

Hotkeys are set in **Settings → Hotkeys**. Obsidian binds `Ctrl+D` to "Delete paragraph" by default; remove that binding.

### Installation

- **Manual:** copy `main.js` and `manifest.json` to `.obsidian/plugins/yule-word-mover/`, enable the plugin in **Settings → Community plugins**.
- **BRAT:** add the repository `Yu1e/word-mover`.

Obsidian 0.15.0 or higher, plain JavaScript, no build step. MIT license.
