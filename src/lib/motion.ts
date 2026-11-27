import { prefersReducedMotion } from 'svelte/motion';
import { slide as svelteSlide, type SlideParams } from 'svelte/transition';

// svelte's slide, but instant when the system asks for reduced motion. the controls' sections
// and panels open with it
export function slide(node: Element, params?: SlideParams) {
	return svelteSlide(node, prefersReducedMotion.current ? { ...params, duration: 0 } : params);
}
