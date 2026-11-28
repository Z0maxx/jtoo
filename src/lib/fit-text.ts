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
 * smaller so its first few items fit its height whole. Each `[count, min]` target shrinks the text
 * until the first `count` items (or all, when there are fewer) fit, down to that target's `min`,
 * then the next target takes over from there: `[[2, 15], [1, 11]]` shrinks a little for two
 * items, then further only so the first fits. The list is a wrapping flex column, so an item
 * that doesn't fit moves into a second column. It needs a height of its own (e.g. a flex item
 * with a basis), not its content's. Refits when the list resizes or its content changes.
 * Anything passed after `targets` is only there to refit when it changes.
 */
export function fitItems(
	max: number,
	targets: [count: number, min: number][],
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only read by svelte, to refit
	..._refitOn: unknown[]
): Attachment<HTMLElement> {
	return (list) => {
		// whether the last of the first `count` items is whole, in the first column
		const fits = (count: number) => {
			const items = list.children;
			const last = items[Math.min(count, items.length) - 1];
			if (!last) return true;
			const box = list.getBoundingClientRect();
			const first = items[0].getBoundingClientRect();
			const rect = last.getBoundingClientRect();
			return rect.left <= first.left + 0.5 && rect.bottom <= box.bottom + 0.5;
		};
		const fit = () => {
			let size = max;
			list.style.fontSize = `${size}px`;
			if (!(list.clientHeight > 0)) return;
			for (const [count, min] of targets) {
				while (size > min && !fits(count)) {
					size -= 0.5;
					list.style.fontSize = `${size}px`;
				}
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
