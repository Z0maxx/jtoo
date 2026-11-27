<script lang="ts">
	import type { Snippet } from 'svelte';
	import SceneTint from '$lib/components/SceneTint.svelte';

	// a scene's shell: the top border, then the tinted column its content stacks in.
	// 'page' fills the space under the border with padded content (pair with SceneHeader),
	// 'centered' sizes to the content and centers it in that space
	let {
		layout = 'page',
		class: className = '',
		children
	}: { layout?: 'page' | 'centered'; class?: string; children: Snippet } = $props();

	const layouts = {
		page: 'min-h-0 grow flex-col px-24 py-14 text-ctp-text',
		centered: 'm-auto justify-center p-4'
	};
</script>

<section class="relative z-20 flex w-full {layouts[layout]} {className}">
	<SceneTint class="-z-10" />
	{@render children()}
</section>
