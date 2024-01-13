import {MergeView} from "@codemirror/merge";
import {EditorState} from "@codemirror/state";
import {basicSetup, EditorView} from "codemirror";

export function createMergeEditor(container: HTMLElement, baseContent: string, conflictContent: string) {
	return new MergeView({
		a: {
			doc: baseContent,
			extensions: [
				basicSetup,
				EditorView.lineWrapping,
				EditorView.darkTheme.of(true),
			],
		},
		b: {
			doc: conflictContent,
			extensions: [
				basicSetup,
				EditorView.lineWrapping,
				EditorView.darkTheme.of(true),
				EditorView.editable.of(false),
				EditorState.readOnly.of(true),
			],
		},
		revertControls: "b-to-a",
		parent: container,
	});
}
