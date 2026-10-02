const { Plugin } = require('obsidian');

let EditorSelection = null;
try {
	({ EditorSelection } = require('@codemirror/state'));
} catch (e) {
	EditorSelection = null;
}

const WORD_RE = /[\p{L}\p{N}_]+(?:['’\-][\p{L}\p{N}_]+)*/gu;
const PREFIX_RE = /^[ \t]*(?:>[ \t]?)*(?:#{1,6}[ \t]+|(?:[-*+]|\d+[.)])[ \t]+(?:\[[^\]]\][ \t]+)?)?/;
const U_RE = /<u>([\s\S]*?)<\/u>/gi;

module.exports = class SmartWordMoverPlugin extends Plugin {
	async onload() {
		this.lastVertical = null;
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
			this.addCommand({
				id: 'duplicate-line',
				name: 'Duplicate line',
				hotkeys: [{ modifiers: ['Mod'], key: 'd' }],
				editorCallback: (editor) => this.duplicateLine(editor),
			});
			this.addCommand({
				id: 'delete-line',
				name: 'Delete line (no clipboard)',
				editorCallback: (editor) => this.deleteLine(editor),
			});
			this.addCommand({
				id: 'delete-word',
				name: 'Delete word at cursor',
				editorCallback: (editor) => this.deleteWord(editor),
			});
			this.addCommand({
				id: 'toggle-underline',
				name: 'Toggle underline',
				hotkeys: [{ modifiers: ['Mod'], key: 'u' }],
				editorCallback: (editor) => this.toggleUnderline(editor),
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

	prefixEnd(line) {
		const m = line.match(PREFIX_RE);
		return m ? m[0].length : 0;
	}

	findTokenAt(tokens, ch) {
		let word = tokens.find(t => ch >= t.start && ch <= t.end);
		if (word) return word;
		for (let i = tokens.length - 1; i >= 0; i--) {
			if (tokens[i].end <= ch) return tokens[i];
		}
		return tokens[0] || null;
	}

	findWordAt(line, ch) {
		WORD_RE.lastIndex = 0;
		let m;
		while ((m = WORD_RE.exec(line)) !== null) {
			const start = m.index, end = m.index + m[0].length;
			if (ch >= start && ch <= end) return { start, end, text: m[0] };
			if (start > ch) break;
		}
		return null;
	}

	getLineSpan(editor) {
		const from = editor.getCursor('from');
		const to = editor.getCursor('to');
		let last = to.line;
		if (to.line > from.line && to.ch === 0) last--;
		return { first: from.line, last };
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
		const after = line.substring(fragEnd).trim();
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
			const adj = line.substring(prev.start, fragStart).trim();
			const after = line.substring(fragEnd).trim();
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
			const adj = line.substring(fragEnd, next.end).trim();
			const after = line.substring(next.end).trim();
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

		const tgtText = editor.getLine(tgtLine);
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

	// ── Вертикальное перемещение по экранным строкам ──
	moveVertical(editor, direction) {
		const view = editor.cm;
		if (!view || !EditorSelection || typeof view.moveVertically !== 'function') {
			return this.moveVerticalByLine(editor, direction);
		}

		const frag = this.getFragment(editor);
		if (!frag) return;
		const { lineNum, fragStart, fragEnd, fragText, hasSel } = frag;

		const doc = view.state.doc;
		const srcLine = doc.line(lineNum + 1);
		const fs = srcLine.from + fragStart;
		const fe = srcLine.from + fragEnd;
		const forward = direction === 'down';

		const startCoords = view.coordsAtPos(fs, 1);
		if (!startCoords) return this.moveVerticalByLine(editor, direction);

		const contentLeft = view.contentDOM.getBoundingClientRect().left;
		let goalX = startCoords.left;
		const lv = this.lastVertical;
		if (lv && lv.view === view && lv.pos === fs && lv.docLen === doc.length) {
			goalX = contentLeft + lv.goalRel;
		}

		// Экранная строка выше/ниже; пустые строки пропускаются
		let cur = EditorSelection.cursor(forward ? fe : fs, forward ? -1 : 1);
		let land = null;
		for (let guard = 0; guard < 1000; guard++) {
			const next = view.moveVertically(cur, forward);
			if (next.head === cur.head) break;
			if (doc.lineAt(next.head).text.trim()) { land = next; break; }
			cur = next;
		}
		if (!land) return;

		const landRect = view.coordsAtPos(land.head, land.assoc || 1)
			|| view.coordsAtPos(land.head, -(land.assoc || 1));
		if (!landRect) return;
		const landMid = (landRect.top + landRect.bottom) / 2;

		const tLine = doc.lineAt(land.head);
		const tText = tLine.text;
		const tTokens = this.tokenize(tText);
		const pre = this.prefixEnd(tText);
		const sameLine = tLine.number === srcLine.number;

		const touches = (p) => {
			if (!sameLine) return false;
			if (p >= fs && p <= fe) return true;
			if (p < fs) return !doc.sliceString(p, fs).trim();
			return !doc.sliceString(fe, p).trim();
		};

		const cands = [];
		for (const t of tTokens) {
			if (t.start >= pre) cands.push({ p: tLine.from + t.start, before: true, side: 1 });
			if (t.end > pre) cands.push({ p: tLine.from + t.end, before: false, side: -1 });
		}

		let bestRow = null, bestAny = null;
		for (const c of cands) {
			if (touches(c.p)) continue;
			const r = view.coordsAtPos(c.p, c.side);
			if (!r) continue;
			const mid = (r.top + r.bottom) / 2;
			const dx = Math.abs(r.left - goalX);
			const onRow = mid >= landRect.top && mid <= landRect.bottom;
			if (onRow && (!bestRow || dx < bestRow.dx)) bestRow = { ...c, dx };
			const score = Math.abs(mid - landMid) * 1000 + dx;
			if (!bestAny || score < bestAny.score) bestAny = { ...c, score };
		}
		const target = bestRow || bestAny;
		if (!target) return;

		const rem = this.computeRemoval(doc, srcLine, fs, fe);
		const ins = target.before ? fragText + ' ' : ' ' + fragText;
		const changes = [
			{ from: rem.from, to: rem.to, insert: '' },
			{ from: target.p, insert: ins },
		].sort((a, b) => a.from - b.from);

		const delta = rem.to <= target.p ? rem.to - rem.from : 0;
		const ns = target.p - delta + (target.before ? 0 : 1);
		const ne = ns + fragText.length;

		view.dispatch({
			changes,
			selection: hasSel ? EditorSelection.single(ns, ne) : EditorSelection.cursor(ne),
			scrollIntoView: true,
			userEvent: 'move.word',
		});

		this.lastVertical = {
			view,
			pos: ns,
			docLen: view.state.doc.length,
			goalRel: goalX - contentLeft,
		};
	}

	// Что удалить в исходной строке: фрагмент и один соседний пробельный промежуток
	computeRemoval(doc, line, fs, fe) {
		const text = line.text;
		const ws = (c) => c === ' ' || c === '\t';
		let a = fs - line.from;
		let b = fe - line.from;
		const leftWS = a === 0 || ws(text[a - 1]);
		const rightWS = b === text.length || ws(text[b]);

		if (leftWS && rightWS) {
			let b2 = b;
			while (b2 < text.length && ws(text[b2])) b2++;
			if (b2 < text.length) {
				b = b2;
			} else {
				while (a > 0 && ws(text[a - 1])) a--;
				b = text.length;
			}
		}

		const rest = text.slice(0, a) + text.slice(b);
		if (!rest.trim()) {
			if (line.number < doc.lines) return { from: line.from, to: line.to + 1 };
			if (line.number > 1) return { from: line.from - 1, to: line.to };
			return { from: line.from, to: line.to };
		}
		return { from: line.from + a, to: line.from + b };
	}

	// Запасной вариант без CodeMirror: строго одна строка документа
	moveVerticalByLine(editor, direction) {
		const frag = this.getFragment(editor);
		if (!frag) return;

		const { lineNum, line, fragStart, fragEnd, fragText, hasSel } = frag;
		const total = editor.lineCount();

		const tgtLine = direction === 'up' ? lineNum - 1 : lineNum + 1;
		if (tgtLine < 0 || tgtLine >= total) return;

		const refCol = fragStart;
		const tgtText = editor.getLine(tgtLine);
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

	// ── Строки и слова ──
	duplicateLine(editor) {
		const anchor = editor.getCursor('anchor');
		const head = editor.getCursor('head');
		const { first, last } = this.getLineSpan(editor);

		const lines = [];
		for (let i = first; i <= last; i++) lines.push(editor.getLine(i));

		editor.replaceRange('\n' + lines.join('\n'), { line: last, ch: editor.getLine(last).length });

		const shift = last - first + 1;
		editor.setSelection(
			{ line: anchor.line + shift, ch: anchor.ch },
			{ line: head.line + shift, ch: head.ch },
		);
	}

	deleteLine(editor) {
		const { first, last } = this.getLineSpan(editor);
		const total = editor.lineCount();
		const ch = editor.getCursor('head').ch;

		let from, to;
		if (last < total - 1) {
			from = { line: first, ch: 0 };
			to = { line: last + 1, ch: 0 };
		} else if (first > 0) {
			from = { line: first - 1, ch: editor.getLine(first - 1).length };
			to = { line: last, ch: editor.getLine(last).length };
		} else {
			from = { line: 0, ch: 0 };
			to = { line: last, ch: editor.getLine(last).length };
		}
		editor.replaceRange('', from, to);

		const nl = Math.min(first, editor.lineCount() - 1);
		editor.setCursor({ line: nl, ch: Math.min(ch, editor.getLine(nl).length) });
	}

	deleteWord(editor) {
		if (editor.somethingSelected()) {
			editor.replaceSelection('');
			return;
		}
		const cur = editor.getCursor();
		const text = editor.getLine(cur.line);
		const w = this.findWordAt(text, cur.ch);
		if (!w) return;

		const ws = (c) => c === ' ' || c === '\t';
		let a = w.start, b = w.end;

		const eatBack = () => {
			let a2 = a;
			while (a2 > 0 && ws(text[a2 - 1])) a2--;
			if (a2 > 0) a = a2;
		};

		if (b < text.length && ws(text[b])) {
			while (b < text.length && ws(text[b])) b++;
			if (b === text.length) eatBack();
		} else if (a > 0 && ws(text[a - 1])) {
			eatBack();
		}

		editor.replaceRange('', { line: cur.line, ch: a }, { line: cur.line, ch: b });
		editor.setCursor({ line: cur.line, ch: a });
	}

	// ── Подчёркивание ──
	toggleUnderline(editor) {
		const from = editor.getCursor('from');
		const to = editor.getCursor('to');

		if (from.line === to.line) {
			const line = editor.getLine(from.line);
			U_RE.lastIndex = 0;
			let m;
			while ((m = U_RE.exec(line)) !== null) {
				const s = m.index, e = m.index + m[0].length;
				if (from.ch >= s && to.ch <= e) {
					this.unwrapUnderline(editor, from.line, s, e, m[1]);
					return;
				}
				if (s > to.ch) break;
			}
		}

		if (editor.somethingSelected()) {
			const sel = editor.getSelection();
			editor.replaceSelection('<u>' + sel + '</u>');
			const endCh = to.ch + (from.line === to.line ? 3 : 0);
			editor.setSelection({ line: from.line, ch: from.ch + 3 }, { line: to.line, ch: endCh });
			return;
		}

		const line = editor.getLine(from.line);
		const w = this.findWordAt(line, from.ch);
		if (w) {
			editor.replaceRange('<u>' + w.text + '</u>',
				{ line: from.line, ch: w.start }, { line: from.line, ch: w.end });
			editor.setCursor({ line: from.line, ch: from.ch + 3 });
		} else {
			editor.replaceRange('<u></u>', from);
			editor.setCursor({ line: from.line, ch: from.ch + 3 });
		}
	}

	unwrapUnderline(editor, lineNum, s, e, inner) {
		const anchor = editor.getCursor('anchor');
		const head = editor.getCursor('head');
		const innerEnd = e - 4;
		const map = (ch) => {
			if (ch <= s) return ch;
			if (ch <= s + 3) return s;
			if (ch <= innerEnd) return ch - 3;
			if (ch <= e) return innerEnd - 3;
			return ch - 7;
		};
		editor.replaceRange(inner, { line: lineNum, ch: s }, { line: lineNum, ch: e });
		editor.setSelection(
			{ line: anchor.line, ch: map(anchor.ch) },
			{ line: head.line, ch: map(head.ch) },
		);
	}
};
