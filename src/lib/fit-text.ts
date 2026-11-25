import type { Attachment } from 'svelte/attachments';

/**
 * Keeps an element's text on one line, at `maxPx` or smaller when that would overflow its width.
 * The element needs a width of its own (block, or a flex item with a basis), not its content's.
 * Anything passed after `maxPx` is only there to refit when it changes, eg: the font setting.
 *
 * `<h1 {@attach fitText(112, settings.current.font)}>`
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only read by svelte, to refit
export function fitText(maxPx: number, ..._refitOn: unknown[]): Attachment<HTMLElement> {
	return (el) => {
		el.style.whiteSpace = 'nowrap';

		const fit = () => {
			el.style.fontSize = `${maxPx}px`;
			const available = el.clientWidth;
			const needed = el.scrollWidth;
			if (available > 0 && needed > available) {
				// a little under, so rounding never leaves the last letter clipped
				el.style.fontSize = `${Math.floor(((maxPx * available) / needed) * 0.99)}px`;
			}
		};

		fit();

		// refit when the width changes, not on the height changes fitting itself makes
		let width = el.clientWidth;
		const resize = new ResizeObserver(() => {
			if (el.clientWidth === width) return;
			width = el.clientWidth;
			fit();
		});
		resize.observe(el);

		// a web font that finishes loading after the first fit changes the text's width
		document.fonts.addEventListener('loadingdone', fit);
		document.fonts.ready.then(fit);

		return () => {
			resize.disconnect();
			document.fonts.removeEventListener('loadingdone', fit);
		};
	};
}
