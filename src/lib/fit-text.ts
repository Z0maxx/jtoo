import type { Attachment } from 'svelte/attachments';

/**
 * Keeps an element's text on one line, at `size` or smaller when that would overflow its width.
 * Given a `{ max, min }` size, it shrinks no further than `min`, and the element's own overflow
 * (eg: `truncate`) takes over from there. The element needs a width of its own (block, or a flex
 * item with a basis), not its content's. Anything passed after `size` is only there to refit when
 * it changes, eg: the font setting.
 *
 * `<h1 {@attach fitText(112, settings.current.font)}>`
 */
export function fitText(
	size: number | { max: number; min: number },
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only read by svelte, to refit
	..._refitOn: unknown[]
): Attachment<HTMLElement> {
	const maxPx = typeof size === 'number' ? size : size.max;
	const minPx = typeof size === 'number' ? 0 : Math.min(size.min, size.max);

	return (el) => {
		el.style.whiteSpace = 'nowrap';

		// measured at the size the text is now, then scaled, rather than set to the max first: so a
		// font-size transition on the element animates to the fitted size instead of jumping
		const fit = () => {
			const available = el.clientWidth;
			const current = parseFloat(getComputedStyle(el).fontSize);
			if (!(available > 0) || !(current > 0)) {
				el.style.fontSize = `${maxPx}px`;
				return;
			}
			const neededAtMax = (el.scrollWidth * maxPx) / current;
			// a little under, so rounding never leaves the last letter clipped
			const fitted =
				neededAtMax > available ? Math.floor(((maxPx * available) / neededAtMax) * 0.99) : maxPx;
			el.style.fontSize = `${Math.max(fitted, minPx)}px`;
		};

		// an element's first fit is at once, so a font-size transition doesn't grow it from the
		// inherited size. a refit for a new size (the attachment rerun on the same element) animates
		if (el.dataset.fitted === undefined) {
			el.dataset.fitted = '';
			const transition = el.style.transition;
			el.style.transition = 'none';
			el.style.fontSize = `${maxPx}px`;
			fit();
			void el.offsetWidth; // apply the size before the transition comes back
			el.style.transition = transition;
		} else {
			fit();
		}

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

/**
 * Sizes a list's text (its font-size, which its items size themselves from in `em`) at `max`, or
 * smaller when its first item wouldn't fit the list's height whole, down to `min`. The list
 * needs a height of its own (e.g. a flex item with a basis), not its content's. Refits when the
 * list resizes or its content changes.
 */
export function fitFirstItem(max: number, min: number): Attachment<HTMLElement> {
	return (list) => {
		const fit = () => {
			let size = max;
			list.style.fontSize = `${size}px`;
			const first = list.firstElementChild as HTMLElement | null;
			if (!first || !(list.clientHeight > 0)) return;
			while (size > min && first.offsetHeight > list.clientHeight) {
				size -= 0.5;
				list.style.fontSize = `${size}px`;
			}
		};

		const resized = new ResizeObserver(fit);
		resized.observe(list);
		// a new donation, or one leaving the list (only the font-size, an attribute, is set here,
		// so fitting never sets this off)
		const changed = new MutationObserver(fit);
		changed.observe(list, { childList: true, subtree: true, characterData: true });
		fit();
		// text measured in a fallback font is the wrong height once the real one loads
		document.fonts.ready.then(fit);
		return () => {
			resized.disconnect();
			changed.disconnect();
		};
	};
}
