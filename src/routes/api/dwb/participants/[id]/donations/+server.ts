import { dwbParticipantUrl } from '$lib/server/dwb';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const resp = await fetch(
		`${dwbParticipantUrl(params.id, '/donations')}?${url.searchParams.toString().replaceAll('+', '%20')}`
	);

  let content = ""
  if (resp.status === 200) {
    content = JSON.stringify(await resp.json())
  }

  return new Response(content, {
    headers: {
      "ETag": resp.headers.get("ETag") ?? "0"
    }
  })
};
