const { Plugin } = require('obsidian');

module.exports = class SmartWordMoverPlugin extends Plugin {
    async onload() {
        try {
            this.addCommand({
                id: 'move-word-left',
                name: 'Move word left',
                editorCallback: (editor) => this.moveWord(editor, 'left'),
            });
            this.addCommand({
                id: 'move-word-right',
                name: 'Move word right',
                editorCallback: (editor) => this.moveWord(editor, 'right'),
            });
            this.addCommand({
                id: 'move-word-up',
                name: 'Move word up',
                editorCallback: (editor) => this.moveVertical(editor, 'up'),
            });
            this.addCommand({
                id: 'move-word-down',
                name: 'Move word down',
                editorCallback: (editor) => this.moveVertical(editor, 'down'),
            });
        } catch (e) {
            console.error('SmartWordMover: failed to load', e);
        }
    }

    onunload() {}

    tokenize(line) {
        const tokens = [];
        const re = /\S+/g;
        let m;
        while ((m = re.exec(line)) !== null) {
            tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
        }
        return tokens;
    }

    getIndent(line) {
        const m = line.match(/^\s*/);
        return m ? m[0] : '';
    }

    findTokenAt(tokens, ch) {
        let word = tokens.find(t => ch >= t.start && ch <= t.end);
        if (word) return word;
        for (let i = tokens.length - 1; i >= 0; i--) {
            if (tokens[i].end <= ch) return tokens[i];
        }
        return tokens[0] || null;
    }

    getFragment(editor) {
        const sel = editor.getSelection();
        const hasSel = sel && sel.length > 0;
        const lineNum = hasSel ? editor.getCursor('from').line : editor.getCursor().line;
        const line = editor.getLine(lineNum);
        const tokens = this.tokenize(line);
        if (tokens.length === 0) return null;

        let fragStart, fragEnd, fragText;
        if (hasSel) {
            const from = editor.getCursor('from');
            const to = editor.getCursor('to');
            if (from.line !== to.line) return null;
            fragStart = from.ch;
            fragEnd = to.ch;
            fragText = sel;
        } else {
            const word = this.findTokenAt(tokens, editor.getCursor().ch);
            if (!word) return null;
            fragStart = word.start;
            fragEnd = word.end;
            fragText = word.text;
        }
        if (!fragText || !fragText.trim()) return null;
        return { lineNum, line, tokens, fragStart, fragEnd, fragText, hasSel };
    }

    buildSourceRemainder(line, fragStart, fragEnd) {
        const indent = this.getIndent(line);
        const before = line.substring(0, fragStart).trim();
        const after  = line.substring(fragEnd).trim();
        const rem = [before, after].filter(Boolean).join(' ');
        if (!rem) return null;
        return indent + rem;
    }

    applyChange(editor, minLine, maxLine, resultLines, finalLine, newFragStart, newFragEnd, hasSel) {
        const maxLineText = editor.getLine(maxLine);
        editor.replaceRange(
            resultLines.join('\n'),
            { line: minLine, ch: 0 },
            { line: maxLine, ch: maxLineText.length },
        );
        if (hasSel) {
            editor.setSelection(
                { line: finalLine, ch: newFragStart },
                { line: finalLine, ch: newFragEnd },
            );
        } else {
            editor.setCursor({ line: finalLine, ch: newFragEnd });
        }
    }

    moveWord(editor, direction) {
        const frag = this.getFragment(editor);
        if (!frag) return;

        const { lineNum, line, tokens, fragStart, fragEnd, fragText, hasSel } = frag;
        const hasPrev = tokens.some(t => t.end <= fragStart);
        const hasNext = tokens.some(t => t.start >= fragEnd);

        if ((direction === 'left' && hasPrev) || (direction === 'right' && hasNext)) {
            this.moveIntraLine(editor, lineNum, line, tokens, fragStart, fragEnd, fragText, direction, hasSel);
        } else {
            this.moveCrossLine(editor, lineNum, line, fragStart, fragEnd, fragText, direction, hasSel);
        }
    }

    moveIntraLine(editor, lineNum, line, tokens, fragStart, fragEnd, fragText, dir, hasSel) {
        const indent = this.getIndent(line);
        const parts = [];
        let newFragStart;

        if (dir === 'left') {
            let prev = null;
            for (let i = tokens.length - 1; i >= 0; i--) {
                if (tokens[i].end <= fragStart) { prev = tokens[i]; break; }
            }
            const before = line.substring(0, prev.start).trim();
            const adj    = line.substring(prev.start, fragStart).trim();
            const after  = line.substring(fragEnd).trim();
            if (before) parts.push(before);
            parts.push(fragText);
            if (adj) parts.push(adj);
            if (after) parts.push(after);
            newFragStart = indent.length + (before ? before.length + 1 : 0);
        } else {
            let next = null;
            for (const t of tokens) {
                if (t.start >= fragEnd) { next = t; break; }
            }
            const before = line.substring(0, fragStart).trim();
            const adj    = line.substring(fragEnd, next.end).trim();
            const after  = line.substring(next.end).trim();
            if (before) parts.push(before);
            if (adj) parts.push(adj);
            parts.push(fragText);
            if (after) parts.push(after);
            newFragStart = indent.length;
            if (before) newFragStart += before.length + 1;
            if (adj) newFragStart += adj.length + 1;
        }

        const newLine = indent + parts.join(' ');
        const newFragEnd = newFragStart + fragText.length;
        editor.replaceRange(newLine, { line: lineNum, ch: 0 }, { line: lineNum, ch: line.length });

        if (hasSel) {
            editor.setSelection({ line: lineNum, ch: newFragStart }, { line: lineNum, ch: newFragEnd });
        } else {
            editor.setCursor({ line: lineNum, ch: newFragEnd });
        }
    }

    moveCrossLine(editor, srcLine, srcText, fragStart, fragEnd, fragText, dir, hasSel) {
        const total = editor.lineCount();
        let tgtLine = -1;
        if (dir === 'left') {
            for (let i = srcLine - 1; i >= 0; i--) {
                if (editor.getLine(i).trim()) { tgtLine = i; break; }
            }
        } else {
            for (let i = srcLine + 1; i < total; i++) {
                if (editor.getLine(i).trim()) { tgtLine = i; break; }
            }
        }
        if (tgtLine < 0) return;

        const tgtText   = editor.getLine(tgtLine);
        const tgtTokens = this.tokenize(tgtText);
        const tgtIndent = this.getIndent(tgtText);

        const tgtParts = tgtTokens.map(t => t.text);
        if (dir === 'left') {
            tgtParts.push(fragText);
        } else {
            tgtParts.unshift(fragText);
        }
        const newTgtLine = tgtIndent + tgtParts.join(' ');

        let newFragStart = tgtIndent.length;
        if (dir === 'left') {
            for (let i = 0; i < tgtParts.length - 1; i++) {
                newFragStart += tgtParts[i].length + 1;
            }
        }
        const newFragEnd = newFragStart + fragText.length;

        const newSrcLine = this.buildSourceRemainder(srcText, fragStart, fragEnd);
        const srcEmpty = newSrcLine === null;

        const minLine = Math.min(srcLine, tgtLine);
        const maxLine = Math.max(srcLine, tgtLine);

        const resultLines = [];
        for (let i = minLine; i <= maxLine; i++) {
            if (i === tgtLine) {
                resultLines.push(newTgtLine);
            } else if (i === srcLine) {
                if (!srcEmpty) resultLines.push(newSrcLine);
            } else {
                resultLines.push(editor.getLine(i));
            }
        }

        let finalLine = tgtLine;
        if (srcEmpty && srcLine < tgtLine) {
            finalLine = tgtLine - 1;
        }

        this.applyChange(editor, minLine, maxLine, resultLines, finalLine, newFragStart, newFragEnd, hasSel);
    }

    // ── ИСПРАВЛЕНО: идём строго на одну строку, не пропускаем пустые ──
    moveVertical(editor, direction) {
        const frag = this.getFragment(editor);
        if (!frag) return;

        const { lineNum, line, fragStart, fragEnd, fragText, hasSel } = frag;
        const total = editor.lineCount();

        // Строго одна строка вверх или вниз
        const tgtLine = direction === 'up' ? lineNum - 1 : lineNum + 1;
        if (tgtLine < 0 || tgtLine >= total) return;

        const refCol    = fragStart;
        const tgtText   = editor.getLine(tgtLine);
        const tgtTokens = this.tokenize(tgtText);
        const tgtIndent = this.getIndent(tgtText);

        let insertIdx = tgtTokens.length;
        for (let i = 0; i < tgtTokens.length; i++) {
            if (refCol <= tgtTokens[i].start) {
                insertIdx = i;
                break;
            }
            if (refCol < tgtTokens[i].end) {
                insertIdx = i + 1;
                break;
            }
        }

        const tgtParts = tgtTokens.map(t => t.text);
        tgtParts.splice(insertIdx, 0, fragText);
        const newTgtLine = tgtIndent + tgtParts.join(' ');

        let newFragStart = tgtIndent.length;
        for (let i = 0; i < insertIdx; i++) {
            newFragStart += tgtParts[i].length + 1;
        }
        const newFragEnd = newFragStart + fragText.length;

        const newSrcLine = this.buildSourceRemainder(line, fragStart, fragEnd);
        const srcEmpty = newSrcLine === null;

        const minLine = Math.min(lineNum, tgtLine);
        const maxLine = Math.max(lineNum, tgtLine);

        const resultLines = [];
        for (let i = minLine; i <= maxLine; i++) {
            if (i === tgtLine) {
                resultLines.push(newTgtLine);
            } else if (i === lineNum) {
                if (!srcEmpty) resultLines.push(newSrcLine);
            } else {
                resultLines.push(editor.getLine(i));
            }
        }

        let finalLine = tgtLine;
        if (srcEmpty && lineNum < tgtLine) {
            finalLine = tgtLine - 1;
        }

        this.applyChange(editor, minLine, maxLine, resultLines, finalLine, newFragStart, newFragEnd, hasSel);
    }
};